import assert from 'node:assert/strict';

/**
 * Formulas that try to get markup, scripts, handlers or URLs through KaTeX with `trust` off.
 * Trusted output for each must hold only what assertKatexOnly allows.
 */
export const HOSTILE_FORMULAS: readonly string[] = [
  '\\href{javascript:alert(1)}{x}',
  '\\href{https://example.com" onmouseover="alert(1)}{x}',
  '\\url{javascript:alert(1)}',
  '\\includegraphics{javascript:alert(1)}',
  '\\includegraphics[height=1em]{https://example.com/x.png}',
  '\\htmlData{onclick=alert(1)}{x}',
  '\\htmlClass{x" onclick="alert(1)}{x}',
  '\\htmlStyle{background:url(javascript:alert(1))}{x}',
  '\\htmlId{x" onfocus="alert(1)}{x}',
  '\\unicode{60}script\\unicode{62}',
  '\\char"3C script\\char"3E alert(1)',
  '\\char`<',
  '\\text{<script>alert(1)</script>}',
  '\\text{<img src=x onerror=alert(1)>}',
  '\\textbackslash script',
  '\\text{&lt;script&gt;alert(1)&lt;/script&gt;}',
  '\\text{&#60;img src=x onerror=alert(1)&#62;}',
  '\\text{"><svg onload=alert(1)>}',
  '\\def\\x{<script>}\\x',
  '\\newcommand{\\evil}{\\href{javascript:alert(1)}{x}}\\evil',
  '\\gdef\\a{\\a\\a}\\a',
  '\\def\\b{\\b b}\\b',
  '\\def\\c#1{#1#1#1#1}\\c{\\c{\\c{\\c{\\c{\\c{\\c{\\c{x}}}}}}}}',
  '\\color{red;background:url(javascript:alert(1))}{x}',
  '\\color{expression(alert(1))}{x}',
  '\\color{#f00" onmouseover="alert(1)}{x}',
  '\\colorbox{red}{x}',
  '\\colorbox{url(javascript:alert(1))}{x}',
  '\\fcolorbox{red}{blue;position:fixed}{x}',
  '\\textcolor{javascript:alert(1)}{x}',
  '\\rule{100000em}{100000em}',
  '\\rule{1e9pt}{1pt}',
  '\\verb|<script>alert(1)</script>|',
  '\\verb!<img src=x onerror=alert(1)>!',
  '\\operatorname{<script>}',
  '\\mathrm{"onmouseover="alert(1)}',
  '\\tag{<img src=x onerror=alert(1)>}x',
  '\\label{"><script>}x',
  '\\begin{array}{l}<script>\\end{array}',
  '\\cancel{\\text{<svg/onload=alert(1)>}}',
  '\\sqrt[<script>]{x}',
  '\\xrightarrow[<img onerror=a>]{x}',
  '\\raisebox{1e9em}{x}',
  '\\kern1e9em x',
  '\\html@mathml{<script>}{x}',
  '\\@char{60}',
  '\\mathchoice{<a>}{<b>}{<c>}{<d>}',
  '\\text{\\textasciitilde\\textless script\\textgreater}',
];

/** Elements in KaTeX's output, plus the wrappers content-core and the reader's text add around it. */
const ALLOWED_ELEMENTS = new Set([
  'span', 'svg', 'path', 'line',
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
  'msup', 'msub', 'msubsup', 'mfrac', 'mover', 'munder', 'munderover', 'msqrt', 'mroot',
  'mtable', 'mtr', 'mtd', 'mlabeledtr', 'mstyle', 'mspace', 'mpadded', 'mphantom', 'menclose',
  'div', 'p', 'code', 'br',
]);

/** Attributes KaTeX emits. `linebreak` is the only one sanitizeHtml drops. */
const ALLOWED_ATTRIBUTES = new Set([
  'class', 'style', 'aria-hidden', 'encoding', 'xmlns',
  'width', 'height', 'viewbox', 'preserveaspectratio', 'd',
  'x1', 'y1', 'x2', 'y2', 'stroke-width',
  'mathvariant', 'stretchy', 'separator', 'fence', 'accent', 'accentunder', 'scriptlevel',
  'displaystyle', 'linethickness', 'rowspacing', 'columnspacing', 'columnalign', 'columnlines',
  'rowlines', 'rowalign', 'lspace', 'rspace', 'minsize', 'maxsize', 'movablelimits', 'symmetric',
  'largeop', 'depth', 'voffset', 'notation', 'mathcolor', 'mathbackground', 'display', 'side',
  'linebreak',
]);

const UNSAFE_VALUE = /javascript:|vbscript:|data:|url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding/i;

/** Walks the parsed DOM and fails on any element, attribute or attribute value outside the allowlists. */
export function assertKatexOnly(root: DocumentFragment, label: string): void {
  const walk = (node: Element) => {
    const name = node.localName.toLowerCase();
    assert.ok(ALLOWED_ELEMENTS.has(name), `${label}: element <${name}>`);
    for (const attr of Array.from(node.attributes)) {
      const attrName = attr.name.toLowerCase();
      assert.ok(ALLOWED_ATTRIBUTES.has(attrName), `${label}: attribute ${attrName} on <${name}>`);
      assert.doesNotMatch(attr.value, UNSAFE_VALUE, `${label}: ${attrName}="${attr.value}"`);
      if (attrName === 'xmlns') assert.match(attr.value, /^http:\/\/www\.w3\.org\/(1998\/Math\/MathML|2000\/svg)$/, label);
    }
    for (const child of Array.from(node.children)) walk(child);
  };
  for (const child of Array.from(root.children)) walk(child);
}
