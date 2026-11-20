import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import { HOSTILE_FORMULAS, assertKatexOnly } from './trustedMathAllowlist.ts';

let dom: JSDOM;
before(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  (globalThis as { window: unknown }).window = dom.window;
});

const load = async () => ({
  ...(await import('../src/renderContent.ts')),
  ...(await import('../src/formulaRender.ts')),
});

const TRUSTED = { mathTrusted: true } as const;

function fragment(html: string): DocumentFragment {
  const template = dom.window.document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

/** Every option object content-core passed to KaTeX while `run` ran. */
function katexOptions(run: () => void): Record<string, unknown>[] {
  const calls: Record<string, unknown>[] = [];
  const original = katex.renderToString;
  katex.renderToString = (tex, options) => {
    calls.push({ ...options });
    return original(tex, options);
  };
  try {
    run();
  } finally {
    katex.renderToString = original;
  }
  return calls;
}

describe('trusted math: KaTeX settings', () => {
  it('calls KaTeX with only displayMode and throwOnError, so trust, strict, maxSize and maxExpand stay at their defaults', async () => {
    const { parseContentBlocks, renderNumberedFormulaHtml, renderFormulaHtml } = await load();
    const calls = katexOptions(() => {
      parseContentBlocks('Testo $x^2$ e\n\n$$\\frac{a}{b}$$\n\n$\\frac{$ rotta', TRUSTED);
      renderFormulaHtml('$$E = mc^2$$', TRUSTED);
      renderNumberedFormulaHtml({ id: '1.1', label: 'L', latex: '$$a,5$$', chapter: 1 } as never, 'screen', TRUSTED);
    });
    assert.ok(calls.length >= 4);
    assert.ok(calls.every((options) => !('trust' in options)));
    for (const options of calls) {
      assert.deepEqual(Object.keys(options).sort(), ['displayMode', 'throwOnError'], JSON.stringify(options));
    }
  });

  it('renders \\href, \\url, \\includegraphics and the \\html commands without links, images or their attributes', async () => {
    const { parseContentBlocks } = await load();
    const tex = [
      '\\href{https://example.com}{x}',
      '\\url{https://example.com}',
      '\\includegraphics{https://example.com/a.png}',
      '\\htmlClass{evil}{x}',
      '\\htmlId{evil}{x}',
      '\\htmlStyle{color:red}{x}',
      '\\htmlData{evil=1}{x}',
    ];
    for (const t of tex) {
      for (const html of collectHtml(parseContentBlocks(`$${t}$`, TRUSTED))) {
        const root = fragment(html);
        assert.equal(root.querySelector('a, img, [href], [src], [id], .evil'), null, t);
        for (const el of Array.from(root.querySelectorAll('*'))) {
          assert.ok(!Array.from(el.attributes).some((a) => a.name.startsWith('data-')), t);
        }
      }
    }
  });

  it('keeps the decimal comma rule', async () => {
    const { parseContentBlocks, renderFormulaHtml } = await load();
    const spacedComma = /mpunct\\?">,<\/span><span class=\\?"mspace/;
    assert.doesNotMatch(JSON.stringify(parseContentBlocks('$m = 54,0$', TRUSTED)), spacedComma);
    assert.match(JSON.stringify(parseContentBlocks('$P = (3,4)$', TRUSTED)), spacedComma);
    assert.doesNotMatch(renderFormulaHtml('$$m = 54,0$$', TRUSTED), spacedComma);
  });
});

describe('trusted math: what still goes through DOMPurify', () => {
  it('sanitizes a formula KaTeX cannot parse, so its title with the error message is dropped', async () => {
    const { parseContentBlocks, renderFormulaHtml, renderNumberedFormulaHtml } = await load();
    for (const text of ['Prima $\\frac{a}{$ dopo', '$$\\frac{a}{$$', '$\\undefinedcommand{x}$']) {
      const trusted = JSON.stringify(parseContentBlocks(text, TRUSTED));
      assert.equal(trusted, JSON.stringify(parseContentBlocks(text)), text);
      assert.doesNotMatch(trusted, /title=/, text);
    }
    assert.equal(renderFormulaHtml('$$\\frac{a}{$$', TRUSTED), renderFormulaHtml('$$\\frac{a}{$$'));
    const f = { id: '1.1', label: 'Rotta', latex: '$$\\frac{a}{$$', chapter: 1 } as never;
    assert.equal(renderNumberedFormulaHtml(f, 'screen', TRUSTED), renderNumberedFormulaHtml(f));
    assert.doesNotMatch(renderFormulaHtml('$$\\frac{a}{$$', TRUSTED), /title=/);
  });

  it('sanitizes the text around the math', async () => {
    const { parseInlineSegments, parseContentBlocks, renderNumberedFormulaHtml } = await load();
    const html = JSON.stringify(parseContentBlocks('$x$ <img src=x onerror=alert(1)> **<b>$y$</b>**', TRUSTED));
    assert.doesNotMatch(html, /<img|<b>/);
    const titled = JSON.stringify(parseContentBlocks(':::definition{title="<i onmouseover=x>$a$</i>"}\nCorpo\n:::', TRUSTED));
    assert.doesNotMatch(titled, /<i /);
    const segments = parseInlineSegments('[[link:cap-1|<script>x</script> $z$]]', TRUSTED);
    assert.doesNotMatch(JSON.stringify(segments), /<script/);
    const label = renderNumberedFormulaHtml({ id: '1.1', label: '<img src=x onerror=y>', latex: '$$a$$', chapter: 1 } as never, 'screen', TRUSTED);
    assert.doesNotMatch(label, /<img/);
  });

  it('falls back to the untrusted output for text that contains the placeholder character', async () => {
    const { parseContentBlocks, renderNumberedFormulaHtml } = await load();
    for (const text of ['a \uE0020\uE002 $x$', 'a \uE002 $x$', '$\\text{\uE0020\uE002}$ $y$']) {
      assert.equal(JSON.stringify(parseContentBlocks(text, TRUSTED)), JSON.stringify(parseContentBlocks(text)), text);
    }
    const f = { id: '1.1', label: '\uE0020\uE002', latex: '$$a$$', chapter: 1 } as never;
    assert.equal(renderNumberedFormulaHtml(f, 'screen', TRUSTED), renderNumberedFormulaHtml(f));
  });

  it('gives the same DOM as the sanitized path for ordinary math', async () => {
    const { parseContentBlocks, renderFormulaHtml } = await load();
    const text = 'Sia $f(x) = \\sqrt{x^2+1}$ e\n\n$$\\int_0^1 f(x)\\,dx = \\cancel{3,5}$$\n\n- $\\vec{v}$ con **$\\alpha$**';
    const [ta, tb] = [collectHtml(parseContentBlocks(text, TRUSTED)), collectHtml(parseContentBlocks(text))];
    assert.equal(ta.length, tb.length);
    ta.forEach((h, i) => assert.ok(fragment(h).isEqualNode(fragment(tb[i])), `segment ${i}`));
    assert.ok(fragment(renderFormulaHtml('$$x = \\frac{1}{2}$$', TRUSTED)).isEqualNode(fragment(renderFormulaHtml('$$x = \\frac{1}{2}$$'))));
  });
});

describe('trusted math: link labels', () => {
  it('keeps a formula in a link label as KaTeX wrote it, and still sanitizes the label text', async () => {
    const { parseInlineSegments, segmentsToHtml } = await load();
    // KaTeX writes linebreak="newline" for \\, which DOMPurify would drop.
    const html = segmentsToHtml(parseInlineSegments('[[link:chapter/1#p1|vedi $a\\\\b$ <b>x</b>]]', TRUSTED));
    assert.match(html, /linebreak="newline"/);
    assert.doesNotMatch(html, /<b>x<\/b>/);
    const plain = segmentsToHtml(parseInlineSegments('[[link:chapter/1#p1|vedi $a\\\\b$ <b>x</b>]]'));
    assert.doesNotMatch(plain, /linebreak="newline"/);
  });
});

describe('trusted math: hostile formulas', () => {
  it(`lets nothing but KaTeX's own elements and attributes through (${HOSTILE_FORMULAS.length} formulas)`, async () => {
    const { parseContentBlocks, renderFormulaHtml, renderNumberedFormulaHtml } = await load();
    assert.ok(HOSTILE_FORMULAS.length >= 30);
    for (const tex of HOSTILE_FORMULAS) {
      const outputs = [
        ...collectHtml(parseContentBlocks(`Testo $${tex}$ testo`, TRUSTED)),
        ...collectHtml(parseContentBlocks(`$$${tex}$$`, TRUSTED)),
        renderFormulaHtml(`$$${tex}$$`, TRUSTED),
        renderNumberedFormulaHtml({ id: '1.1', label: 'x', latex: `$$${tex}$$`, chapter: 1 } as never, 'screen', TRUSTED),
      ];
      for (const html of outputs) {
        // The source is in the output as escaped text (the MathML annotation), so the string check is for tags.
        assert.doesNotMatch(html, /<(script|img|iframe|a|object|embed|foreignobject|style|link)\b/i, tex);
        assertKatexOnly(fragment(html), tex);
      }
    }
  });
});

function collectHtml(blocks: unknown): string[] {
  const out: string[] = [];
  JSON.stringify(blocks, (k, v) => (k === 'html' && typeof v === 'string' ? (out.push(v), v) : v));
  return out;
}
