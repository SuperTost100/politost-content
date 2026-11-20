/**
 * Trusted against sanitized math over real books: `npm run test:corpus -- <books folder>`, where the
 * folder holds one folder per book with smartbook.json, chapters/ and esercizi.md or esami.md, as
 * `books/` in politost-books does. It renders every chapter text, exercise and numbered formula
 * both ways, parses both to DOM and prints each attribute or element that only the trusted output
 * has. It fails when the DOMs differ in anything else, or when the trusted output holds an element
 * or attribute outside the allowlist in trustedMathAllowlist.ts.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { assertKatexOnly } from '../trustedMathAllowlist.ts';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error('Usage: npm run test:corpus -- <folder with one folder per book>');
  process.exit(2);
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(globalThis as { window: unknown }).window = dom.window;
const { parseChapterMarkdown, parseExercises, preprocessContent } = await import('../../src/parser.ts');
const { parseContentBlocks } = await import('../../src/renderContent.ts');
const { renderFormulaHtml, renderNumberedFormulaHtml } = await import('../../src/formulaRender.ts');

const TRUSTED = { mathTrusted: true } as const;

// Two templates reused for every pair: jsdom keeps a new element per call alive and runs out of memory.
const templates = [dom.window.document.createElement('template'), dom.window.document.createElement('template')];

function fragment(html: string, slot: 0 | 1): DocumentFragment {
  templates[slot].innerHTML = html;
  return templates[slot].content;
}

function collectHtml(blocks: unknown): string[] {
  const out: string[] = [];
  JSON.stringify(blocks, (k, v) => (k === 'html' && typeof v === 'string' ? (out.push(v), v) : v));
  return out;
}

/** What the trusted DOM has that the sanitized one lacks, as "element@attribute" or "<element>". */
const extras = new Map<string, number>();
const problems: string[] = [];
let pairs = 0;

function compare(trusted: string, sanitized: string, where: string) {
  pairs++;
  const t = fragment(trusted, 0);
  assertKatexOnly(t, where);
  const s = fragment(sanitized, 1);
  if (t.isEqualNode(s)) return;
  // Drop from the trusted DOM what DOMPurify dropped (attributes, and whole elements, since
  // DOMPurify only removes), then it must equal the sanitized DOM.
  const count = (key: string) => extras.set(key, (extras.get(key) ?? 0) + 1);
  const walkChildren = (a: ParentNode, b: ParentNode, parent: string) => {
    const bc = Array.from(b.children);
    let j = 0;
    for (const child of Array.from(a.children)) {
      if (bc[j]?.localName === child.localName) {
        walk(child, bc[j++]);
      } else {
        count(`<${parent}> > <${child.localName}> removed with its content`);
        child.remove();
      }
    }
  };
  const walk = (a: Element, b: Element) => {
    for (const attr of Array.from(a.attributes)) {
      if (b.hasAttribute(attr.name)) continue;
      count(`<${a.localName}> @${attr.name}="${attr.value}"`);
      a.removeAttribute(attr.name);
    }
    walkChildren(a, b, a.localName);
  };
  walkChildren(t, s, '');
  if (!t.isEqualNode(s)) problems.push(`${where}: DOMs differ beyond dropped attributes and elements`);
}

function compareText(text: string, where: string) {
  const content = preprocessContent(text);
  const a = collectHtml(parseContentBlocks(content, TRUSTED));
  const b = collectHtml(parseContentBlocks(content));
  if (a.length !== b.length) problems.push(`${where}: ${a.length} HTML pieces against ${b.length}`);
  a.forEach((html, i) => compare(html, b[i] ?? '', where));
}

/** One check per chapter paragraph, numbered formula or exercise, in a fixed order. */
const items: (() => void)[] = [];
let formulas = 0;
for (const book of readdirSync(dir).sort()) {
  const root = join(dir, book);
  if (!existsSync(join(root, 'smartbook.json'))) continue;
  const config = JSON.parse(readFileSync(join(root, 'smartbook.json'), 'utf8')) as {
    chapters: { number: number; file: string }[];
  };
  for (const meta of config.chapters) {
    const chapter = parseChapterMarkdown(readFileSync(join(root, 'chapters', meta.file), 'utf8'), meta.number);
    chapter.paragraphs.forEach((p, i) => items.push(() => compareText(p.content, `${book} ${meta.file} §${i}`)));
    for (const f of chapter.formulas) {
      formulas++;
      items.push(() => {
        compare(renderFormulaHtml(f.latex, TRUSTED), renderFormulaHtml(f.latex), `${book} (${f.id})`);
        compare(renderNumberedFormulaHtml(f, 'print', TRUSTED), renderNumberedFormulaHtml(f, 'print'), `${book} (${f.id}) numbered`);
      });
    }
  }
  for (const [file, type] of [['esercizi.md', 'esercizio'], ['esami.md', 'esame']] as const) {
    if (!existsSync(join(root, file))) continue;
    for (const ex of parseExercises(readFileSync(join(root, file), 'utf8'), type)) {
      for (const text of [ex.question, ex.hint, ex.solution]) if (text) items.push(() => compareText(text, `${book} ${file} ${ex.id}`));
    }
  }
}

// DOMPurify under jsdom keeps every parsed document alive, about 250 kB per call, so each child
// process checks a slice of the items and reports back.
const SLICE = 150;
const range = process.argv[3]?.match(/^(\d+):(\d+)$/);
if (range) {
  for (const item of items.slice(Number(range[1]), Number(range[2]))) item();
  console.log(JSON.stringify({ pairs, extras: [...extras], problems }));
  process.exit(0);
}

for (let start = 0; start < items.length; start += SLICE) {
  const out = execFileSync(process.execPath, [...process.execArgv, process.argv[1], dir, `${start}:${start + SLICE}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const part = JSON.parse(out.trim().split('\n').at(-1)!) as { pairs: number; extras: [string, number][]; problems: string[] };
  pairs += part.pairs;
  for (const [key, count] of part.extras) extras.set(key, (extras.get(key) ?? 0) + count);
  problems.push(...part.problems);
}

console.log(`${items.length} texts and formulas, ${formulas} of them numbered formulas, ${pairs} HTML pieces compared.`);
console.log('Only in the trusted output (element@attribute=value: count):');
for (const [key, count] of [...extras].sort()) console.log(`  ${key}: ${count}`);
if (problems.length) {
  console.error(problems.slice(0, 50).join('\n'));
  console.error(`${problems.length} differences beyond dropped attributes.`);
  process.exit(1);
}
