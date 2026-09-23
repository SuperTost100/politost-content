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
const BLOCK_OPEN = /^(exercise|hint|solution)(\{|\s)/;
const PARA_HEADER = /^## (p\d+) \| (.+)$/gm;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/;

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

  const body = raw.replace(/^---[\s\S]*?---\n*/, '');

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

  const headers = [...body.matchAll(PARA_HEADER)];
  const parts = formulaContent.split(/^## p\d+ \| /m).filter(Boolean);

  headers.forEach((match, i) => {
    paragraphs.push({
      id: match[1],
      title: match[2],
      content: withoutLeadingTitle(parts[i] ?? '', match[2]),
    });
  });

  const warnings: string[] = [];
  const orphanFormulas = countOrphanFormulaLines(body);
  if (orphanFormulas > 0) {
    warnings.push(
      `${orphanFormulas} riga/e :::formula non canoniche — usa :::formula{id="X.Y" label="…"}\\n$$…$$\\n:::`,
    );
  }

  return {
    meta: { id: '', number: chapterNumber, title: '', file: '', printable: true },
    paragraphs,
    formulas,
    warnings: warnings.length ? warnings : undefined,
  };
}

function withoutLeadingTitle(part: string, title: string): string {
  const trimmed = part.trim();
  const nl = trimmed.indexOf('\n');
  const first = (nl === -1 ? trimmed : trimmed.slice(0, nl)).replace(/\r$/, '');
  if (first !== title) return trimmed;
  return (nl === -1 ? '' : trimmed.slice(nl + 1)).trim();
}

function atLineStart(raw: string, idx: number): boolean {
  return idx === 0 || raw[idx - 1] === '\n';
}

/** Trova la chiusura `:::` bilanciando solo fence a inizio riga (hint, solution). */
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

    const after = raw.slice(idx + 3);
    if (BLOCK_OPEN.test(after)) {
      depth++;
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
  const body = raw.replace(/^---[\s\S]*?---\n*/, '');
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
