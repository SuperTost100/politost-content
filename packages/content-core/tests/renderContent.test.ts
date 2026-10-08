import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { ContentBlock, InlineSegment } from '../src/renderContent.ts';

before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  (globalThis as { window: unknown }).window = dom.window;
});

const load = () => import('../src/renderContent.ts');

function textOf(segments: InlineSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'text') return s.html;
      if (s.type === 'hover') return `[hover ${s.formulaId}]`;
      return `<${s.type}>${textOf(s.children)}</${s.type}>`;
    })
    .join('');
}

describe('parseInlineSegments', () => {
  it('nests bold text between plain text', async () => {
    const { parseInlineSegments } = await load();
    const segments = parseInlineSegments('Un **campo** è un insieme');
    assert.deepEqual(segments, [
      { type: 'text', html: 'Un ' },
      { type: 'strong', children: [{ type: 'text', html: 'campo' }] },
      { type: 'text', html: ' è un insieme' },
    ]);
  });

  it('renders single asterisks as italics', async () => {
    const { parseInlineSegments } = await load();
    assert.equal(textOf(parseInlineSegments('il *passo induttivo* vale')), 'il <em>passo induttivo</em> vale');
  });

  it('preserves spaces around internal links', async () => {
    const { parseInlineSegments } = await load();
    const segments = parseInlineSegments('torna al [[link:chapter/1#p2|paragrafo sulle sezioni]] oppure vai avanti');
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type === 'text' ? segments[0].html : '', 'torna al ');
    assert.equal(segments[1].type, 'link');
    assert.equal(segments[1].type === 'link' ? segments[1].ref : '', 'chapter/1#p2');
    assert.equal(segments[2].type === 'text' ? segments[2].html : '', ' oppure vai avanti');
  });

  it('preserves spaces around formula hovers', async () => {
    const { parseInlineSegments } = await load();
    const segments = parseInlineSegments('Come nella [[hover:2.1]], si ottiene');
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type === 'text' ? segments[0].html : '', 'Come nella ');
    assert.equal(segments[1].type, 'hover');
    assert.equal(segments[2].type === 'text' ? segments[2].html : '', ', si ottiene');
  });

  it('keeps a hover inside bold text', async () => {
    const { parseInlineSegments } = await load();
    assert.equal(textOf(parseInlineSegments('**vedi [[hover:1.2]] qui**')), '<strong>vedi [hover 1.2] qui</strong>');
  });

  it('does not read underscores and asterisks inside math as emphasis', async () => {
    const { parseInlineSegments } = await load();
    const html = textOf(parseInlineSegments('sia $a_1 * b_2$ e $c_1$'));
    assert.doesNotMatch(html, /<em>/);
    assert.match(html, /katex/);
  });

  it('escapes raw HTML in the source', async () => {
    const { parseInlineSegments } = await load();
    assert.equal(textOf(parseInlineSegments('a <script>x</script> b')), 'a &lt;script&gt;x&lt;/script&gt; b');
  });

  it('drops unsafe hrefs from markdown links', async () => {
    const { parseInlineSegments } = await load();
    const [ftp] = parseInlineSegments('[x](ftp://example.org)');
    assert.equal(ftp.type === 'anchor' ? ftp.href : 'none', '');
    const js = parseInlineSegments('[x](javascript:alert(1))');
    assert.ok(js.every((s) => s.type !== 'anchor'));
  });
});

describe('renderLatexInText', () => {
  it('renders < and > inside inline math without HTML entities', async () => {
    const { renderLatexInText } = await load();
    const html = renderLatexInText('opposta direzione se $k < 0$');
    assert.doesNotMatch(html, /katex-error|&amp;lt;|&amp;gt;/);
    assert.match(html, /class="mrel"/);
    assert.match(html, /opposta direzione se/);
  });

  it('keeps a parenthesis inside \\\\(...\\\\)', async () => {
    const { renderLatexInText } = await load();
    const html = renderLatexInText('\\(f(x)\\)');
    assert.match(html, /katex/);
    assert.doesNotMatch(html, /\\\(f/);
    assert.match(html, />f</);
    assert.match(html, />x</);
  });
});

describe('parseContentBlocks', () => {
  const ofType = <T extends ContentBlock['type']>(blocks: ContentBlock[], type: T) =>
    blocks.filter((b): b is Extract<ContentBlock, { type: T }> => b.type === type);

  it('renders an ordered list of italic items (induction theorem)', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks(
      '*Se:*\n\n1. *(base induttiva) $P(n_0)$ è vera;*\n2. *(passo induttivo) se $P(n)$ è vera allora è vera $P(n+1)$;*\n\n*allora vale.*',
    );
    const [list] = ofType(blocks, 'list');
    assert.ok(list);
    assert.equal(list.ordered, true);
    assert.equal(list.start, 1);
    assert.equal(list.items.length, 2);
    const first = list.items[0][0];
    assert.equal(first.type, 'p');
    assert.equal(first.type === 'p' && first.tight, true);
    const html = first.type === 'p' ? textOf(first.segments) : '';
    assert.match(html, /^<em>\(base induttiva\) /);
    assert.doesNotMatch(html, /\*/);
  });

  it('keeps list numbering that continues after a formula', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks('1. uno\n\n<!--FORMULA:1.1-->\n\n2. due');
    assert.deepEqual(blocks.map((b) => b.type), ['list', 'formula', 'list']);
    const lists = ofType(blocks, 'list');
    assert.equal(lists[1].start, 2);
  });

  it('parses bullets directly after a sentence, plus headings', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks(
      'Due classi principali:\n- **Alifatici**: senza anello.\n- **Aromatici**: con anello.\n\n### Struttura\n\nFormula $C_6H_6$.',
    );
    assert.deepEqual(blocks.map((b) => b.type), ['p', 'list', 'heading', 'p']);
    const [list] = ofType(blocks, 'list');
    assert.equal(list.ordered, false);
    assert.equal(list.items.length, 2);
  });

  it('turns a paragraph made only of display math into a math block', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks('Vale\n\n$$\\mathbb{N} \\subset \\mathbb{Z}$$\n\ndunque.');
    assert.deepEqual(blocks.map((b) => b.type), ['p', 'math', 'p']);
  });

  it('keeps display math with blank lines inside it in one piece', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks('$$\na = 1\n\nb = 2\n$$');
    assert.deepEqual(blocks.map((b) => b.type), ['math']);
  });

  it('parses blockquotes and does not treat indented text as code', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks('> *Nota*: attenzione.\n\n    testo rientrato');
    assert.deepEqual(blocks.map((b) => b.type), ['quote', 'p']);
  });

  it('keeps LaTeX and refs in a code block exactly as written', async () => {
    const { parseContentBlocks } = await load();
    const source = 'Esempio $\\alpha$ e \\(x\\), poi [[hover:1.2]] e [[link:ref:chapter/1#p2|qui $y$]].';
    const blocks = parseContentBlocks(`\`\`\`latex\n${source}\n\\[ y = 1 \\]\n\`\`\``);
    assert.deepEqual(blocks, [{ type: 'code', text: `${source}\n\\[ y = 1 \\]` }]);
  });

  it('does not let $$ pair across a code fence', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks('Costo $$ alto.\n\n```\nprint("$$")\n```\n\nFine.');
    assert.deepEqual(blocks.map((b) => b.type), ['p', 'code', 'p']);
    assert.deepEqual(ofType(blocks, 'code')[0], { type: 'code', text: 'print("$$")' });
  });

  it('does not let $$ pair across a fence inside a quote or a list item', async () => {
    const { parseContentBlocks } = await load();
    for (const [open, close] of [['> ```', '> ```'], ['- ```', '  ```']]) {
      const blocks = parseContentBlocks(`Costo $$ alto.\n\n${open}\n${close.slice(0, 2)}x = "$$"\n${close}\n\nFine.`);
      assert.deepEqual(blocks.map((b) => b.type), ['p', open.startsWith('>') ? 'quote' : 'list', 'p'], open);
      assert.doesNotMatch(JSON.stringify(blocks), /katex/, open);
    }
  });

  it('keeps math in inline code as source and still renders math outside it', async () => {
    const { parseInlineSegments } = await load();
    const html = textOf(parseInlineSegments('Scrivi `$\\frac{a}{b}$` per ottenere $\\frac{a}{b}$, o `[[hover:1.1]]`.'));
    assert.match(html, /<code>\$\\frac\{a\}\{b\}\$<\/code>/);
    assert.match(html, /<code>\[\[hover:1\.1\]\]<\/code>/);
    assert.match(html, /class="katex"/);
  });

  it('keeps math inside a link label', async () => {
    const { parseInlineSegments } = await load();
    const segments = parseInlineSegments('Vedi [[link:ref:formula/1.1|la $x^2$]] e $y$.');
    const link = segments.find((s) => s.type === 'link');
    assert.ok(link && 'children' in link);
    assert.match(textOf(link.children), /class="katex"/);
  });

  it('does not make a heading out of text followed by ---', async () => {
    const { parseContentBlocks } = await load();
    const blocks = parseContentBlocks('Testo\n---');
    assert.equal(ofType(blocks, 'heading').length, 0);
  });
});
