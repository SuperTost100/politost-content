import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

describe('parseInlineSegments spacing', () => {
  before(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    (globalThis as typeof globalThis & { window: Window }).window = dom.window as unknown as Window;
  });

  it('preserves spaces around bold text', async () => {
    const { parseInlineSegments } = await import('../src/renderContent.ts');
    const segments = parseInlineSegments('Un **campo** è un insieme');
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type, 'text');
    assert.equal(segments[0].type === 'text' ? segments[0].html : '', 'Un ');
    assert.equal(segments[1].type, 'text');
    assert.equal(segments[1].type === 'text' ? segments[1].html : '', '<strong>campo</strong>');
    assert.equal(segments[2].type, 'text');
    assert.equal(segments[2].type === 'text' ? segments[2].html : '', ' è un insieme');
  });

  it('preserves spaces around internal links', async () => {
    const { parseInlineSegments } = await import('../src/renderContent.ts');
    const segments = parseInlineSegments(
      "torna al [[link:chapter/1#p2|paragrafo sulle sezioni]] oppure vai avanti",
    );
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type === 'text' ? segments[0].html : '', 'torna al ');
    assert.equal(segments[1].type, 'link');
    assert.equal(segments[2].type === 'text' ? segments[2].html : '', ' oppure vai avanti');
  });

  it('preserves spaces around formula hovers', async () => {
    const { parseInlineSegments } = await import('../src/renderContent.ts');
    const segments = parseInlineSegments('Come nella [[hover:2.1]], si ottiene');
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type === 'text' ? segments[0].html : '', 'Come nella ');
    assert.equal(segments[1].type, 'hover');
    assert.equal(segments[2].type === 'text' ? segments[2].html : '', ', si ottiene');
  });

  it('renders < and > inside inline math without HTML entities', async () => {
    const { renderLatexInText } = await import('../src/renderContent.ts');
    const html = renderLatexInText('opposta direzione se $k < 0$');
    assert.doesNotMatch(html, /katex-error|&amp;lt;|&amp;gt;/);
    assert.match(html, /class="mrel"/);
    assert.match(html, /opposta direzione se/);
  });
});
