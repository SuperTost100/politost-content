import type { Chapter, Exercise, FormulaRef, Paragraph } from './types/smartbook';

/** id and label, either order. Shared with validateChapter's formulaOpenRe. */
export const CANONICAL_FORMULA_OPEN =
  /^:::formula\{(?:id="[^"]+"\s+label="[^"]+"|label="[^"]+"\s+id="[^"]+")\}/;
const FORMULA_BLOCK = /:::formula\{([^\n}]*)\}\n([\s\S]*?)^:::$/gm;

/** Lines starting with :::formula{ that are not a canonical opening tag. */
export function countOrphanFormulaLines(raw: string): number {
  let n = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith(':::formula{') && !CANONICAL_FORMULA_OPEN.test(line)) n++;
  }
  return n;
}
/** Inside `{...}` / JSON: a `}` inside double quotes stays in the value. */
const IMAGE_QUOTED_BRACE_RE = /(?:[^}"\\]|\\.|"(?:[^"\\]|\\.)*")*/;
export const IMAGE_QUOTED_BRACE = IMAGE_QUOTED_BRACE_RE.source;
const IMAGE_BLOCK = new RegExp(
  `:::image\\{(${IMAGE_QUOTED_BRACE})\\}\\s*\\n?:::`,
  'g',
);
const IMAGE_MARKER = new RegExp(`<!--IMAGE:(\\{${IMAGE_QUOTED_BRACE}\\})-->`, 'g');
const EXERCISE_OPEN = /:::exercise\{([^}]+)\}\n/g;
/** `:::hint`, `:::solution`, `:::exercise`, a box such as `:::proof`, or any `:::name{...}` such as `:::image{...}`. */
const BLOCK_OPEN_LINE =
  /^:::(?:(?:exercise|hint|solution|definition|theorem|proof|example|mistake|remark)(?=[{\s]|$)|[a-z][\w-]*\{)/;
/** `:::image{...} :::` on one line opens and closes itself. */
const SELF_CLOSED_LINE = /\}[ \t]*:::[ \t]*$/;
const PARA_HEADER = /^## (p\d+) \| (.+)$/gm;
const FRONTMATTER_BLOCK = /^---[\s\S]*?---\n*/;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/;

/** CRLF and lone CR become LF, so files saved on Windows parse like the rest. */
export function normalizeNewlines(raw: string): string {
  return raw.replace(/\r\n?/g, '\n');
}

export interface ImageRef {
  src: string;
  alt: string;
  caption?: string;
}

function parseImageAttrs(attrs: string): ImageRef | null {
  const src = attrs.match(/src="([^"]+)"/)?.[1];
  const alt = attrs.match(/alt="([^"]+)"/)?.[1];
  const caption = attrs.match(/caption="([^"]+)"/)?.[1];
  if (!src || !alt) return null;
  return { src, alt, caption };
}

function imageMarker(ref: ImageRef): string {
  return `<!--IMAGE:${JSON.stringify(ref)}-->`;
}

export function processImageBlocks(content: string): string {
  return content.replace(IMAGE_BLOCK, (full, attrs: string) => {
    const ref = parseImageAttrs(attrs);
    return ref ? imageMarker(ref) : full;
  });
}

export function extractImageRefs(content: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const match of content.matchAll(IMAGE_BLOCK)) {
    const ref = parseImageAttrs(match[1]);
    if (ref) refs.push(ref);
  }
  for (const match of content.matchAll(IMAGE_MARKER)) {
    try {
      const parsed = JSON.parse(match[1]) as ImageRef;
      if (parsed.src && parsed.alt) refs.push(parsed);
    } catch { /* */ }
  }
  return refs;
}

export function hasExternalImageMarkdown(content: string): boolean {
  return MARKDOWN_IMAGE.test(content);
}

function readFormulaAttrs(attrs: string): { id: string; label: string } | null {
  if (!CANONICAL_FORMULA_OPEN.test(`:::formula{${attrs}}`)) return null;
  const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
  const label = /\blabel="([^"]+)"/.exec(attrs)?.[1];
  if (!id || !label) return null;
  return { id, label };
}

export function parseChapterMarkdown(raw: string, chapterNumber: number): Chapter {
  const paragraphs: Paragraph[] = [];
  const formulas: FormulaRef[] = [];

  const body = normalizeNewlines(raw).replace(FRONTMATTER_BLOCK, '');

  let formulaContent = body.replace(FORMULA_BLOCK, (full, attrs: string, latex: string) => {
    const parsed = readFormulaAttrs(attrs);
    if (!parsed) return full;
    const [ch, num] = parsed.id.split('.').map(Number);
    formulas.push({
      id: parsed.id,
      chapter: ch,
      number: num,
      label: parsed.label,
      latex: latex.trim(),
    });
    return `<!--FORMULA:${parsed.id}-->`;
  });
  formulaContent = processImageBlocks(formulaContent);

  const headers = [...formulaContent.matchAll(PARA_HEADER)];
  // Text before the first header goes into p1, so nothing is dropped.
  const preamble = headers.length ? formulaContent.slice(0, headers[0].index).trim() : '';
  headers.forEach((match, i) => {
    const start = match.index + match[0].length;
    const content = formulaContent.slice(start, headers[i + 1]?.index ?? formulaContent.length).trim();
    paragraphs.push({
      id: match[1],
      title: match[2].trim(),
      content: i === 0 && preamble ? `${preamble}\n\n${content}`.trim() : content,
    });
  });

  const warnings: string[] = [];
  const orphanFormulas = countOrphanFormulaLines(body);
  if (orphanFormulas > 0) {
    warnings.push(
      `${orphanFormulas} riga/e :::formula non canoniche — usa :::formula{id="X.Y" label="…"}\\n$$…$$\\n:::`,
    );
  }
  if (preamble) {
    warnings.push(`Testo prima di ## ${headers[0][1]}: spostalo dentro un paragrafo`);
  }

  return {
    meta: { id: '', number: chapterNumber, title: '', file: '', printable: true },
    paragraphs,
    formulas,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * True when a line opens a `:::` block, so the next bare `:::` closes it and not the block around it.
 * Shared with validateExercises.
 */
export function opensFence(line: string): boolean {
  return BLOCK_OPEN_LINE.test(line) && !SELF_CLOSED_LINE.test(line);
}

function atLineStart(raw: string, idx: number): boolean {
  return idx === 0 || raw[idx - 1] === '\n';
}

/** Finds the `:::` that closes the block, counting nested blocks at line start (hint, solution, image). */
function findBlockClose(raw: string, bodyStart: number): number {
  let depth = 1;
  let pos = bodyStart;

  while (pos < raw.length) {
    const idx = raw.indexOf(':::', pos);
    if (idx === -1) return -1;
    if (!atLineStart(raw, idx)) {
      pos = idx + 3;
      continue;
    }

    const lineEnd = raw.indexOf('\n', idx);
    const line = raw.slice(idx, lineEnd === -1 ? raw.length : lineEnd);
    if (opensFence(line)) {
      depth++;
      pos = idx + 3;
      continue;
    }
    if (SELF_CLOSED_LINE.test(line)) {
      pos = idx + 3;
      continue;
    }

    depth--;
    if (depth === 0) return idx;
    pos = idx + 3;
  }

  return -1;
}

function readFence(
  body: string,
  name: 'hint' | 'solution',
): { text: string; start: number; end: number } | null {
  const re = new RegExp(`^:::${name}(?:\\{[^\\n]*\\})?[ \\t]*$`, 'm');
  const match = re.exec(body);
  if (!match) return null;
  let contentStart = match.index + match[0].length;
  if (body[contentStart] === '\n') contentStart += 1;
  const closeIdx = findBlockClose(body, contentStart);
  const end = closeIdx === -1 ? body.length : closeIdx + 3;
  const text = body.slice(contentStart, closeIdx === -1 ? body.length : closeIdx).trim();
  return { text, start: match.index, end };
}

export function parseExercises(raw: string, defaultType: 'esercizio' | 'esame' = 'esercizio'): Exercise[] {
  const body = normalizeNewlines(raw).replace(FRONTMATTER_BLOCK, '');
  const exercises: Exercise[] = [];
  const openRe = new RegExp(EXERCISE_OPEN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(body)) !== null) {
    const attrs = match[1];
    const bodyStart = match.index + match[0].length;
    const closeIdx = findBlockClose(body, bodyStart);
    const exerciseBody = (closeIdx === -1 ? body.slice(bodyStart) : body.slice(bodyStart, closeIdx)).trim();

    const id = attrs.match(/id="([^"]+)"/)?.[1] ?? '';
    const chapter = attrs.match(/chapter="(\d+)"/)?.[1];
    const difficulty = attrs.match(/difficulty="([^"]+)"/)?.[1] as Exercise['difficulty'];
    const type = attrs.match(/type="([^"]+)"/)?.[1] as 'esercizio' | 'esame' | undefined;

    const hint = readFence(exerciseBody, 'hint');
    const solution = readFence(exerciseBody, 'solution');
    let question = exerciseBody;
    for (const span of [hint, solution].filter((s) => s !== null).sort((a, b) => b.start - a.start)) {
      question = question.slice(0, span.start) + question.slice(span.end);
    }
    question = question.replace(/^## Domanda\n/, '').trim();

    exercises.push({
      id,
      chapter: chapter ? Number(chapter) : undefined,
      type: type ?? defaultType,
      question,
      hint: hint?.text,
      solution: solution?.text,
      difficulty,
    });

    openRe.lastIndex = closeIdx === -1 ? body.length : closeIdx + 3;
  }

  return exercises;
}

export function buildFormulaIndex(chapters: Chapter[]): Map<string, FormulaRef> {
  const index = new Map<string, FormulaRef>();
  for (const ch of chapters) {
    for (const f of ch.formulas) {
      index.set(f.id, f);
    }
  }
  return index;
}

/** {{formula:1.2}} → hover tooltip marker */
export function processInlineRefs(content: string): string {
  return content.replace(/\{\{formula:([\d.]+)\}\}/g, '[[hover:$1]]');
}

/** [text](ref:formula/1.2) or [text](ref:chapter/2#p1) */
export function processLinks(content: string): string {
  return content.replace(
    /\[([^\]]+)\]\(ref:(formula\/[\d.]+|chapter\/\d+#p\d+)\)/g,
    '[[link:$2|$1]]'
  );
}

export function preprocessContent(content: string): string {
  return processLinks(processInlineRefs(processImageBlocks(content)));
}

/** Box blocks of chapter text (content format 1.3). The reader draws each one as a box. */
export const BOX_NAMES = ['definition', 'theorem', 'proof', 'example', 'mistake', 'remark'] as const;
export type BoxName = (typeof BOX_NAMES)[number];
/** Values of `kind` on a `:::theorem`. Without `kind` it is a plain theorem. */
export const THEOREM_KINDS = ['proposition', 'corollary', 'lemma'] as const;
export type TheoremKind = (typeof THEOREM_KINDS)[number];

const BOX_NAME_GROUP = BOX_NAMES.join('|');
/** `:::name` or `:::name{attrs}`, alone on its line. The attributes run to the last `}`, so a title may hold `}`. */
const BOX_OPEN = new RegExp(`^:::(${BOX_NAME_GROUP})(?:\\{(.*)\\})?[ \\t]*$`);
/** Lines that start like a box opening, valid or not. The validator reports the invalid ones. */
export const BOX_OPEN_LIKE = new RegExp(`^:::(?:${BOX_NAME_GROUP})(?![\\w-])`);
const BOX_CLOSE = /^:::[ \t]*$/;
const BOX_ATTRS = /^(?:[ \t]*[A-Za-z][\w-]*="[^"\n]*")*[ \t]*$/;
const BOX_ATTR = /([A-Za-z][\w-]*)="([^"\n]*)"/g;

export interface BoxOpening {
  name: BoxName;
  /** Each `name="value"` pair. When a name repeats, the first value wins. */
  attrs: Record<string, string>;
  /** False when the text inside `{…}` is not a list of `name="value"` pairs. */
  attrsValid: boolean;
}

export function readBoxOpening(line: string): BoxOpening | null {
  const m = BOX_OPEN.exec(line);
  if (!m) return null;
  const raw = m[2] ?? '';
  const attrs: Record<string, string> = {};
  for (const [, key, value] of raw.matchAll(BOX_ATTR)) {
    if (!(key in attrs)) attrs[key] = value;
  }
  return { name: m[1] as BoxName, attrs, attrsValid: BOX_ATTRS.test(raw) };
}

export interface BoxSpan extends BoxOpening {
  /** Line index of the opening line. */
  open: number;
  /** Line index of the closing `:::`, or -1 when the block is not closed and runs to the last line. */
  close: number;
  /** The `:::proof` attached to a theorem. */
  proof?: BoxSpan;
}

/** Line after the box, or after its attached proof. */
export function boxEnd(span: BoxSpan, lineCount: number): number {
  const last = span.proof ?? span;
  return last.close === -1 ? lineCount : last.close + 1;
}

/** A line that opens a block inside a box: another box, or a fence such as a non-canonical `:::formula{…}`. */
function opensNested(line: string): boolean {
  return BOX_OPEN.test(line) || (opensFence(line) && !BOX_OPEN_LIKE.test(line));
}

function findBoxClose(lines: string[], from: number): number {
  let depth = 1;
  for (let i = from; i < lines.length; i++) {
    if (opensNested(lines[i])) depth++;
    else if (BOX_CLOSE.test(lines[i]) && --depth === 0) return i;
  }
  return -1;
}

/**
 * The top-level boxes in `lines`. `blanked` is the same text with code replaced by spaces
 * (blankCode in renderContent), so a `:::` inside a code block is not read as a fence.
 */
export function scanBoxes(lines: string[], blanked: string[] = lines): BoxSpan[] {
  const spans: BoxSpan[] = [];
  const spanAt = (i: number): BoxSpan | null => {
    const opening = BOX_OPEN.test(blanked[i]) ? readBoxOpening(lines[i]) : null;
    return opening && { ...opening, open: i, close: findBoxClose(blanked, i + 1) };
  };

  let i = 0;
  while (i < lines.length) {
    const span = spanAt(i);
    if (!span) {
      i++;
      continue;
    }
    if (span.name === 'theorem' && span.close !== -1) {
      let j = span.close + 1;
      // Blank in the source: a code block, blanked for fence matching, is not a blank line.
      while (j < lines.length && !lines[j].trim()) j++;
      const proof = j < lines.length ? spanAt(j) : null;
      if (proof?.name === 'proof') span.proof = proof;
    }
    spans.push(span);
    i = boxEnd(span, lines.length);
  }
  return spans;
}

/** True when the text has a box opening line, ignoring code. Pass text with code blanked. */
export function hasBoxOpening(blankedText: string): boolean {
  return blankedText.split('\n').some((line) => BOX_OPEN.test(line));
}
