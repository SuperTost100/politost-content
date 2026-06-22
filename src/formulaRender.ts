import katex from 'katex';
import type { FormulaRef } from './types/smartbook';
import { escapeHtml, sanitizeHtml } from './sanitizeHtml';

export function extractDisplayTex(latex: string): string {
  const match = latex.match(/\$\$([\s\S]*?)\$\$/);
  return match?.[1]?.trim() ?? '';
}

export function renderDisplayTex(tex: string): string {
  try {
    return katex.renderToString(tex, { displayMode: true, throwOnError: false });
  } catch {
    return escapeHtml(tex);
  }
}

/** Render a numbered formula's display LaTeX to HTML */
export function renderFormulaLatex(latex: string): string {
  return renderDisplayTex(extractDisplayTex(latex));
}

export type FormulaRenderVariant = 'screen' | 'print';

/** Full HTML for a numbered formula block */
export function renderNumberedFormulaHtml(
  formula: FormulaRef,
  _variant: FormulaRenderVariant = 'screen',
): string {
  const rendered = renderFormulaLatex(formula.latex);

  return sanitizeHtml(
    `<div class="formula-header"><span class="formula-num">(${escapeHtml(formula.id)})</span> ${escapeHtml(formula.label)}</div>` +
      `<div class="formula-body">${rendered}</div>`,
  );
}
