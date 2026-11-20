import { sanitizeHtml } from './sanitizeHtml';

/** Options of the functions that return sanitized HTML with formulas in it. */
export interface RenderOptions {
  /**
   * `true` inserts KaTeX's output for formulas that rendered without an error as KaTeX produced
   * it, without DOMPurify. Every other piece of HTML is sanitized as with `false`. Pass it only for
   * text the app already trusts, such as a package whose bytes matched a published hash; the
   * conditions are in the README, "Trusted math". Default `false`.
   */
  mathTrusted?: boolean;
}

const SLOT = '';
const SLOT_RE = /(\d+)/g;

/** The placeholder for `katex[index]` in the HTML given to sanitizeAroundMath. */
export function trustedMathSlot(index: number): string {
  return `${SLOT}${index}${SLOT}`;
}

function slotChars(html: string): number {
  let count = 0;
  for (let i = html.indexOf(SLOT); i !== -1; i = html.indexOf(SLOT, i + 1)) count++;
  return count;
}

/**
 * Sanitizes `html`, then puts `katex[i]` where `html` has trustedMathSlot(i). The placeholders sit
 * in escaped text, so after DOMPurify they are text nodes and the KaTeX output goes in at a text
 * position. Returns null when `html` has a U+E002 character that is not one of the `katex.length`
 * placeholders, such as one written in the book, so the caller renders the untrusted way instead.
 */
export function sanitizeAroundMath(html: string, katex: readonly string[]): string | null {
  if (katex.length === 0) return sanitizeHtml(html);
  const expected = 2 * katex.length;
  if (slotChars(html) !== expected) return null;
  const clean = sanitizeHtml(html);
  if (slotChars(clean) !== expected) return null;
  return clean.replace(SLOT_RE, (_, i: string) => katex[Number(i)] ?? '');
}
