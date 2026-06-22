import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateChapter } from '../src/validateChapter.ts';

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
  });
});
