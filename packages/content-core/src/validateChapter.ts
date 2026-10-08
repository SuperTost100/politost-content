import katex from 'katex';
import { isValidAssetPath, validateAssetSizes } from './assetResolver';
import type { FormulaRef, IdeSnippet } from './types/smartbook';
import { validateExercises } from './validateExercises';
import {
  CANONICAL_FORMULA_OPEN,
  IMAGE_QUOTED_BRACE,
  buildFormulaIndex,
  extractImageRefs,
  hasExternalImageMarkdown,
  normalizeNewlines,
  parseChapterMarkdown,
  parseExercises,
} from './parser';
import { blankCode } from './renderContent';
import { validateBookMeta, type BookMeta } from './bookMeta';

const IMAGE_BLOCK = new RegExp(`:::image\\{(${IMAGE_QUOTED_BRACE})\\}`, 'g');
const REF_LINK = /\[([^\]]+)\]\(ref:(formula\/[\d.]+|chapter\/(\d+)#(p\d+))\)/g;
const HOVER_REF = /\{\{formula:([\d.]+)\}\}/g;
const FORMULA_ID = /^(\d+)\.(\d+)$/;
const SHORTHAND_FORMULA = /^:::formula\{(?![^}]*\bid=)[^}]+\}\s*$/gm;
const META_HEADING = /(Riepilogo|Sintesi|Sommario|Riassunto)\s+del\s+lavoro\s+svolto/i;
const META_LINE =
  /(Il testo sorgente è stato|Ho riscritto|Sono stati inseriti \d+ blocchi|NON includere)/i;
/** Tool-call / wrapper tags a generator leaked into the text (e.g. `</markdown>`, `</invoke>`). */
const TOOL_MARKUP = /<\/?(?:markdown|invoke|parameter|function_calls|antml:[\w-]+|tool_use|tool_result)(?=[\s/>])[^>]*>/i;

export type ValidateProfile = 'ship' | 'dev';

export interface ValidateChapterOptions {
  /** ship = strict gates; dev = same checks as warnings. */
  profile?: ValidateProfile;
  /** Alias for profile === 'ship'. */
  strict?: boolean;
  /** When set, :::image src must exist in this set (assets/… paths). */
  availableAssets?: Set<string>;
  /** Whole-book ids from buildFormulaIndex. A hover or ref:formula/ hit in this map is not missing. */
  bookFormulaIndex?: Map<string, FormulaRef>;
  /** Paragraph ids by chapter number, to check ref:chapter/N#pM links to other chapters. */
  bookParagraphs?: Map<number, Set<string>>;
}

export interface BundleValidateOptions {
  profile?: ValidateProfile;
  strict?: boolean;
}

function shipMode(options?: ValidateChapterOptions | BundleValidateOptions): boolean {
  return options?.strict === true || options?.profile === 'ship';
}

/** Bundles default to ship gates (mirror ptsb-pack); override with profile: 'dev'. */
function bundleShipMode(options?: BundleValidateOptions): boolean {
  if (options?.strict !== undefined) return options.strict;
  if (options?.profile !== undefined) return options.profile === 'ship';
  return true;
}

function pushFinding(
  errors: string[],
  warnings: string[],
  message: string,
  strict: boolean,
): void {
  (strict ? errors : warnings).push(message);
}

function validateImagesInContent(
  content: string,
  context: string,
  errors: string[],
  warnings: string[],
  strict: boolean,
  availableAssets?: Set<string>,
): void {
  if (hasExternalImageMarkdown(blankCode(content))) {
    errors.push(`${context}: immagini markdown non consentite — usa un blocco :::image`);
  }

  // extractImageRefs sees the blocks again, so collect first and report each path once.
  const missing = new Set<string>();
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
    if (availableAssets && !availableAssets.has(src)) missing.add(src);
  }

  for (const ref of extractImageRefs(content)) {
    if (availableAssets && !availableAssets.has(ref.src)) missing.add(ref.src);
  }
  for (const src of missing) {
    pushFinding(errors, warnings, `${context}: asset mancante "${src}"`, strict);
  }
}

/** Always an error, in every profile: leaked markup means the generator output was not cleaned. */
function validateNoToolMarkup(raw: string, context: string, errors: string[]): void {
  for (const [i, line] of raw.split('\n').entries()) {
    const m = line.match(TOOL_MARKUP);
    if (m) errors.push(`${context}, riga ${i + 1}: markup del generatore non rimosso "${m[0]}"`);
  }
}

function validateContentQuality(
  raw: string,
  errors: string[],
  warnings: string[],
  strict: boolean,
): void {
  const shorthand = [...raw.matchAll(SHORTHAND_FORMULA)];
  for (const m of shorthand) {
    pushFinding(
      errors,
      warnings,
      `Formula shorthand non valida: ${m[0].trim()}`,
      strict,
    );
  }

  for (const [i, line] of raw.split('\n').entries()) {
    if ((line.match(/\*\*/g) ?? []).length % 2 !== 0) {
      pushFinding(
        errors,
        warnings,
        `Riga ${i + 1}: marcatori ** non accoppiati`,
        strict,
      );
    }
    if (META_HEADING.test(line) || META_LINE.test(line)) {
      pushFinding(
        errors,
        warnings,
        `Riga ${i + 1}: testo meta LLM non consentito`,
        strict,
      );
    }
  }
}

/** `findings` is the errors list, or the warnings list where invalid LaTeX must not block a book. */
function validateLatex(latex: string, context: string, findings: string[]): void {
  const blocks = [...latex.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1].trim());
  const inlines = [...latex.matchAll(/(?<!\$)\$([^$\n]+)\$/g)].map((m) => m[1].trim());

  for (const block of blocks) {
    try {
      katex.renderToString(block, { throwOnError: true, displayMode: true });
    } catch (e) {
      findings.push(`${context}: LaTeX display invalido — ${(e as Error).message}`);
    }
  }
  for (const inline of inlines) {
    try {
      katex.renderToString(inline, { throwOnError: true, displayMode: false });
    } catch (e) {
      findings.push(`${context}: LaTeX inline invalido — ${(e as Error).message}`);
    }
  }
}

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

export function validateChapter(
  raw: string,
  chapterNumber: number,
  options?: ValidateChapterOptions,
): ChapterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = shipMode(options);
  const availableAssets = options?.availableAssets;
  raw = normalizeNewlines(raw);

  const parsed = parseChapterMarkdown(raw, chapterNumber);
  if (parsed.warnings?.length) warnings.push(...parsed.warnings);

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
    validateLatex(blankCode(p.content), `Paragrafo ${p.id}`, errors);
  }

  validateImagesInContent(raw, 'Capitolo', errors, warnings, strict, availableAssets);
  validateContentQuality(blankCode(raw), errors, warnings, strict);
  validateNoToolMarkup(raw, 'Capitolo', errors);

  const formulaOpenRe = new RegExp(CANONICAL_FORMULA_OPEN.source, 'gm');
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

  const knownFormula = (id: string) => formulaIds.has(id) || options?.bookFormulaIndex?.has(id) === true;
  for (const p of parsed.paragraphs) {
    const content = blankCode(p.content);
    for (const m of content.matchAll(HOVER_REF)) {
      const id = m[1];
      if (!knownFormula(id)) {
        pushFinding(
          errors,
          warnings,
          `Paragrafo ${p.id}: riferimento hover {{formula:${id}}} non trovato`,
          strict,
        );
      }
    }
    for (const m of content.matchAll(REF_LINK)) {
      const ref = m[2];
      if (ref.startsWith('formula/')) {
        const id = ref.replace('formula/', '');
        if (!knownFormula(id)) {
          pushFinding(
            errors,
            warnings,
            `Paragrafo ${p.id}: link ref:${ref} — formula assente nel capitolo`,
            strict,
          );
        }
      } else if (ref.startsWith('chapter/')) {
        const chNum = Number(m[3]);
        const paraId = m[4];
        const target = chNum === chapterNumber ? paraIds : options?.bookParagraphs?.get(chNum);
        if ((chNum === chapterNumber || options?.bookParagraphs) && !target?.has(paraId)) {
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
const SECTION_KEYS = ['smartbook', 'formulario', 'esercizi', 'esami', 'ide', 'grafici', 'risposte'];

type BundleChapter = { id?: unknown; file: string; number: number };

/** Broken chapter entries are errors. Missing sections are warnings: Pyxis and others open books without them. */
function validateConfigShape(
  config: { sections?: unknown },
  chapters: BundleChapter[],
  errors: string[],
  warnings: string[],
): void {
  const seen: Record<'id' | 'number' | 'file', Set<unknown>> = { id: new Set(), number: new Set(), file: new Set() };
  for (const [i, ch] of chapters.entries()) {
    if (!ch || typeof ch !== 'object') {
      errors.push(`smartbook.json: chapters[${i}] non è un oggetto`);
      continue;
    }
    if (typeof ch.file !== 'string' || !ch.file) {
      errors.push(`smartbook.json: chapters[${i}] senza file`);
    }
    if (!Number.isInteger(ch.number) || ch.number < 1) {
      errors.push(`smartbook.json: chapters[${i}].number deve essere un intero positivo, trovato ${JSON.stringify(ch.number)}`);
    }
    for (const key of ['id', 'number', 'file'] as const) {
      if (ch[key] === undefined) continue;
      if (seen[key].has(ch[key])) errors.push(`smartbook.json: ${key} ripetuto in chapters: ${String(ch[key])}`);
      seen[key].add(ch[key]);
    }
  }

  const sections = config.sections;
  const missing = SECTION_KEYS.filter((key) => {
    const entry = sections && typeof sections === 'object' ? (sections as Record<string, unknown>)[key] : undefined;
    const e = entry as { enabled?: unknown; label?: unknown } | undefined;
    return !e || typeof e.enabled !== 'boolean' || typeof e.label !== 'string';
  });
  if (missing.length) {
    warnings.push(`smartbook.json: sections senza { enabled, label } per ${missing.join(', ')}`);
  }
}

/** Refs, chapter numbers and LaTeX in esercizi.md / esami.md. Warnings only, so existing books still open. */
function validateExerciseRefs(
  raw: string,
  name: string,
  bookParagraphs: Map<number, Set<string>>,
  bookFormulaIndex: Map<string, FormulaRef>,
  warnings: string[],
): void {
  for (const ex of parseExercises(raw)) {
    const context = `${name}: ${ex.id || 'exercise'}`;
    if (ex.chapter !== undefined && !bookParagraphs.has(ex.chapter)) {
      warnings.push(`${context}: chapter="${ex.chapter}" non è un capitolo del libro`);
    }
    const text = blankCode([ex.question, ex.hint ?? '', ex.solution ?? ''].join('\n\n'));
    for (const m of text.matchAll(HOVER_REF)) {
      if (!bookFormulaIndex.has(m[1])) warnings.push(`${context}: riferimento hover {{formula:${m[1]}}} non trovato`);
    }
    for (const m of text.matchAll(REF_LINK)) {
      const found = m[3] === undefined
        ? bookFormulaIndex.has(m[2].replace('formula/', ''))
        : bookParagraphs.get(Number(m[3]))?.has(m[4]) === true;
      if (!found) warnings.push(`${context}: link ref:${m[2]} senza destinazione`);
    }
    validateLatex(text, context, warnings);
  }
}

export interface BundleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBundle(
  config: { id: string; chapters: BundleChapter[]; sections?: unknown } & BookMeta,
  chapterFiles: Record<string, string>,
  assets: Record<string, Uint8Array> = {},
  extras: {
    eserciziRaw?: string;
    esamiRaw?: string;
    ideRaw?: string;
    graficiRaw?: string;
  } = {},
  options?: BundleValidateOptions,
): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = bundleShipMode(options);
  const availableAssets = new Set(Object.keys(assets));

  errors.push(...validateAssetSizes(assets));

  if (!ID_RE.test(config.id)) {
    errors.push(`id smartbook non valido: ${config.id}`);
  }

  const chapters = Array.isArray(config.chapters) ? config.chapters : [];
  if (!chapters.length) {
    errors.push('Nessun capitolo in smartbook.json');
  }
  validateConfigShape(config, chapters, errors, warnings);

  const meta = validateBookMeta(config);
  errors.push(...meta.errors);
  warnings.push(...meta.warnings);

  const parsedChapters = chapters.flatMap((ch) => {
    const raw = ch && chapterFiles[ch.file];
    return raw === undefined ? [] : [parseChapterMarkdown(raw, ch.number)];
  });
  const bookFormulaIndex = buildFormulaIndex(parsedChapters);
  const bookParagraphs = new Map(parsedChapters.map((c) => [c.meta.number, new Set(c.paragraphs.map((p) => p.id))]));

  for (const ch of chapters) {
    if (!ch || typeof ch !== 'object') continue;
    const raw = chapterFiles[ch.file];
    if (raw === undefined) {
      errors.push(`File capitolo mancante: ${ch.file}`);
      continue;
    }
    const result = validateChapter(raw, ch.number, {
      profile: strict ? 'ship' : 'dev',
      availableAssets,
      bookFormulaIndex,
      bookParagraphs,
    });
    errors.push(...result.errors.map((e) => `${ch.file}: ${e}`));
    warnings.push(...result.warnings.map((w) => `${ch.file}: ${w}`));
  }

  if (extras.eserciziRaw) {
    validateImagesInContent(extras.eserciziRaw, 'esercizi.md', errors, warnings, strict, availableAssets);
    validateNoToolMarkup(extras.eserciziRaw, 'esercizi.md', errors);
    const ex = validateExercises(extras.eserciziRaw, 'esercizi');
    errors.push(...ex.errors.map((e) => `esercizi.md: ${e}`));
    warnings.push(...ex.warnings.map((w) => `esercizi.md: ${w}`));
    validateExerciseRefs(extras.eserciziRaw, 'esercizi.md', bookParagraphs, bookFormulaIndex, warnings);
  }
  if (extras.esamiRaw) {
    validateImagesInContent(extras.esamiRaw, 'esami.md', errors, warnings, strict, availableAssets);
    validateNoToolMarkup(extras.esamiRaw, 'esami.md', errors);
    const ex = validateExercises(extras.esamiRaw, 'esami');
    errors.push(...ex.errors.map((e) => `esami.md: ${e}`));
    warnings.push(...ex.warnings.map((w) => `esami.md: ${w}`));
    validateExerciseRefs(extras.esamiRaw, 'esami.md', bookParagraphs, bookFormulaIndex, warnings);
  }
  if (extras.graficiRaw) validateGraficiRaw(extras.graficiRaw, errors);
  if (extras.ideRaw) validateIdeRaw(extras.ideRaw, errors);

  return { valid: errors.length === 0, errors, warnings };
}

function validateGraficiRaw(raw: string, errors: string[]): void {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push(`grafici.json: JSON non valido — ${(e as Error).message}`);
    return;
  }
  if (!Array.isArray(data)) {
    errors.push('grafici.json: atteso un array');
    return;
  }
  for (const [i, item] of data.entries()) {
    const type = item && typeof item === 'object' ? (item as { type?: unknown }).type : undefined;
    if (type !== 'function' && type !== 'plotly') {
      errors.push(`grafici.json[${i}]: type "${String(type)}" non valido — atteso function o plotly`);
    }
  }
}

function validateIdeRaw(raw: string, errors: string[]): void {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push(`ide.json: JSON non valido — ${(e as Error).message}`);
    return;
  }
  if (!Array.isArray(data)) {
    errors.push('ide.json: atteso un array');
    return;
  }
  for (const [i, item] of data.entries()) {
    const snippet = item as Partial<IdeSnippet> | null;
    if (
      !snippet ||
      typeof snippet !== 'object' ||
      typeof snippet.id !== 'string' ||
      typeof snippet.title !== 'string' ||
      typeof snippet.language !== 'string' ||
      typeof snippet.code !== 'string'
    ) {
      errors.push(`ide.json[${i}]: snippet non conforme a IdeSnippet`);
    }
  }
}
