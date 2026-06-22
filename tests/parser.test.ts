import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChapterMarkdown,
  parseExercises,
  preprocessContent,
  buildFormulaIndex,
  extractImageRefs,
  hasExternalImageMarkdown,
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
    assert.equal(hasExternalImageMarkdown(':::image{src="assets/a.svg" alt="x"}'), false);
  });

  it('extracts image refs from blocks', () => {
    const refs = extractImageRefs(SAMPLE_CHAPTER);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].src, 'assets/diagram.svg');
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
});

describe('buildFormulaIndex', () => {
  it('indexes formulas by id across chapters', () => {
    const ch = parseChapterMarkdown(SAMPLE_CHAPTER, 2);
    const idx = buildFormulaIndex([ch]);
    assert.equal(idx.get('2.1')?.label, 'Test formula');
  });
});
