import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChapterMarkdown,
  parseExercises,
  preprocessContent,
  buildFormulaIndex,
  extractImageRefs,
  hasExternalImageMarkdown,
  countOrphanFormulaLines,
  processImageBlocks,
} from '../src/parser.ts';

const SAMPLE_CHAPTER = `---
chapter: 2
title: Test
---

## p1 | Intro

Text with {{formula:2.1}}.

:::formula{id="2.1" label="Test formula"}
$$x = 1$$
:::

:::image{src="assets/diagram.svg" alt="Diagram" caption="Fig 1"}
:::
`;

describe('parseChapterMarkdown', () => {
  it('parses paragraphs and formulas', () => {
    const ch = parseChapterMarkdown(SAMPLE_CHAPTER, 2);
    assert.equal(ch.paragraphs.length, 1);
    assert.equal(ch.paragraphs[0].id, 'p1');
    assert.equal(ch.formulas.length, 1);
    assert.equal(ch.formulas[0].id, '2.1');
    assert.equal(ch.formulas[0].label, 'Test formula');
  });

  it('rejects external image markdown', () => {
    assert.equal(hasExternalImageMarkdown('![](https://evil.com/x.png)'), true);
    assert.equal(hasExternalImageMarkdown('![](assets/missing.png)'), true);
    assert.equal(hasExternalImageMarkdown(':::image{src="assets/a.svg" alt="x"}'), false);
  });

  it('strips the heading title from paragraph content', () => {
    const ch = parseChapterMarkdown(SAMPLE_CHAPTER, 2);
    assert.equal(ch.paragraphs[0].title, 'Intro');
    assert.match(ch.paragraphs[0].content, /^Text with/);
  });

  it('reads formula id and label in either order and keeps ::: inside latex', () => {
    const reorder = '## p1 | T\n\n:::formula{label="1.1" id="1.1"}\n$$x$$\n:::\n';
    const triple = '## p1 | T\n\n:::formula{id="1.1" label="X"}\n$$a ::: b$$\n:::\n';
    assert.equal(parseChapterMarkdown(reorder, 1).formulas.length, 1);
    const ch = parseChapterMarkdown(triple, 1);
    assert.equal(ch.formulas.length, 1);
    assert.equal(ch.formulas[0].latex, '$$a ::: b$$');
  });

  it('extracts image refs from blocks', () => {
    const refs = extractImageRefs(SAMPLE_CHAPTER);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].src, 'assets/diagram.svg');
  });

  it('keeps } inside a quoted image alt', () => {
    const raw = ':::image{src="assets/fig.png" alt="caption with } brace" caption="ok"}\n:::\n';
    const processed = processImageBlocks(raw);
    assert.match(processed, /<!--IMAGE:/);
    const refs = extractImageRefs(raw);
    assert.equal(refs.length, 1);
    assert.match(refs[0].alt, /\}/);
    assert.match(extractImageRefs(processed)[0].alt, /\}/);
  });

  it('keeps an image block that has no alt', () => {
    const raw = ':::image{src="assets/x.png"}\n:::\n';
    assert.match(processImageBlocks(raw), /:::image\{src="assets\/x.png"\}/);
  });

  it('counts orphan :::formula lines and surfaces parse warnings', () => {
    const raw = `## p1 | X

:::formula{a = 1}
:::formula{id="1.1" label="Ok"}
$$
x
$$
:::
`;
    assert.equal(countOrphanFormulaLines(raw), 1);
    const ch = parseChapterMarkdown(raw, 1);
    assert.ok(ch.warnings?.some((w) => w.includes('non canoniche')));
  });
});

describe('preprocessContent', () => {
  it('converts formula hover and links', () => {
    const out = preprocessContent('See {{formula:1.1}} and [cap](ref:chapter/1#p2).');
    assert.match(out, /\[\[hover:1\.1\]\]/);
    assert.match(out, /\[\[link:chapter\/1#p2\|cap\]\]/);
  });
});

describe('parseExercises', () => {
  it('parses nested hint and solution', () => {
    const raw = `:::exercise{id="E1.1" chapter="1" difficulty="facile"}
## Domanda
Q?

:::hint
H
:::

:::solution
S
:::
:::`;
    const ex = parseExercises(raw);
    assert.equal(ex.length, 1);
    assert.equal(ex[0].hint, 'H');
    assert.equal(ex[0].solution, 'S');
  });

  it('keeps a mid-line ::: inside the hint and still returns an unclosed exercise', () => {
    const hintWithFence = `:::exercise{id="H06-a" chapter="1"}
## Domanda
What is 2+2?

:::hint
Use :::nested fence inside hint
:::

:::solution
4
:::
:::`;
    const unclosed = `:::exercise{id="H06-b" chapter="1"}
## Domanda
Never closed exercise body
`;
    const parsed = parseExercises(hintWithFence);
    assert.equal(parsed[0].hint, 'Use :::nested fence inside hint');
    assert.equal(parsed[0].solution, '4');
    const both = parseExercises(`${hintWithFence}\n${unclosed}`);
    assert.deepEqual(both.map((e) => e.id), ['H06-a', 'H06-b']);
  });
});

describe('buildFormulaIndex', () => {
  it('indexes formulas by id across chapters', () => {
    const ch = parseChapterMarkdown(SAMPLE_CHAPTER, 2);
    const idx = buildFormulaIndex([ch]);
    assert.equal(idx.get('2.1')?.label, 'Test formula');
  });
});
