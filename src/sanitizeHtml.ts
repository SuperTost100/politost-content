import createDOMPurify from 'dompurify';

const KATEX_TAGS = [
  'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac',
  'mover', 'munder', 'munderover', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd',
  'mstyle', 'mspace', 'annotation',
];

const KATEX_SVG_TAGS = ['svg', 'path'];

const ALLOWED_TAGS = [
  'strong', 'span', 'div', 'p', 'br',
  ...KATEX_TAGS,
  ...KATEX_SVG_TAGS,
];

const ALLOWED_ATTR = [
  'class', 'style', 'aria-hidden', 'encoding', 'xmlns',
  'width', 'height', 'viewBox', 'preserveAspectRatio', 'd',
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
