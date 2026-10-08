import createDOMPurify from 'dompurify';

/** Every MathML element KaTeX emits; a missing one leaves broken MathML for screen readers. */
const KATEX_TAGS = [
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
  'msup', 'msub', 'msubsup', 'mfrac', 'mover', 'munder', 'munderover', 'msqrt', 'mroot',
  'mtable', 'mtr', 'mtd', 'mlabeledtr', 'mstyle', 'mspace', 'mpadded', 'mphantom', 'menclose',
];

const KATEX_MATHML_ATTR = [
  'mathvariant', 'stretchy', 'separator', 'fence', 'accent', 'accentunder', 'scriptlevel',
  'displaystyle', 'linethickness', 'rowspacing', 'columnspacing', 'columnalign', 'columnlines',
  'rowlines', 'rowalign', 'lspace', 'rspace', 'minsize', 'maxsize', 'movablelimits', 'symmetric',
  'largeop', 'depth', 'voffset', 'notation', 'mathcolor', 'mathbackground', 'display', 'side',
];

/** `line` draws the strokes of \cancel, \bcancel and \xcancel. */
const KATEX_SVG_TAGS = ['svg', 'path', 'line'];

const ALLOWED_TAGS = [
  'strong', 'em', 'code', 'span', 'div', 'p', 'br',
  ...KATEX_TAGS,
  ...KATEX_SVG_TAGS,
];

const ALLOWED_ATTR = [
  'class', 'style', 'aria-hidden', 'encoding', 'xmlns',
  'width', 'height', 'viewBox', 'preserveAspectRatio', 'd',
  'x1', 'y1', 'x2', 'y2', 'stroke-width',
  ...KATEX_MATHML_ATTR,
];

let purify: ReturnType<typeof createDOMPurify> | null = null;

function getPurify(): ReturnType<typeof createDOMPurify> {
  if (!purify) {
    purify = createDOMPurify(window);
  }
  return purify;
}

/** Sanitize HTML produced by KaTeX / markdown renderer before innerHTML injection. */
export function sanitizeHtml(html: string): string {
  return getPurify().sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/** Escape plain text before mixing with HTML transforms. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
