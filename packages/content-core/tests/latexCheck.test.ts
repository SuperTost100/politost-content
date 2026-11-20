import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { checkTex, katexParse, validateBundle, validateChapter } from '../src/validateChapter.ts';

const outcome = (fn: () => unknown): string => {
  try {
    fn();
    return 'ok';
  } catch (e) {
    return (e as Error).message;
  }
};
const render = (tex: string, displayMode: boolean) =>
  outcome(() => katex.renderToString(tex, { displayMode, throwOnError: true }));

// Formulas that parse but fail while KaTeX 0.19.1 builds the output, one per case in buildMayFail.
const BUILD_ONLY_FAILURES = ['\\over_1', 'x^{\\choose_2}', '\\textbf{\\yen}', '\\textit{ℝ}', '\\text{\\textbf{\\checkmark}}', '\u{1d6a4}'];
const PARSE_FAILURES = ['\\foo', '\\frac{1}{2', '\\begin{matrix} a \\end{pmatrix}', '\\text{x^2}', '\\color{#12}{x}', '\\rule{1q}{2pt}', '\\def\\a{\\a}\\a', '\\hline'];
const VALID = ['\\frac{a}{b}', '\\text{velocità}', '\\text{J/(mol·K)}', '20\\ \\text{°C}', 'x \\over y', '\\binom{n}{k}', '\\mathbb{R}', 'ℝ', '\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}'];

describe('KaTeX parse entry', () => {
  // If this fails after a KaTeX update, checkTex falls back to rendering, which is correct but slower.
  // Read the new KaTeX's builders before changing buildMayFail to match.
  it('KaTeX still exports __parse, and it throws the same parse errors as renderToString', () => {
    assert.equal(typeof katexParse, 'function');
    assert.ok(Array.isArray(katexParse!('a+b', { displayMode: false, throwOnError: true })));
    for (const tex of PARSE_FAILURES) {
      for (const displayMode of [false, true]) {
        const parsed = outcome(() => katexParse!(tex, { displayMode, throwOnError: true }));
        assert.notEqual(parsed, 'ok', tex);
        assert.equal(parsed, render(tex, displayMode), tex);
      }
    }
  });

  it('parses the build-only failures without error, so they need the render fallback', () => {
    for (const tex of BUILD_ONLY_FAILURES) {
      assert.equal(outcome(() => katexParse!(tex, { displayMode: false, throwOnError: true })), 'ok', tex);
      assert.notEqual(render(tex, false), 'ok', tex);
    }
  });
});

describe('checkTex', () => {
  it('throws exactly what renderToString throws, with and without __parse', () => {
    for (const tex of [...BUILD_ONLY_FAILURES, ...PARSE_FAILURES, ...VALID]) {
      for (const displayMode of [false, true]) {
        const expected = render(tex, displayMode);
        assert.equal(outcome(() => checkTex(tex, displayMode)), expected, tex);
        assert.equal(outcome(() => checkTex(tex, displayMode, null)), expected, tex);
      }
    }
  });

  it('renders only the formulas whose build can fail', () => {
    let renders = 0;
    const original = katex.renderToString;
    katex.renderToString = (...args: Parameters<typeof original>) => {
      renders += 1;
      return original(...args);
    };
    try {
      for (const tex of ['\\frac{a}{b}', '\\text{velocità}', 'x \\over y']) checkTex(tex, false);
      assert.equal(renders, 0);
      checkTex('\\text{J/(mol·K)}', false);
      assert.equal(renders, 1);
    } finally {
      katex.renderToString = original;
    }
  });

  it('reports the build-only failures in a chapter', () => {
    for (const tex of BUILD_ONLY_FAILURES) {
      const r = validateChapter(`## p1 | Uno\n\nTesto $${tex}$.\n`, 1);
      assert.equal(r.errors.length, 1, tex);
      assert.equal(r.errors[0], `Paragrafo p1: LaTeX inline invalido — ${render(tex, false)}`);
    }
  });
});

describe('latex: false', () => {
  const config = { id: 'demo-book', title: 'Demo', subject: 'Fisica', chapters: [{ id: 'uno', file: 'a.md', number: 1 }] };
  const badFormula = '## p1 | Uno\n\nTesto $\\frac{1}{2$.\n\n:::formula{id="1.1" label="F"}\n$$\n\\foo\n$$\n:::\n';
  const exercises = '---\ntype: esercizi\n---\n\n:::exercise{id="e1" chapter="1"}\nCalcola $\\foo$.\n:::\n';

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
    const noChapterFile = validateBundle(config, {}, {}, {}, { latex: false });
    assert.equal(noChapterFile.valid, false);
  });
});
