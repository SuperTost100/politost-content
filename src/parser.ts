import type { Chapter, Exercise, FormulaRef, Paragraph } from './types/smartbook';

const FORMULA_BLOCK = /:::formula\{id="([^"]+)"\s+label="([^"]+)"\}\n([\s\S]*?):::/g;
const IMAGE_BLOCK = /:::image\{([^}]+)\}\s*\n?:::/g;
const EXERCISE_OPEN = /:::exercise\{([^}]+)\}\n/g;
const BLOCK_OPEN = /^(exercise|hint|solution)(\{|\s)/;
const PARA_HEADER = /^## (p\d+) \| (.+)$/gm;
const EXTERNAL_IMAGE_MD = /!\[[^\]]*\]\((?:https?:\/\/|data:|\/\/)/;

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
  return content.replace(IMAGE_BLOCK, (_, attrs) => {
    const ref = parseImageAttrs(attrs);
    return ref ? imageMarker(ref) : '';
  });
}

export function extractImageRefs(content: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const match of content.matchAll(IMAGE_BLOCK)) {
    const ref = parseImageAttrs(match[1]);
    if (ref) refs.push(ref);
  }
  for (const match of content.matchAll(/<!--IMAGE:({[^}]+})-->/g)) {
    try {
      const parsed = JSON.parse(match[1]) as ImageRef;
      if (parsed.src && parsed.alt) refs.push(parsed);
    } catch { /* */ }
  }
  return refs;
}

export function hasExternalImageMarkdown(content: string): boolean {
  return EXTERNAL_IMAGE_MD.test(content);
}

export function parseChapterMarkdown(raw: string, chapterNumber: number): Chapter {
  const paragraphs: Paragraph[] = [];
  const formulas: FormulaRef[] = [];

  const body = raw.replace(/^---[\s\S]*?---\n*/, '');

  let formulaContent = body
    .replace(FORMULA_BLOCK, (_, id, label, latex) => {
      const [ch, num] = id.split('.').map(Number);
      formulas.push({ id, chapter: ch, number: num, label, latex: latex.trim() });
      return `<!--FORMULA:${id}-->`;
    });
  formulaContent = processImageBlocks(formulaContent);

  const headers = [...body.matchAll(PARA_HEADER)];
  const parts = formulaContent.split(/^## p\d+ \| /m).filter(Boolean);

  headers.forEach((match, i) => {
    paragraphs.push({
      id: match[1],
      title: match[2],
      content: parts[i]?.trim() ?? '',
    });
  });

  return {
    meta: { id: '', number: chapterNumber, title: '', file: '', printable: true },
    paragraphs,
    formulas,
  };
}

/** Trova la chiusura `:::` bilanciando blocchi annidati (hint, solution) */
function findBlockClose(raw: string, bodyStart: number): number {
  let depth = 1;
  let pos = bodyStart;

  while (pos < raw.length) {
    const idx = raw.indexOf(':::', pos);
    if (idx === -1) return -1;

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

export function parseExercises(raw: string, defaultType: 'esercizio' | 'esame' = 'esercizio'): Exercise[] {
  const body = raw.replace(/^---[\s\S]*?---\n*/, '');
  const exercises: Exercise[] = [];
  const openRe = new RegExp(EXERCISE_OPEN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(body)) !== null) {
    const attrs = match[1];
    const bodyStart = match.index + match[0].length;
    const closeIdx = findBlockClose(body, bodyStart);
    if (closeIdx === -1) continue;

    const exerciseBody = body.slice(bodyStart, closeIdx).trim();

    const id = attrs.match(/id="([^"]+)"/)?.[1] ?? '';
    const chapter = attrs.match(/chapter="(\d+)"/)?.[1];
    const difficulty = attrs.match(/difficulty="([^"]+)"/)?.[1] as Exercise['difficulty'];
    const type = attrs.match(/type="([^"]+)"/)?.[1] as 'esercizio' | 'esame' | undefined;

    const hintMatch = exerciseBody.match(/:::hint\n([\s\S]*?):::/);
    const solutionMatch = exerciseBody.match(/:::solution\n([\s\S]*?):::/);
    const question = exerciseBody
      .replace(/:::hint\n[\s\S]*?:::/g, '')
      .replace(/:::solution\n[\s\S]*?:::/g, '')
      .replace(/^## Domanda\n/, '')
      .trim();

    exercises.push({
      id,
      chapter: chapter ? Number(chapter) : undefined,
      type: type ?? defaultType,
      question,
      hint: hintMatch?.[1].trim(),
      solution: solutionMatch?.[1].trim(),
      difficulty,
    });

    openRe.lastIndex = closeIdx + 3;
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
