import katex from 'katex';
import { isValidAssetPath, validateAssetSizes } from './assetResolver';
import { extractImageRefs, hasExternalImageMarkdown, parseChapterMarkdown } from './parser';

const IMAGE_BLOCK = /:::image\{([^}]+)\}/g;

function validateImagesInContent(
  content: string,
  context: string,
  errors: string[],
  availableAssets?: Set<string>,
): void {
  if (hasExternalImageMarkdown(content)) {
    errors.push(`${context}: immagini con URL esterni non consentite — usa :::image con file in assets/`);
  }

  for (const match of content.matchAll(IMAGE_BLOCK)) {
    const attrs = match[1];
    const src = attrs.match(/src="([^"]+)"/)?.[1];
    const alt = attrs.match(/alt="([^"]+)"/)?.[1];
    if (!src) {
      errors.push(`${context}: blocco :::image senza attributo src`);
      continue;
    }
    if (!alt?.trim()) {
      errors.push(`${context}: blocco :::image senza attributo alt`);
    }
    if (!isValidAssetPath(src)) {
      errors.push(`${context}: percorso immagine non valido "${src}" — usa assets/nome.ext`);
    }
    if (availableAssets && !availableAssets.has(src)) {
      errors.push(`${context}: asset mancante "${src}"`);
    }
  }

  for (const ref of extractImageRefs(content)) {
    if (availableAssets && !availableAssets.has(ref.src)) {
      errors.push(`${context}: asset mancante "${ref.src}"`);
    }
  }
}
const REF_LINK = /\[([^\]]+)\]\(ref:(formula\/[\d.]+|chapter\/(\d+)#(p\d+))\)/g;
const HOVER_REF = /\{\{formula:([\d.]+)\}\}/g;
const FORMULA_ID = /^(\d+)\.(\d+)$/;

export interface ChapterValidationResult {
  valid: boolean;
  chapterNumber: number;
  paragraphCount: number;
  formulaCount: number;
  errors: string[];
  warnings: string[];
  paragraphs: { id: string; title: string }[];
  formulas: { id: string; label: string }[];
}

function validateLatex(latex: string, context: string, errors: string[]): void {
  const blocks = [...latex.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1].trim());
  const inlines = [...latex.matchAll(/(?<!\$)\$([^$\n]+)\$/g)].map((m) => m[1].trim());

  for (const block of blocks) {
    try {
      katex.renderToString(block, { throwOnError: true, displayMode: true });
    } catch (e) {
      errors.push(`${context}: LaTeX display invalido — ${(e as Error).message}`);
    }
  }
  for (const inline of inlines) {
    try {
      katex.renderToString(inline, { throwOnError: true, displayMode: false });
    } catch (e) {
      errors.push(`${context}: LaTeX inline invalido — ${(e as Error).message}`);
    }
  }
}

export function validateChapter(raw: string, chapterNumber: number): ChapterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = parseChapterMarkdown(raw, chapterNumber);

  if (parsed.paragraphs.length === 0) {
    errors.push('Nessun paragrafo trovato — formato richiesto: ## pN | titolo');
  }

  const paraIds = new Set<string>();
  for (const p of parsed.paragraphs) {
    if (paraIds.has(p.id)) {
      errors.push(`ID paragrafo duplicato: ${p.id}`);
    }
    paraIds.add(p.id);
    if (!/^p\d+$/.test(p.id)) {
      errors.push(`ID paragrafo non valido: ${p.id}`);
    }
    validateLatex(p.content, `Paragrafo ${p.id}`, errors);
    validateImagesInContent(p.content, `Paragrafo ${p.id}`, errors);
  }

  validateImagesInContent(raw, 'Capitolo', errors);

  const formulaOpenRe = /:::formula\{id="[^"]+"\s+label="[^"]+"\}/g;
  const openCount = [...raw.matchAll(formulaOpenRe)].length;
  if (openCount > parsed.formulas.length) {
    errors.push(
      `Trovati ${openCount} apertura/e :::formula ma solo ${parsed.formulas.length} blocchi validi — ` +
        'ogni formula richiede righe separate: :::formula{id="X.Y" label="..."}\\n$$...$$\\n:::',
    );
  }
  for (const m of raw.matchAll(/:::formula\{[^}]+\}[^\n]*\$\$/g)) {
    if (!m[0].includes('\n')) {
      errors.push(
        `Blocco formula malformato (tutto su una riga): ${m[0].slice(0, 80)}… — ` +
          'usa :::formula su una riga, $$...$$ sulle righe successive, ::: di chiusura',
      );
    }
  }

  const formulaIds = new Set<string>();
  for (const f of parsed.formulas) {
    if (formulaIds.has(f.id)) {
      errors.push(`ID formula duplicato: ${f.id}`);
    }
    formulaIds.add(f.id);

    const m = FORMULA_ID.exec(f.id);
    if (!m) {
      errors.push(`ID formula malformato: ${f.id}`);
      continue;
    }
    const ch = Number(m[1]);
    if (ch !== chapterNumber) {
      errors.push(`Formula ${f.id} appartiene al capitolo ${ch}, atteso ${chapterNumber}`);
    }
    validateLatex(f.latex, `Formula ${f.id}`, errors);
  }

  for (const p of parsed.paragraphs) {
    for (const m of p.content.matchAll(HOVER_REF)) {
      const id = m[1];
      if (!formulaIds.has(id)) {
        warnings.push(`Paragrafo ${p.id}: riferimento hover {{formula:${id}}} non trovato nel capitolo`);
      }
    }
    for (const m of p.content.matchAll(REF_LINK)) {
      const ref = m[2];
      if (ref.startsWith('formula/')) {
        const id = ref.replace('formula/', '');
        if (!formulaIds.has(id)) {
          warnings.push(`Paragrafo ${p.id}: link ref:${ref} — formula assente nel capitolo`);
        }
      } else if (ref.startsWith('chapter/')) {
        const chNum = Number(m[3]);
        const paraId = m[4];
        if (chNum === chapterNumber && !paraIds.has(paraId)) {
          warnings.push(`Paragrafo ${p.id}: link ref:${ref} — paragrafo ${paraId} assente`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    chapterNumber,
    paragraphCount: parsed.paragraphs.length,
    formulaCount: parsed.formulas.length,
    errors,
    warnings,
    paragraphs: parsed.paragraphs.map((p) => ({ id: p.id, title: p.title })),
    formulas: parsed.formulas.map((f) => ({ id: f.id, label: f.label })),
  };
}

const ID_RE = /^[a-z0-9-]+$/;

export interface BundleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBundle(
  config: { id: string; chapters: { file: string; number: number }[] },
  chapterFiles: Record<string, string>,
  assets: Record<string, Uint8Array> = {},
  extras: { eserciziRaw?: string; esamiRaw?: string } = {},
): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const availableAssets = new Set(Object.keys(assets));

  errors.push(...validateAssetSizes(assets));

  if (!ID_RE.test(config.id)) {
    errors.push(`id smartbook non valido: ${config.id}`);
  }

  if (!config.chapters?.length) {
    errors.push('Nessun capitolo in smartbook.json');
  }

  for (const ch of config.chapters ?? []) {
    const raw = chapterFiles[ch.file];
    if (raw === undefined) {
      errors.push(`File capitolo mancante: ${ch.file}`);
      continue;
    }
    const result = validateChapter(raw, ch.number);
    errors.push(...result.errors.map((e) => `${ch.file}: ${e}`));
    warnings.push(...result.warnings.map((w) => `${ch.file}: ${w}`));
    for (const ref of extractImageRefs(raw)) {
      if (!availableAssets.has(ref.src)) {
        errors.push(`${ch.file}: asset mancante "${ref.src}"`);
      }
    }
  }

  if (extras.eserciziRaw) {
    validateImagesInContent(extras.eserciziRaw, 'esercizi.md', errors, availableAssets);
  }
  if (extras.esamiRaw) {
    validateImagesInContent(extras.esamiRaw, 'esami.md', errors, availableAssets);
  }

  return { valid: errors.length === 0, errors, warnings };
}
