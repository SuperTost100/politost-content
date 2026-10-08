import type { Chapter, FormulaRef } from './types/smartbook';
import { IMAGE_QUOTED_BRACE, type ImageRef } from './parser';

const IMAGE_MARKER = new RegExp(`<!--IMAGE:(\\{${IMAGE_QUOTED_BRACE}\\})-->`, 'g');

function restoreImages(content: string): string {
  return content.replace(IMAGE_MARKER, (_, json) => {
    const ref = JSON.parse(json) as ImageRef;
    const cap = ref.caption ? ` caption="${ref.caption}"` : '';
    return `:::image{src="${ref.src}" alt="${ref.alt}"${cap}}\n:::`;
  });
}

function restoreFormulas(content: string, formulas: FormulaRef[]): string {
  let out = content;
  for (const f of formulas) {
    const block = `:::formula{id="${f.id}" label="${f.label}"}\n${f.latex}\n:::`;
    out = out.replace(`<!--FORMULA:${f.id}-->`, block);
  }
  return out;
}

/** Deterministic chapter markdown serializer (content-format contract). */
export function serializeChapter(ch: Chapter, title: string, chapterNumber: number): string {
  const lines = [
    '---',
    `chapter: ${chapterNumber}`,
    `title: ${title}`,
    '---',
    '',
  ];
  for (const p of ch.paragraphs) {
    lines.push(`## ${p.id} | ${p.title}`, '');
    const body = restoreFormulas(restoreImages(p.content), ch.formulas);
    lines.push(body.trimEnd(), '');
  }
  return lines.join('\n').trimEnd() + '\n';
}
