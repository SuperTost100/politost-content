import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderFormulaLatex } from '../src/formulaRender.ts';

describe('renderFormulaLatex', () => {
  it('renders a formula made only of \\text{...} as wrapping prose', () => {
    assert.equal(renderFormulaLatex('$$\\text{a long sentence}$$'), '<p class="formula-prose">a long sentence</p>');
  });

  it('renders math that starts with \\text{...} and ends with } through KaTeX', () => {
    const html = renderFormulaLatex('$$\\text{limitante} = \\arg\\min_i \\frac{n_i}{\\nu_i}$$');
    assert.doesNotMatch(html, /formula-prose/);
    assert.match(html, /class="katex-display"/);
  });

  it('keeps nested braces inside a prose \\text{...}', () => {
    assert.equal(renderFormulaLatex('$$\\text{a {b} c}$$'), '<p class="formula-prose">a {b} c</p>');
  });
});
