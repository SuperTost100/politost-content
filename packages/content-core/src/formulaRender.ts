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
  const tex = extractDisplayTex(latex).trim();
  // ponytail: long \text{...} prose in display math won't wrap in KaTeX — emit plain HTML
  const prose = textOnlyBody(tex);
  if (prose !== null) {
    return `<p class="formula-prose">${escapeHtml(prose)}</p>`;
  }
  return renderDisplayTex(tex);
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
): string {
  const rendered = renderFormulaLatex(formula.latex);

  return sanitizeHtml(
    `<div class="formula-header"><span class="formula-num">(${escapeHtml(formula.id)})</span> ${escapeHtml(formula.label)}</div>` +
      `<div class="formula-body">${rendered}</div>`,
  );
}
