import { renderKatex, renderKatexChecked } from './decimalComma';
import type { FormulaRef } from './types/smartbook';
import { escapeHtml, sanitizeHtml } from './sanitizeHtml';
import { sanitizeAroundMath, trustedMathSlot, type RenderOptions } from './trustedMath';

export function extractDisplayTex(latex: string): string {
  const match = latex.match(/\$\$([\s\S]*?)\$\$/);
  return match?.[1]?.trim() ?? '';
}

export function renderDisplayTex(tex: string): string {
  try {
    return renderKatex(tex, true);
  } catch {
    return escapeHtml(tex);
  }
}

/** Render a numbered formula's display LaTeX to HTML, not sanitized */
export function renderFormulaLatex(latex: string): string {
  const tex = extractDisplayTex(latex).trim();
  // ponytail: long \text{...} prose in display math won't wrap in KaTeX — emit plain HTML
  const prose = textOnlyBody(tex);
  if (prose !== null) {
    return `<p class="formula-prose">${escapeHtml(prose)}</p>`;
  }
  return renderDisplayTex(tex);
}

/**
 * renderFormulaLatex with a clean KaTeX result pushed onto `katex` and replaced by its
 * placeholder, for sanitizeAroundMath. Prose and failed formulas stay in the HTML.
 */
function formulaLatexSlotted(latex: string, katex: string[]): string {
  const tex = extractDisplayTex(latex).trim();
  const prose = textOnlyBody(tex);
  if (prose !== null) return `<p class="formula-prose">${escapeHtml(prose)}</p>`;
  let out: { html: string; error: boolean };
  try {
    out = renderKatexChecked(tex, true);
  } catch {
    return escapeHtml(tex);
  }
  if (out.error) return out.html;
  katex.push(out.html);
  return trustedMathSlot(katex.length - 1);
}

/** renderFormulaLatex, sanitized: the HTML of a formula card or popover. */
export function renderFormulaHtml(latex: string, options: RenderOptions = {}): string {
  if (options.mathTrusted) {
    const katex: string[] = [];
    const html = sanitizeAroundMath(formulaLatexSlotted(latex, katex), katex);
    if (html !== null) return html;
  }
  return sanitizeHtml(renderFormulaLatex(latex));
}

/** Body of `\text{...}` when that group is the whole formula, else null (`\text{a} = b` is math) */
function textOnlyBody(tex: string): string | null {
  if (!tex.startsWith('\\text{')) return null;
  let depth = 0;
  for (let i = '\\text'.length; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '\\') {
      i++;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return i === tex.length - 1 ? tex.slice('\\text{'.length, i) : null;
    }
  }
  return null;
}

export type FormulaRenderVariant = 'screen' | 'print';

/** Full HTML for a numbered formula block */
export function renderNumberedFormulaHtml(
  formula: FormulaRef,
  _variant: FormulaRenderVariant = 'screen',
  options: RenderOptions = {},
): string {
  const page = (body: string) =>
    `<div class="formula-header"><span class="formula-num">(${escapeHtml(formula.id)})</span> ${escapeHtml(formula.label)}</div>` +
    `<div class="formula-body">${body}</div>`;
  if (options.mathTrusted) {
    const katex: string[] = [];
    const html = sanitizeAroundMath(page(formulaLatexSlotted(formula.latex, katex)), katex);
    if (html !== null) return html;
  }
  return sanitizeHtml(page(renderFormulaLatex(formula.latex)));
}
