import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { BoxBlock, ContentBlock, InlineSegment } from '../src/renderContent.ts';

before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  (globalThis as { window: unknown }).window = dom.window;
});

const load = async () => ({
  ...(await import('../src/renderContent.ts')),
  ...(await import('../src/parser.ts')),
  ...(await import('../src/validateChapter.ts')),
  ...(await import('../src/validateExercises.ts')),
  ...(await import('../src/serializeChapter.ts')),
});

const boxes = (blocks: ContentBlock[]) => blocks.filter((b): b is BoxBlock => b.type === 'box');
const html = (segments: InlineSegment[] | undefined) =>
  (segments ?? []).map((s) => (s.type === 'text' ? s.html : '')).join('');
/** Text of paragraphs, recursively, so tests can check that nothing was dropped. */
function plain(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'p') return b.segments.map((s) => (s.type === 'text' ? s.html : '')).join('');
      if (b.type === 'box') return `[${b.box}]${plain(b.blocks)}${b.proof ? `[proof]${plain(b.proof.blocks)}` : ''}[/]`;
      if (b.type === 'formula') return `(${b.formulaId})`;
      return `<${b.type}>`;
    })
    .join('|');
}
const chapter = (body: string) => `---\nchapter: 1\ntitle: T\n---\n\n## p1 | Uno\n\n${body}\n`;

describe('box blocks: parseContentBlocks', () => {
  it('reads each of the six names, with and without attributes', async () => {
    const { parseContentBlocks, BOX_NAMES } = await load();
    for (const name of BOX_NAMES) {
      const [bare] = boxes(parseContentBlocks(`:::${name}\nCorpo.\n:::`));
      assert.equal(bare.box, name);
      assert.equal(plain(bare.blocks), 'Corpo.');
      const [withAttrs] = boxes(parseContentBlocks(`:::${name}{title="nome"}\nCorpo.\n:::`));
      assert.equal(html(withAttrs.title), 'nome');
    }
  });

  it('reads id, title and kind in any order, and keeps the number and name out of the body', async () => {
    const { parseContentBlocks } = await load();
    const a = parseContentBlocks(':::theorem{id="1.2" title="di Weierstrass" kind="lemma"}\nSia $K$ compatto.\n:::');
    const b = parseContentBlocks(':::theorem{kind="lemma" title="di Weierstrass" id="1.2"}\nSia $K$ compatto.\n:::');
    assert.deepEqual(a, b);
    const [box] = boxes(a);
    assert.equal(box.id, '1.2');
    assert.equal(box.kind, 'lemma');
    assert.equal(html(box.title), 'di Weierstrass');
    assert.equal(a.length, 1);
  });

  it('keeps braces and backslashes of LaTeX inside a quoted title', async () => {
    const { parseContentBlocks, renderLatexInText } = await load();
    const title = 'su $\\{x \\in \\mathbb{R}^n : \\|x\\| \\le 1\\}$';
    const [box] = boxes(parseContentBlocks(`:::definition{id="1.4" title="${title}"}\nTesto.\n:::`));
    assert.equal(box.id, '1.4');
    assert.match(html(box.title), /^su <span class="katex">/);
    assert.equal(html(box.title), renderLatexInText(title));
  });

  it('applies the decimal comma rule in titles and bodies as it does outside boxes', async () => {
    const { parseContentBlocks } = await load();
    const outside = parseContentBlocks('Vale $m = 54,0\\,\\mathrm{g}$.');
    const [box] = boxes(parseContentBlocks(':::example{title="$m = 54,0\\,\\mathrm{g}$"}\nVale $m = 54,0\\,\\mathrm{g}$.\n:::'));
    assert.deepEqual(box.blocks, outside);
    const [p] = outside as Extract<ContentBlock, { type: 'p' }>[];
    assert.ok(html(box.title).length > 0);
    assert.ok(html(p.segments).includes(html(box.title)));
  });

  it('drops a kind that is not proposition, corollary or lemma, and kind on other names', async () => {
    const { parseContentBlocks } = await load();
    const [bad] = boxes(parseContentBlocks(':::theorem{kind="claim"}\nT.\n:::'));
    assert.equal(bad.kind, undefined);
    const [def] = boxes(parseContentBlocks(':::definition{kind="lemma"}\nT.\n:::'));
    assert.equal(def.kind, undefined);
  });

  it('attaches a proof that follows a theorem with only blank lines between', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks(
      ':::theorem{id="1.2"}\nEnunciato.\n:::\n\n\n:::proof{title="per induzione"}\nPasso base.\n:::\n\nDopo.',
    );
    assert.equal(plain(blocks), '[theorem]Enunciato.[proof]Passo base.[/]|Dopo.');
    const [thm] = boxes(blocks);
    assert.equal(html(thm.proof?.title), 'per induzione');
  });

  it('keeps a code block between a theorem and a proof', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks(':::theorem\nEnunciato.\n:::\n\n```\ncodice\n```\n\n:::proof\nDim.\n:::');
    assert.equal(plain(blocks), '[theorem]Enunciato.[/]|<code>|[proof]Dim.[/]');
  });

  it('keeps any other proof on its own', async () => {
    const { parseContentBlocks } = await load();
    const afterText = parseContentBlocks(':::theorem\nEnunciato.\n:::\n\nUn commento.\n\n:::proof\nDim.\n:::');
    assert.equal(plain(afterText), '[theorem]Enunciato.[/]|Un commento.|[proof]Dim.[/]');
    const afterDefinition = parseContentBlocks(':::definition\nD.\n:::\n:::proof\nDim.\n:::');
    assert.equal(plain(afterDefinition), '[definition]D.[/]|[proof]Dim.[/]');
    const alone = boxes(parseContentBlocks(':::proof{id="3"}\nDim.\n:::'));
    assert.equal(alone[0].id, undefined);
  });

  it('reads two boxes in a row and text right after a closing line', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks(':::example\nA.\n:::\n:::mistake\nB.\n:::\nTesto subito dopo.\n- voce');
    assert.equal(plain(blocks), '[example]A.[/]|[mistake]B.[/]|Testo subito dopo.|<list>');
  });

  it('reads an opening line that follows text with no blank line', async () => {
    const { parseContentBlocks } = await load();
    assert.equal(plain(parseContentBlocks('Prima.\n:::remark\nNota.\n:::')), 'Prima.|[remark]Nota.[/]');
  });

  it('keeps lists, quotes and display math inside a box', async () => {
    const { parseContentBlocks } = await load();
    const [box] = boxes(parseContentBlocks(':::definition\n- uno\n- due\n\n> citazione\n\n$$x^2$$\n:::'));
    assert.deepEqual(box.blocks.map((b) => b.type), ['list', 'quote', 'math']);
  });

  it('reads ::: in the middle of a line, or inside code, as text', async () => {
    const { parseContentBlocks } = await load();
    assert.equal(boxes(parseContentBlocks('Scrivi :::theorem per aprire.\n\nE ::: per chiudere.')).length, 0);
    const code = parseContentBlocks('```\n:::theorem\nx\n:::\n```');
    assert.deepEqual(code.map((b) => b.type), ['code']);
    const inBox = boxes(parseContentBlocks(':::example\n```\n:::\n```\nDopo il codice.\n:::'));
    assert.equal(inBox.length, 1);
    assert.deepEqual(inBox[0].blocks.map((b) => b.type), ['code', 'p']);
  });

  it('reads an opening line with text after it as text', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks(':::theorem{id="1"} Sia K compatto.\n\nAltro.');
    assert.equal(boxes(blocks).length, 0);
    assert.match(plain(blocks), /Sia K compatto\./);
  });

  it('gives an unclosed box the rest of the paragraph and nothing more', async () => {
    const { parseContentBlocks, parseChapterMarkdown } = await load();
    const ch = parseChapterMarkdown(chapter(':::theorem{id="1.1"}\nEnunciato.\n\nAncora.\n\n## p2 | Due\n\nTesto di p2.'), 1);
    const blocks = parseContentBlocks(ch.paragraphs[0].content);
    assert.equal(plain(blocks), '[theorem]Enunciato.|Ancora.[/]');
    assert.equal(plain(parseContentBlocks(ch.paragraphs[1].content)), 'Testo di p2.');
  });

  it('keeps the text of a box nested in a box, and of an exercise inside a box', async () => {
    const { parseContentBlocks } = await load();
    const nested = parseContentBlocks(':::theorem\nA.\n:::remark\nB.\n:::\nC.\n:::\nD.');
    assert.equal(plain(nested), '[theorem]A.|[remark]B.[/]|C.[/]|D.');
    const exercise = parseContentBlocks(':::example\nA.\n:::exercise{id="E1"}\nQ\n:::hint\nH\n:::\n:::\nB.\n:::\nC.');
    assert.equal(boxes(exercise).length, 1);
    assert.equal(plain(exercise), '[example]A.\n:::exercise{id=&quot;E1&quot;}\nQ\n:::hint\nH\n:::\n:::\nB.[/]|C.');
  });

  it('parses CRLF input like LF input', async () => {
    const { parseContentBlocks, parseChapterMarkdown } = await load();
    const lf = ':::theorem{id="1.2" title="T"}\nA.\n\n:::formula{id="1.1" label="L"}\n$$x$$\n:::\n:::\n\n:::proof\nB.\n:::';
    assert.deepEqual(parseContentBlocks(lf.replace(/\n/g, '\r\n')), parseContentBlocks(lf));
    const a = parseChapterMarkdown(chapter(lf).replace(/\n/g, '\r\n'), 1);
    const b = parseChapterMarkdown(chapter(lf), 1);
    assert.deepEqual(a, b);
  });
});

describe('box blocks: formulas and images inside', () => {
  const raw = chapter(`:::theorem{id="1.2" title="di Weierstrass"}
Sia $K \\subset \\mathbb{R}^n$ compatto.

:::formula{id="1.7" label="Weierstrass"}
$$\\min_K f \\le f(x) \\le \\max_K f$$
:::

:::image{src="assets/k.svg" alt="Un compatto"}
:::
:::

:::proof
Come nella {{formula:1.7}}.
:::`);

  it('indexes a formula inside a box as a numbered formula of the chapter', async () => {
    const { parseChapterMarkdown, parseContentBlocks, buildFormulaIndex } = await load();
    const ch = parseChapterMarkdown(raw, 1);
    assert.deepEqual(ch.formulas.map((f) => [f.id, f.label, f.latex]), [
      ['1.7', 'Weierstrass', '$$\\min_K f \\le f(x) \\le \\max_K f$$'],
    ]);
    assert.ok(buildFormulaIndex([ch]).has('1.7'));
    const [thm] = boxes(parseContentBlocks(ch.paragraphs[0].content));
    assert.deepEqual(thm.blocks.map((b) => b.type), ['p', 'formula', 'image']);
    assert.deepEqual(thm.blocks[1], { type: 'formula', formulaId: '1.7' });
    assert.equal(thm.proof?.blocks[0].type, 'p');
  });

  it('validates the chapter and serializes it back unchanged', async () => {
    const { parseChapterMarkdown, serializeChapter, validateChapter } = await load();
    const result = validateChapter(raw, 1, { profile: 'ship', availableAssets: new Set(['assets/k.svg']) });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.boxes, [
      { name: 'theorem', id: '1.2', line: 8 },
      { name: 'proof', line: 19 },
    ]);
    const out = serializeChapter(parseChapterMarkdown(raw, 1), 'T', 1);
    assert.equal(out, raw);
  });
});

describe('box blocks: validateChapter', () => {
  const errorsOf = async (body: string) => {
    const { validateChapter } = await load();
    const r = validateChapter(chapter(body), 1, { profile: 'dev' });
    return { errors: r.errors, warnings: r.warnings };
  };

  it('accepts every name, kind and a book of valid boxes without findings', async () => {
    const r = await errorsOf(
      [
        ':::definition{id="1.1" title="palla"}\nD.\n:::',
        ':::theorem{id="1.1" title="di $\\mathbb{R}^n$"}\nT.\n:::\n\n:::proof\nP.\n:::',
        ':::theorem{id="1.2" kind="corollary"}\nC.\n:::',
        ':::example{id="1.1"}\nE.\n:::',
        ':::mistake{id="1.1"}\nM.\n:::',
        ':::remark\nR.\n:::',
      ].join('\n\n'),
    );
    assert.deepEqual(r, { errors: [], warnings: [] });
  });

  it('reports an unclosed box with its line', async () => {
    const { errors } = await errorsOf(':::theorem{id="1.1"}\nEnunciato.\n\nAncora.');
    assert.deepEqual(errors, ['Riga 8: :::theorem non chiuso: manca la riga ::: prima del paragrafo successivo']);
  });

  it('reports a duplicate id among boxes of the same name only', async () => {
    const { errors } = await errorsOf(
      ':::theorem{id="1.2"}\nA.\n:::\n\n:::definition{id="1.2"}\nB.\n:::\n\n:::theorem{id="1.2" kind="lemma"}\nC.\n:::',
    );
    assert.deepEqual(errors, ['Riga 16: :::theorem: id 1.2 già usato alla riga 8 da un altro :::theorem']);
  });

  it('reports a malformed id and warns about an id on a proof', async () => {
    const { errors, warnings } = await errorsOf(':::example{id="E1"}\nA.\n:::\n\n:::proof{id="1"}\nB.\n:::');
    assert.deepEqual(errors, ['Riga 8: :::example: id="E1" non valido, atteso un numero come 1.2']);
    assert.deepEqual(warnings, ['Riga 12: :::proof: una dimostrazione non ha numero, id ignorato']);
  });

  it('reports a wrong kind and kind outside theorem', async () => {
    const { errors } = await errorsOf(':::theorem{kind="claim"}\nA.\n:::\n\n:::remark{kind="lemma"}\nB.\n:::');
    assert.deepEqual(errors, [
      'Riga 8: :::theorem: kind="claim" non valido, atteso proposition, corollary o lemma',
      'Riga 12: :::remark: kind vale solo su :::theorem',
    ]);
  });

  it('warns about an unknown attribute', async () => {
    const { errors, warnings } = await errorsOf(':::theorem{id="1.1" color="red"}\nA.\n:::');
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, ['Riga 8: :::theorem: attributo color sconosciuto, ignorato']);
  });

  it('reports attributes that are not name="value" pairs, and an opening line with text after it', async () => {
    const { errors } = await errorsOf(':::theorem{id=1.1}\nA.\n:::\n\n:::remark{title="x"} Nota.');
    assert.deepEqual(errors, [
      'Riga 12: apertura ":::remark{title="x"} Nota." non valida: scrivi :::nome o :::nome{…} da solo sulla riga',
      'Riga 8: :::theorem: attributi non validi, scrivi nome="valore" separati da spazi',
    ]);
  });

  it('reports an empty body', async () => {
    const { errors } = await errorsOf(':::remark\n\n:::');
    assert.deepEqual(errors, ['Riga 8: :::remark: corpo vuoto']);
  });

  it('accepts a body that holds only code', async () => {
    const { errors } = await errorsOf(':::example\n```\nx = 1\n```\n:::');
    assert.deepEqual(errors, []);
  });

  it('reports boxes and exercise blocks nested in a box', async () => {
    const { errors } = await errorsOf(
      ':::theorem\nA.\n:::remark\nB.\n:::\n:::\n\n:::example\n:::hint\nH\n:::\n:::',
    );
    assert.deepEqual(errors, [
      'Riga 10: :::remark dentro :::theorem, i blocchi non si annidano',
      'Riga 16: :::hint non ammesso dentro :::example',
    ]);
  });

  it('warns when the body still starts with the old bold label', async () => {
    const { warnings } = await errorsOf(':::theorem{id="1.2"}\n**Teorema 1.2** (di Weierstrass). Sia…\n:::');
    assert.deepEqual(warnings, [
      "Riga 8: :::theorem: il corpo comincia con l'etichetta in grassetto, ma numero e nome vanno negli attributi",
    ]);
  });

  it('checks LaTeX in titles and bodies', async () => {
    const { errors } = await errorsOf(':::theorem{title="di $\\frac{1}$"}\nSia $\\sqrt{$.\n:::');
    assert.equal(errors.filter((e) => e.includes('LaTeX inline invalido')).length, 2);
  });

  it('checks a proof attached to a theorem like any other box', async () => {
    const { errors, warnings } = await errorsOf(':::theorem\nA.\n:::\n\n:::proof{title="x" foo="1"}\n:::');
    assert.deepEqual(errors, ['Riga 12: :::proof: corpo vuoto']);
    assert.deepEqual(warnings, ['Riga 12: :::proof: attributo foo sconosciuto, ignorato']);
  });

  it('ignores a box written inside a code block', async () => {
    const r = await errorsOf('```\n:::theorem{kind="x"}\n```');
    assert.deepEqual(r, { errors: [], warnings: [] });
  });
});

describe('box blocks: exercises', () => {
  const raw = `---
type: esercizi
---

:::exercise{id="E1.1" chapter="1"}
Domanda.

:::theorem
Enunciato.
:::

:::proof
Dim.
:::

:::hint
Suggerimento.
:::

:::solution
Soluzione.
:::
:::
`;

  it('keeps the hint and solution of an exercise that holds a box', async () => {
    const { parseExercises, parseContentBlocks } = await load();
    const [ex] = parseExercises(raw);
    assert.equal(ex.hint, 'Suggerimento.');
    assert.equal(ex.solution, 'Soluzione.');
    assert.equal(plain(parseContentBlocks(ex.question)), 'Domanda.|[theorem]Enunciato.[proof]Dim.[/]');
  });

  it('reports a box in an exercise as an error', async () => {
    const { validateExercises } = await load();
    const r = validateExercises(raw, 'esercizi');
    assert.deepEqual(r.errors, [
      'riga 8: :::theorem non ammesso negli esercizi, i blocchi come :::theorem stanno nei capitoli',
      'riga 12: :::proof non ammesso negli esercizi, i blocchi come :::theorem stanno nei capitoli',
    ]);
    assert.equal(r.exerciseCount, 1);
  });
});

describe('box blocks: validateBundle', () => {
  const config = (specVersion?: string) => ({
    id: 'libro',
    ...(specVersion ? { specVersion } : {}),
    chapters: [
      { id: 'uno', number: 1, file: '01.md' },
      { id: 'due', number: 2, file: '02.md' },
    ],
    sections: Object.fromEntries(
      ['smartbook', 'formulario', 'esercizi', 'esami', 'ide', 'grafici', 'risposte'].map((k) => [k, { enabled: true, label: k }]),
    ),
  });
  const files = {
    '01.md': '## p1 | Uno\n\n:::theorem{id="1.1"}\nA.\n:::\n',
    '02.md': '## p1 | Due\n\n:::theorem{id="1.1"}\nB.\n:::\n\n:::definition{id="2.1"}\nC.\n:::\n',
  };

  it('reports a box id used twice in the book for the same name', async () => {
    const { validateBundle } = await load();
    const r = validateBundle(config('1.3'), files);
    assert.deepEqual(r.errors, ['02.md: Riga 3: :::theorem id 1.1 già usato in 01.md']);
    assert.deepEqual(r.warnings, []);
  });

  it('warns when a book with boxes declares a format older than 1.3', async () => {
    const { validateBundle } = await load();
    const one = { '01.md': files['01.md'], '02.md': '## p1 | Due\n\nTesto.\n' };
    for (const spec of [undefined, '1.2']) {
      assert.deepEqual(validateBundle(config(spec), one).warnings, [
        'smartbook.json: i capitoli usano blocchi come :::theorem, che chiedono specVersion "1.3" o successiva',
      ]);
    }
    assert.deepEqual(validateBundle(config('1.3'), one).warnings, []);
  });
});

describe('box blocks: Analisi Matematica 2, chapter 1, sections p3 and p5 converted by hand', () => {
  const fixture = new URL('./fixtures/am2-01-boxes.md', import.meta.url);

  it('parses the converted sections into the expected boxes', async () => {
    const { readFileSync } = await import('node:fs');
    const { parseChapterMarkdown, parseContentBlocks } = await load();
    const ch = parseChapterMarkdown(readFileSync(fixture, 'utf8'), 1);
    assert.deepEqual(ch.paragraphs.map((p) => p.id), ['p3', 'p5']);
    assert.deepEqual(ch.formulas.map((f) => [f.id, f.label]), [['1.4', 'Segmento di estremi a e b']]);

    const all = ch.paragraphs.flatMap((p) => boxes(parseContentBlocks(p.content)));
    const summary = all.map((b) => [b.box, b.id ?? '', html(b.title).replace(/<[\s\S]*$/, '…'), b.proof ? 'proof' : '']);
    assert.deepEqual(summary, [
      ['definition', '1.1', 'palla', ''],
      ['definition', '1.2', 'punti interni, esterni, di frontiera', ''],
      ['definition', '1.3', '', ''],
      ['definition', '1.4', 'limitato, compatto', ''],
      ['example', '1.3', '', ''],
      ['mistake', '1.3', '', ''],
      ['theorem', '1.1', 'criterio delle coordinate polari', ''],
      ['example', '1.13', '', ''],
      ['example', '1.15', 'limite che dipende da …', ''],
      ['theorem', '1.2', 'di Weierstrass', ''],
      ['example', '1.16', '', ''],
      ['mistake', '1.11', '', ''],
      ['theorem', '1.3', 'degli zeri', 'proof'],
    ]);

    const [ball, points] = all;
    assert.deepEqual(ball.blocks.map((b) => b.type), ['p', 'math', 'p']);
    assert.deepEqual(points.blocks.map((b) => b.type), ['p', 'list']);
    const zeros = all[12];
    assert.match(plain(zeros.proof!.blocks), /^L'idea: si congiungono/);
    // Esempio 1.17 and Errore tipico 1.12 were left as they are, so p5 still ends with two plain paragraphs.
    const p5 = parseContentBlocks(ch.paragraphs[1].content);
    assert.deepEqual(p5.slice(-2).map((b) => b.type), ['p', 'p']);
  });

  it('validates with no errors, and only the warning about the missing p4', async () => {
    const { readFileSync } = await import('node:fs');
    const { validateChapter } = await load();
    // Definizione 1.1 points to formula 1.1, which is in p2 of the book and not in the fixture.
    const formula11 = { id: '1.1', chapter: 1, number: 1, label: 'Prodotto scalare e norma euclidea', latex: '$$x$$' };
    const r = validateChapter(readFileSync(fixture, 'utf8'), 1, {
      profile: 'ship',
      bookFormulaIndex: new Map([['1.1', formula11]]),
    });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, ['Paragrafo p3: link ref:chapter/1#p4 — paragrafo p4 assente']);
    assert.equal(r.boxes.length, 14);
  });
});
