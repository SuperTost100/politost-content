import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { validateBundle, validateChapter } from '../src/validateChapter.ts';

const renderError = (tex: string, displayMode: boolean): string => {
  try {
    katex.renderToString(tex, { displayMode, throwOnError: true });
    return 'ok';
  } catch (e) {
    return (e as Error).message;
  }
};

// These parse cleanly in KaTeX 0.19.1 and fail only while it builds the output, so only rendering finds them.
const BUILD_ONLY_FAILURES = ['\\genfrac{(}{!}{}{}{a}{b}', '\\over_1', '\\textbf{\\yen}', '\\textit{ℝ}', '\u{1d6a4}'];

describe('formula check', () => {
  it('reports formulas that fail only while KaTeX builds the output', () => {
    for (const tex of BUILD_ONLY_FAILURES) {
      const message = renderError(tex, false);
      assert.notEqual(message, 'ok', tex);
      const r = validateChapter(`## p1 | Uno\n\nTesto $${tex}$.\n`, 1);
      assert.deepEqual(r.errors, [`Paragrafo p1: LaTeX inline invalido — ${message}`], tex);
    }
  });

  it('reports a repeated bad formula in every place, with the same message', () => {
    const raw = '## p1 | Uno\n\n$\\foo$ e $\\foo$.\n\n## p2 | Due\n\n$\\foo$\n';
    const r = validateChapter(raw, 1);
    assert.equal(r.errors.length, 3);
    assert.equal(new Set(r.errors.map((e) => e.split(' — ')[1])).size, 1);
  });
});

describe('latex: false', () => {
  const config = { id: 'demo-book', title: 'Demo', subject: 'Fisica', chapters: [{ id: 'uno', file: 'a.md', number: 1 }] };
  const badFormula = '## p1 | Uno\n\nTesto $\\frac{1}{2$.\n\n:::formula{id="1.1" label="F"}\n$$\n\\foo\n$$\n:::\n';
  const exercises = '---\ntype: esercizi\n---\n\n:::exercise{id="e1" chapter="1"}\nCalcola $\\foo$.\n:::\n';

  it('accepts the \\genfrac formula that the default check rejects', () => {
    const raw = '## p1 | Uno\n\nTesto $\\genfrac{(}{!}{}{}{a}{b}$.\n';
    assert.equal(validateBundle(config, { 'a.md': raw }).valid, false);
    assert.equal(validateBundle(config, { 'a.md': raw }, {}, {}, { latex: false }).valid, true);
  });

  it('skips the formula check in chapters and exercises', () => {
    const full = validateBundle(config, { 'a.md': badFormula }, {}, { eserciziRaw: exercises });
    assert.equal(full.valid, false);
    assert.equal(full.errors.filter((e) => e.includes('LaTeX')).length, 2);
    assert.ok(full.warnings.some((w) => w.includes('LaTeX')));

    const skipped = validateBundle(config, { 'a.md': badFormula }, {}, { eserciziRaw: exercises }, { latex: false });
    assert.equal(skipped.valid, true, skipped.errors.join('\n'));
    assert.ok(!skipped.warnings.some((w) => w.includes('LaTeX')));
    assert.ok(!validateChapter(badFormula, 1, { latex: false }).errors.some((e) => e.includes('LaTeX')));
  });

  it('keeps every structural check', () => {
    const broken = [
      '## p1 | Uno\n\nTesto.\n\n## p1 | Due\n',
      '## p1 | Uno\n\n:::theorem{id="1"}\nSenza chiusura.\n',
      '## p1 | Uno\n\n:::formula{id="2.1" label="F"}\n$$\na\n$$\n:::\n',
      '## p1 | Uno\n\n:::image{src="assets/x.png" alt="x"}\n',
      '## p1 | Uno\n\nTesto </invoke>\n',
      'nessun paragrafo',
    ];
    for (const raw of broken) {
      const full = validateBundle(config, { 'a.md': raw });
      const skipped = validateBundle(config, { 'a.md': raw }, {}, {}, { latex: false });
      assert.equal(skipped.valid, false, raw);
      assert.deepEqual(skipped, full, raw);
    }
    assert.equal(validateBundle(config, {}, {}, {}, { latex: false }).valid, false);
  });
});
