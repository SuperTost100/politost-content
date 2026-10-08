import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFormulaIndex, parseChapterMarkdown } from '../src/parser.ts';
import { validateChapter, validateBundle } from '../src/validateChapter.ts';

const VALID = `## p1 | One

Inline $a$.

:::formula{id="1.1" label="Eq"}
$$b = 1$$
:::
`;

describe('validateChapter', () => {
  it('accepts well-formed chapter', () => {
    const r = validateChapter(VALID, 1);
    assert.equal(r.valid, true);
    assert.equal(r.paragraphCount, 1);
    assert.equal(r.formulaCount, 1);
  });

  it('rejects wrong chapter number on formula id', () => {
    const r = validateChapter(VALID, 2);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('capitolo')));
  });

  it('rejects missing paragraphs', () => {
    const r = validateChapter('no headers', 1);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('paragrafo')));
  });

  it('rejects leaked generator markup in every profile', () => {
    const raw = `${VALID}\nFine del testo.</markdown>\n</invoke>\n`;
    for (const profile of ['dev', 'ship'] as const) {
      const r = validateChapter(raw, 1, { profile });
      assert.equal(r.valid, false);
      assert.equal(r.errors.filter((e) => e.includes('markup del generatore')).length, 2);
    }
  });

  it('does not mistake comparisons in math for markup', () => {
    const r = validateChapter(`${VALID}\nSe $a<b$ e $c > d$ allora.\n`, 1);
    assert.equal(r.valid, true);
  });

  it('accepts tag-like words that only start with a generator tag name', () => {
    const r = validateChapter(`${VALID}\nIl parser <markdown-it> legge i <parameters>.\n`, 1);
    assert.equal(r.valid, true);
  });

  it('rejects generator tags with attributes', () => {
    const r = validateChapter(`${VALID}\n<parameter name="content">\n`, 1);
    assert.ok(r.errors.some((e) => e.includes('markup del generatore')));
  });

  it('rejects external images', () => {
    const r = validateChapter('## p1 | X\n\n![](https://x.com/a.png)\n', 1);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes(':::image')));
  });

  it('rejects a markdown image aimed at assets/', () => {
    const r = validateChapter('## p1 | X\n\n![](assets/missing.png)\n', 1);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes(':::image')));
  });

  it('warns on shorthand formula in dev profile', () => {
    const raw = `## p1 | X

:::formula{a = b}
`;
    const r = validateChapter(raw, 1, { profile: 'dev' });
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.includes('shorthand')));
    assert.ok(r.warnings.some((w) => w.includes(':::formula non canoniche')));
  });

  it('errors on shorthand formula in ship/strict profile', () => {
    const raw = `## p1 | X

:::formula{a = b}
`;
    const strict = validateChapter(raw, 1, { strict: true });
    assert.equal(strict.valid, false);
    assert.ok(strict.errors.some((e) => e.includes('shorthand')));

    const ship = validateChapter(raw, 1, { profile: 'ship' });
    assert.equal(ship.valid, false);
  });

  it('warns on unpaired bold and meta in dev; errors in ship', () => {
    const raw = `## p1 | X

**broken bold
Sintesi del lavoro svolto
Il testo sorgente è stato riscritto.
`;
    const dev = validateChapter(raw, 1, { profile: 'dev' });
    assert.equal(dev.valid, true);
    assert.ok(dev.warnings.some((w) => w.includes('**')));
    assert.ok(dev.warnings.some((w) => w.includes('meta')));

    const ship = validateChapter(raw, 1, { profile: 'ship' });
    assert.equal(ship.valid, false);
    assert.ok(ship.errors.some((e) => e.includes('**')));
    assert.ok(ship.errors.some((e) => e.includes('meta')));
  });

  it('promotes orphan hover refs to errors in ship mode', () => {
    const raw = `## p1 | X

See {{formula:9.9}}.
`;
    const dev = validateChapter(raw, 1, { profile: 'dev' });
    assert.equal(dev.valid, true);
    assert.ok(dev.warnings.some((w) => w.includes('hover')));

    const ship = validateChapter(raw, 1, { profile: 'ship' });
    assert.equal(ship.valid, false);
    assert.ok(ship.errors.some((e) => e.includes('hover')));
  });

  it('warns on missing assets in dev when assets map provided', () => {
    const raw = `## p1 | X

:::image{src="assets/missing.png" alt="Fig"}
:::
`;
    const dev = validateChapter(raw, 1, {
      profile: 'dev',
      availableAssets: new Set(['assets/other.png']),
    });
    assert.equal(dev.valid, true);
    assert.ok(dev.warnings.some((w) => w.includes('asset mancante')));

    const ship = validateChapter(raw, 1, {
      profile: 'ship',
      availableAssets: new Set(['assets/other.png']),
    });
    assert.equal(ship.valid, false);
    assert.ok(ship.errors.some((e) => e.includes('asset mancante')));
  });

  it('skips a formula link present in the book index and errors when it is missing', () => {
    const ch1 = '## p1 | L\n\nVedi [f](ref:formula/2.1).\n';
    const ch2 = '## p1 | F\n\n:::formula{id="2.1" label="L"}\n$$y$$\n:::\n';
    const index = buildFormulaIndex([
      parseChapterMarkdown(ch1, 1),
      parseChapterMarkdown(ch2, 2),
    ]);
    const seen = validateChapter(ch1, 1, { profile: 'ship', bookFormulaIndex: index });
    assert.equal(seen.valid, true);
    assert.equal(seen.errors.some((e) => e.includes('2.1')), false);
    assert.equal(seen.warnings.some((w) => w.includes('2.1')), false);

    const missing = validateChapter('## p1 | L\n\nVedi [f](ref:formula/9.9).\n', 1, { profile: 'ship' });
    assert.equal(missing.valid, false);
    assert.ok(missing.errors.some((e) => e.includes('formula assente')));
  });

  it('skips code when checking ** pairs and LaTeX', () => {
    const raw = '## p1 | Uno\n\n```python\nx = 2**10\nprint(f"costo $x_$")\n```\n\nUsa `a**b`.\n';
    const r = validateChapter(raw, 1, { profile: 'ship' });
    assert.deepEqual(r.errors, []);
  });

  it('reports a missing asset once', () => {
    const raw = '## p1 | Uno\n\n:::image{src="assets/a.png" alt="A"}\n:::\n';
    const r = validateChapter(raw, 1, { profile: 'ship', availableAssets: new Set() });
    assert.deepEqual(r.errors, ['Capitolo: asset mancante "assets/a.png"']);
  });

  it('accepts a hover to a formula in another chapter of the book', () => {
    const index = buildFormulaIndex([parseChapterMarkdown(VALID, 1)]);
    const r = validateChapter('## p1 | Due\n\nCome nella {{formula:1.1}}.\n', 2, {
      profile: 'ship',
      bookFormulaIndex: index,
    });
    assert.deepEqual(r.errors, []);
  });
});

describe('validateBundle', () => {
  it('errors on image refs missing from assets map (ship)', () => {
    const config = { id: 'demo-book', chapters: [{ file: 'ch01.md', number: 1 }] };
    const chapterFiles = {
      'ch01.md': `## p1 | X

:::image{src="assets/fig.png" alt="Fig"}
:::
`,
    };
    const r = validateBundle(config, chapterFiles, {}, {}, { strict: true });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('asset mancante')));
  });

  it('passes when assets map contains referenced files', () => {
    const config = { id: 'demo-book', chapters: [{ file: 'ch01.md', number: 1 }] };
    const chapterFiles = {
      'ch01.md': `## p1 | X

:::image{src="assets/fig.png" alt="Fig"}
:::
`,
    };
    const assets = { 'assets/fig.png': new Uint8Array([1, 2, 3]) };
    const r = validateBundle(config, chapterFiles, assets);
    assert.equal(r.valid, true);
  });

  it('defaults to ship profile (errors on missing assets)', () => {
    const config = { id: 'demo-book', chapters: [{ file: 'ch01.md', number: 1 }] };
    const chapterFiles = {
      'ch01.md': `## p1 | X

:::image{src="assets/fig.png" alt="Fig"}
:::
`,
    };
    const r = validateBundle(config, chapterFiles, {});
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('asset mancante')));
  });

  it('rejects an unclosed exercise file', () => {
    const r = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'ch01.md', number: 1 }] },
      { 'ch01.md': '## p1 | X\n\nOk.\n' },
      {},
      {
        eserciziRaw: `:::exercise{id="E-unclosed" chapter="1"}
## Domanda
This exercise has no closing fence at all
`,
      },
    );
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('esercizi.md')));
  });

  it('resolves a cross-chapter formula link and rejects one missing from the book', () => {
    const ok = validateBundle(
      {
        id: 'demo-book',
        chapters: [
          { file: 'c1.md', number: 1 },
          { file: 'c2.md', number: 2 },
        ],
      },
      {
        'c1.md': '## p1 | L\n\nVedi [f](ref:formula/2.1).\n',
        'c2.md': '## p1 | F\n\n:::formula{id="2.1" label="L"}\n$$y$$\n:::\n',
      },
    );
    assert.equal(ok.errors.some((e) => e.includes('formula assente')), false);
    assert.equal(ok.valid, true);

    const missing = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'c1.md', number: 1 }] },
      { 'c1.md': '## p1 | L\n\nVedi [f](ref:formula/9.9).\n' },
    );
    assert.equal(missing.valid, false);
    assert.ok(missing.errors.some((e) => e.includes('formula assente')));
  });

  it('rejects a grafico type outside the schema and a bad ide snippet', () => {
    const grafici = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'c.md', number: 1 }] },
      { 'c.md': '## p1 | X\n' },
      {},
      { graficiRaw: '[{"type":"not-a-real-type","config":{}}]' },
    );
    assert.equal(grafici.valid, false);
    assert.ok(grafici.errors.some((e) => e.includes('grafici.json')));

    const ide = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'c.md', number: 1 }] },
      { 'c.md': '## p1 | X\n' },
      {},
      { ideRaw: '[{"id":"x"}]' },
    );
    assert.equal(ide.valid, false);
    assert.ok(ide.errors.some((e) => e.includes('IdeSnippet')));
  });

  it('rejects duplicate and non-integer chapter numbers', () => {
    const r = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'a.md', number: 1 }, { file: 'a.md', number: 1 }, { file: 'b.md', number: '2' as unknown as number }] },
      { 'a.md': '## p1 | A\n\nA.\n', 'b.md': '## p1 | B\n\nB.\n' },
    );
    assert.ok(r.errors.includes('smartbook.json: number ripetuto in chapters: 1'));
    assert.ok(r.errors.includes('smartbook.json: file ripetuto in chapters: a.md'));
    assert.ok(r.errors.some((e) => e.includes('chapters[2].number deve essere un intero positivo')));
  });

  it('warns about missing sections without rejecting the book', () => {
    const r = validateBundle({ id: 'demo-book', chapters: [{ file: 'a.md', number: 1 }] }, { 'a.md': VALID });
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.includes('sections senza { enabled, label }')));
  });

  it('warns about links to a paragraph missing in another chapter', () => {
    const r = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'a.md', number: 1 }, { file: 'b.md', number: 2 }] },
      { 'a.md': '## p1 | A\n\nVedi [qui](ref:chapter/2#p9) e [là](ref:chapter/2#p1).\n', 'b.md': '## p1 | B\n\nB.\n' },
    );
    assert.deepEqual(
      r.warnings.filter((w) => w.includes('ref:chapter')),
      ['a.md: Paragrafo p1: link ref:chapter/2#p9 — paragrafo p9 assente'],
    );
  });

  it('warns about broken refs, chapters and LaTeX in exercises', () => {
    const eserciziRaw = `---
type: esercizi
---

:::exercise{id="E1.1" chapter="9"}
Usa {{formula:7.7}}, {{formula:1.1}} e $\\frac{1}$.
:::hint
H
:::
:::solution
S
:::
:::
`;
    const r = validateBundle(
      { id: 'demo-book', chapters: [{ file: 'a.md', number: 1 }] },
      { 'a.md': VALID },
      {},
      { eserciziRaw },
    );
    assert.equal(r.valid, true);
    const notes = r.warnings.filter((w) => w.startsWith('esercizi.md: E1.1'));
    assert.equal(notes.length, 3, notes.join('\n'));
    assert.ok(notes[0].includes('chapter="9"'));
    assert.ok(notes[1].includes('{{formula:7.7}}'));
    assert.ok(notes[2].includes('LaTeX inline invalido'));
  });
});
