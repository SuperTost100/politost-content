import katex from 'katex';
import { escapeHtml, sanitizeHtml } from './sanitizeHtml';

const MATH_SLOT = '\uE000';

type MathSlot = { tex: string; display: boolean };

/** Pull $...$ / $$...$$ / \\(\\) / \\[\\] out before HTML escape so KaTeX sees raw < > */
function extractMathSlots(text: string): { text: string; slots: MathSlot[] } {
  const slots: MathSlot[] = [];
  const mark = (tex: string, display: boolean) => {
    const id = slots.length;
    slots.push({ tex, display });
    return `${MATH_SLOT}${id}${MATH_SLOT}`;
  };

  const withSlots = text
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, tex) => mark(tex.trim(), true))
    .replace(/\\\(([^)]+)\\\)/g, (_, tex) => mark(tex.trim(), false))
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => mark(tex.trim(), true))
    .replace(/\$([^$\n]+)\$/g, (_, tex) => mark(tex.trim(), false));

  return { text: withSlots, slots };
}

function renderMathSlot({ tex, display }: MathSlot): string {
  try {
    if (display) {
      return `<div class="katex-block">${katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
    }
    return katex.renderToString(tex, { displayMode: false, throwOnError: false });
  } catch {
    if (display) {
      return `<div class="katex-error">${escapeHtml(tex)}</div>`;
    }
    return escapeHtml(tex);
  }
}

/** Render LaTeX inline ($...$) and block ($$...$$) inside a text segment */
export function renderLatexInText(text: string): string {
  const { text: slotted, slots } = extractMathSlots(text);
  const escaped = escapeHtml(slotted);
  const slotRe = new RegExp(`${MATH_SLOT}(\\d+)${MATH_SLOT}`, 'g');
  return escaped.replace(slotRe, (_, idx) => renderMathSlot(slots[Number(idx)]));
}

function applyBold(html: string): string {
  return html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/<\/strong>(?=[\wÀ-ÿ(])/g, '</strong> ')
    .replace(/(?<=[\wÀ-ÿ)!])<strong>/g, ' <strong>');
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: string[] };

/** Split markdown body into paragraphs, h3 and bullet lists */
export function splitMarkdownBlocks(text: string): Block[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const withSplitBullets = normalized.replace(/:\s+-\s+/g, ':\n\n- ').replace(/\s+-\s+(?=\*\*)/g, '\n- ');

  const blocks: Block[] = [];
  let currentList: string[] | null = null;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    const joined = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
    paragraphLines = [];
    if (joined) blocks.push({ kind: 'p', text: joined });
  };

  const flushList = () => {
    if (currentList?.length) blocks.push({ kind: 'ul', items: currentList });
    currentList = null;
  };

  const lines = withSplitBullets.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      const next = lines.slice(i + 1).find((l) => l.trim());
      if (next && /^[-*]\s+/.test(next.trim())) {
        continue;
      }
      flushList();
      flushParagraph();
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flushList();
      flushParagraph();
      blocks.push({ kind: 'h3', text: h3[1].trim() });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!currentList) currentList = [];
      currentList.push(bullet[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushList();
  flushParagraph();
  return blocks;
}

function splitEdgeWhitespace(text: string): { leading: string; core: string; trailing: string } {
  const leading = text.match(/^\s*/)?.[0] ?? '';
  const trailing = text.match(/\s*$/)?.[0] ?? '';
  const core = text.slice(leading.length, text.length - trailing.length);
  return { leading, core, trailing };
}

/** Inline-only: no paragraph wrappers (for text split around refs) */
export function renderInlineFragment(text: string, bold = false): string {
  if (!text) return '';
  const { leading, core, trailing } = splitEdgeWhitespace(text);
  if (!core) return escapeHtml(text);

  let html = sanitizeHtml(applyBold(renderLatexInText(core)));
  if (bold) html = `<strong>${html}</strong>`;
  return leading + html + trailing;
}

export type InlineSegment =
  | { type: 'text'; html: string }
  | { type: 'hover'; formulaId: string; bold?: boolean }
  | { type: 'link'; ref: string; label: string; bold?: boolean };

const INLINE_SEGMENT_RE = /(\[\[hover:[\d.]+\]\]|\[\[link:[^\]]+\]\])/g;
const BOLD_BLOCK_RE = /\*\*((?:[^*]|\[\[hover:[\d.]+\]\])+)\*\*/g;
/** Senza gruppi di cattura annidati (split con due gruppi alternati inserisce `undefined`) */
const BLOCK_MARKER_RE = /<!--FORMULA:[\d.]+-->|<!--IMAGE:\{[\s\S]*?\}-->/g;

function parseInlineSegmentsRaw(text: string, bold = false): InlineSegment[] {
  const parts = text.split(INLINE_SEGMENT_RE).filter((p) => Boolean(p?.length));
  const segments: InlineSegment[] = [];

  for (const part of parts) {
    const hover = part.match(/\[\[hover:([\d.]+)\]\]/);
    if (hover) {
      segments.push({ type: 'hover', formulaId: hover[1], bold });
      continue;
    }

    const link = part.match(/\[\[link:([^|]+)\|([^\]]+)\]\]/);
    if (link) {
      segments.push({ type: 'link', ref: link[1], label: link[2], bold });
      continue;
    }

    const html = renderInlineFragment(part, bold);
    if (html) segments.push({ type: 'text', html });
  }

  return segments;
}

/** Split inline text around formula hovers and internal links */
export function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(BOLD_BLOCK_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parseInlineSegmentsRaw(text.slice(lastIndex, match.index)));
    }
    segments.push(...parseInlineSegmentsRaw(match[1], true));
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push(...parseInlineSegmentsRaw(text.slice(lastIndex)));
  }

  return segments;
}

export type ContentBlock =
  | { type: 'h3'; segments: InlineSegment[] }
  | { type: 'p'; segments: InlineSegment[] }
  | { type: 'ul'; items: InlineSegment[][] }
  | { type: 'formula'; formulaId: string }
  | { type: 'image'; src: string; alt: string; caption?: string };

function parseImageMarker(chunk: string): ContentBlock | null {
  const match = chunk.match(/<!--IMAGE:(\{[\s\S]*?\})-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { src?: string; alt?: string; caption?: string };
    if (!parsed.src || !parsed.alt) return null;
    return { type: 'image', src: parsed.src, alt: parsed.alt, caption: parsed.caption };
  } catch {
    return null;
  }
}

function appendMarkdownBlocks(blocks: ContentBlock[], text: string): void {
  if (!text.trim()) return;

  for (const md of splitMarkdownBlocks(text)) {
    if (md.kind === 'h3') {
      blocks.push({ type: 'h3', segments: parseInlineSegments(md.text) });
    } else if (md.kind === 'ul') {
      blocks.push({
        type: 'ul',
        items: md.items.map((item) => parseInlineSegments(item)),
      });
    } else {
      blocks.push({ type: 'p', segments: parseInlineSegments(md.text) });
    }
  }
}

/** Parse smartbook body into block structure with inline refs inside paragraphs and list items */
export function parseContentBlocks(content: string): ContentBlock[] {
  if (!content) return [];

  const blocks: ContentBlock[] = [];
  const re = new RegExp(BLOCK_MARKER_RE.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    appendMarkdownBlocks(blocks, content.slice(lastIndex, match.index));

    const marker = match[0];
    const formula = marker.match(/<!--FORMULA:([\d.]+)-->/);
    if (formula) {
      blocks.push({ type: 'formula', formulaId: formula[1] });
    } else {
      const image = parseImageMarker(marker);
      if (image) blocks.push(image);
    }

    lastIndex = re.lastIndex;
  }

  appendMarkdownBlocks(blocks, content.slice(lastIndex));
  return blocks;
}
