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
});
