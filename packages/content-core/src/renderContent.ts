import katex from 'katex';
import MarkdownIt, { type Token } from 'markdown-it';
import { escapeHtml, sanitizeHtml } from './sanitizeHtml';

const MATH_SLOT = '';
const REF_SLOT = '';
const MATH_SLOT_RE = new RegExp(`${MATH_SLOT}(\\d+)${MATH_SLOT}`, 'g');
const REF_SPLIT_RE = new RegExp(`(${REF_SLOT}\\d+${REF_SLOT})`);
const REF_ONE_RE = new RegExp(`^${REF_SLOT}(\\d+)${REF_SLOT}$`);

/** `source` is the original text, put back verbatim inside code */
type MathSlot = { tex: string; display: boolean; source: string };
type RefSlot = { source: string } & (
  | { kind: 'hover'; formulaId: string }
  | { kind: 'link'; ref: string; label: string }
);

/** Pull $...$ / $$...$$ / \\(\\) / \\[\\] out before markdown so `_`, `*` and `<` stay LaTeX */
function extractMathSlots(text: string, slots: MathSlot[] = []): { text: string; slots: MathSlot[] } {
  const mark = (source: string, tex: string, display: boolean) => {
    const id = slots.length;
    slots.push({ tex: tex.trim(), display, source: restoreSlotSource(source, slots, []) });
    return `${MATH_SLOT}${id}${MATH_SLOT}`;
  };

  const withSlots = text
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (m, tex) => mark(m, tex, true))
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (m, tex) => mark(m, tex, false))
    .replace(/\$\$([\s\S]*?)\$\$/g, (m, tex) => mark(m, tex, true))
    .replace(/\$([^$\n]+)\$/g, (m, tex) => mark(m, tex, false));

  return { text: withSlots, slots };
}

/**
 * [[hover:1.2]] and [[link:ref|label]] become opaque slots so markdown cannot split them.
 * Math in a label goes into `math`.
 */
function extractRefSlots(text: string, math: MathSlot[], slots: RefSlot[] = []): { text: string; slots: RefSlot[] } {
  const withSlots = text.replace(
    /\[\[hover:([\d.]+)\]\]|\[\[link:([^|\]]+)\|([^\]]+)\]\]/g,
    (source: string, formulaId: string | undefined, ref: string | undefined, label: string | undefined) => {
      slots.push(
        formulaId
          ? { kind: 'hover', formulaId, source }
          : { kind: 'link', ref: ref!, label: extractMathOutsideCode(label!, math), source },
      );
      return `${REF_SLOT}${slots.length - 1}${REF_SLOT}`;
    },
  );
  return { text: withSlots, slots };
}

/**
 * Fenced code blocks (also inside quotes and list items) and inline code spans,
 * which keep `$`, `\\(` and `[[…]]` as written
 */
const CODE_RE =
  /^[ \t]*(?:(?:>|[-*+]|\d{1,9}[.)])[ \t]*)*(`{3,}(?=[^`\n]*\n)|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t>]*\1[`~]*[ \t]*$|(?![\s\S]))|(`+)(?!`)[^\n]*?[^`\n]\2(?!`)/gm;

/** Code replaced by spaces, line breaks kept, so validators skip what the renderer shows verbatim. */
export function blankCode(text: string): string {
  return text.replace(CODE_RE, (code) => code.replace(/[^\n]/g, ' '));
}

/**
 * Ref slots first, so code inside a link label cannot split the link; then math, leaving code untouched.
 * A ref inside code is put back by restoreSlotSource.
 */
function extractSlots(text: string): { text: string; ctx: SlotContext } {
  const ctx: SlotContext = { math: [], refs: [] };
  const withRefs = extractRefSlots(text, ctx.math, ctx.refs).text;
  return { text: extractMathOutsideCode(withRefs, ctx.math), ctx };
}

function extractMathOutsideCode(text: string, math: MathSlot[]): string {
  let out = '';
  let last = 0;
  for (const code of text.matchAll(CODE_RE)) {
    out += extractMathSlots(text.slice(last, code.index), math).text + code[0];
    last = code.index + code[0].length;
  }
  return out + extractMathSlots(text.slice(last), math).text;
}

/** Put the original text back for any slot markdown-it still placed inside code */
function restoreSlotSource(text: string, math: MathSlot[], refs: RefSlot[]): string {
  return text
    .replace(MATH_SLOT_RE, (_, i) => math[Number(i)]?.source ?? '')
    .replace(new RegExp(`${REF_SLOT}(\\d+)${REF_SLOT}`, 'g'), (_, i) => refs[Number(i)]?.source ?? '');
}

function renderMathSlot({ tex, display }: MathSlot): string {
  try {
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: false });
    return display ? `<span class="katex-block">${html}</span>` : html;
  } catch {
    return display ? `<span class="katex-error">${escapeHtml(tex)}</span>` : escapeHtml(tex);
  }
}

/** Render LaTeX inline ($...$) and block ($$...$$) inside a plain-text segment */
export function renderLatexInText(text: string): string {
  const { text: slotted, slots } = extractMathSlots(text);
  return escapeHtml(slotted).replace(MATH_SLOT_RE, (_, idx) => renderMathSlot(slots[Number(idx)]));
}

export type InlineSegment =
  | { type: 'text'; html: string }
  | { type: 'strong' | 'em'; children: InlineSegment[] }
  | { type: 'anchor'; href: string; children: InlineSegment[] }
  | { type: 'hover'; formulaId: string }
  | { type: 'link'; ref: string; children: InlineSegment[] };

export type ContentBlock =
  | { type: 'heading'; level: 3 | 4; segments: InlineSegment[] }
  /** `tight`: paragraph inside a tight list item, rendered without a <p> wrapper */
  | { type: 'p'; segments: InlineSegment[]; tight?: boolean }
  | { type: 'math'; html: string }
  | { type: 'list'; ordered: boolean; start: number; items: ContentBlock[][] }
  | { type: 'quote'; blocks: ContentBlock[] }
  | { type: 'code'; text: string }
  | { type: 'hr' }
  | { type: 'formula'; formulaId: string }
  | { type: 'image'; src: string; alt: string; caption?: string };

const md = new MarkdownIt('commonmark', { html: false, linkify: false, typographer: false });
// Indented code and setext headings misfire on generated prose; fenced code and `---` rules stay.
md.disable(['code', 'lheading']);

const SAFE_HREF_RE = /^(https?:|mailto:)/i;

interface SlotContext {
  math: MathSlot[];
  refs: RefSlot[];
}

function textToHtml(text: string, ctx: SlotContext): string {
  return escapeHtml(text).replace(MATH_SLOT_RE, (_, idx) => renderMathSlot(ctx.math[Number(idx)]));
}

function inlineFromTokens(children: Token[], ctx: SlotContext): InlineSegment[] {
  const root: InlineSegment[] = [];
  const stack: InlineSegment[][] = [root];
  const current = () => stack[stack.length - 1];

  const pushHtml = (html: string) => {
    const list = current();
    const last = list[list.length - 1];
    if (last?.type === 'text') last.html += html;
    else list.push({ type: 'text', html });
  };

  const pushText = (text: string) => {
    for (const part of text.split(REF_SPLIT_RE)) {
      if (!part) continue;
      const ref = part.match(REF_ONE_RE);
      if (!ref) {
        pushHtml(textToHtml(part, ctx));
        continue;
      }
      const slot = ctx.refs[Number(ref[1])];
      if (slot.kind === 'hover') {
        current().push({ type: 'hover', formulaId: slot.formulaId });
      } else {
        current().push({ type: 'link', ref: slot.ref, children: parseInlineSlotted(slot.label, ctx) });
      }
    }
  };

  const open = (node: Extract<InlineSegment, { children: InlineSegment[] }>) => {
    current().push(node);
    stack.push(node.children);
  };
  const close = () => {
    if (stack.length > 1) stack.pop();
  };

  for (const token of children) {
    switch (token.type) {
      case 'text':
        pushText(token.content);
        break;
      case 'code_inline':
        pushHtml(`<code>${escapeHtml(restoreSlotSource(token.content, ctx.math, ctx.refs))}</code>`);
        break;
      case 'softbreak':
        pushHtml('\n');
        break;
      case 'hardbreak':
        pushHtml('<br>');
        break;
      case 'strong_open':
        open({ type: 'strong', children: [] });
        break;
      case 'em_open':
        open({ type: 'em', children: [] });
        break;
      case 'link_open': {
        const href = String(token.attrGet('href') ?? '');
        open({ type: 'anchor', href: SAFE_HREF_RE.test(href) ? href : '', children: [] });
        break;
      }
      case 'strong_close':
      case 'em_close':
      case 'link_close':
        close();
        break;
      case 'image':
        pushText(token.content);
        break;
      default:
        if (token.content) pushText(token.content);
    }
  }

  return sanitizeSegments(root);
}

function sanitizeSegments(segments: InlineSegment[]): InlineSegment[] {
  for (const seg of segments) {
    if (seg.type === 'text') seg.html = sanitizeHtml(seg.html);
    else if ('children' in seg) sanitizeSegments(seg.children);
  }
  return segments;
}

function parseInlineSlotted(text: string, ctx: SlotContext): InlineSegment[] {
  const tokens = md.parseInline(text, {});
  return inlineFromTokens(tokens[0]?.children ?? [], ctx);
}

/** Inline markdown (bold, italic, code, math, hovers, links) as a segment tree */
export function parseInlineSegments(text: string): InlineSegment[] {
  const { text: slotted, ctx } = extractSlots(text);
  return parseInlineSlotted(slotted, ctx);
}

/** Serialize segments to static HTML (hovers become "(1.2)", links keep their label) */
export function segmentsToHtml(segments: InlineSegment[]): string {
  return segments
    .map((seg) => {
      switch (seg.type) {
        case 'text':
          return seg.html;
        case 'strong':
        case 'em':
          return `<${seg.type}>${segmentsToHtml(seg.children)}</${seg.type}>`;
        case 'anchor':
        case 'link':
          return segmentsToHtml(seg.children);
        case 'hover':
          return `(${escapeHtml(seg.formulaId)})`;
      }
    })
    .join('');
}

/** Inline-only HTML string, no block wrappers */
export function renderInlineFragment(text: string): string {
  return segmentsToHtml(parseInlineSegments(text));
}

/** Paragraph made of a single display-math slot → standalone math block */
function displayMathOnly(inline: Token | undefined, ctx: SlotContext): string | null {
  const only = inline?.children?.length === 1 ? inline.children[0] : null;
  const m = only?.type === 'text' ? only.content.trim().match(new RegExp(`^${MATH_SLOT}(\\d+)${MATH_SLOT}$`)) : null;
  const slot = m ? ctx.math[Number(m[1])] : null;
  return slot?.display ? sanitizeHtml(renderMathSlot(slot)) : null;
}

function blocksFromMarkdown(text: string): ContentBlock[] {
  const { text: slotted, ctx } = extractSlots(text);
  const tokens = md.parse(slotted, {});

  const root: ContentBlock[] = [];
  const containers: ContentBlock[][] = [root];
  const lists: Extract<ContentBlock, { type: 'list' }>[] = [];
  const current = () => containers[containers.length - 1];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'heading_open': {
        const inline = tokens[i + 1];
        const level = Number(token.tag.slice(1)) >= 4 ? 4 : 3;
        current().push({ type: 'heading', level, segments: inlineFromTokens(inline.children ?? [], ctx) });
        i += 2;
        break;
      }
      case 'paragraph_open': {
        const inline = tokens[i + 1];
        const mathHtml = displayMathOnly(inline, ctx);
        if (mathHtml) {
          current().push({ type: 'math', html: mathHtml });
        } else {
          const block: ContentBlock = { type: 'p', segments: inlineFromTokens(inline.children ?? [], ctx) };
          if (token.hidden) block.tight = true;
          current().push(block);
        }
        i += 2;
        break;
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const list: Extract<ContentBlock, { type: 'list' }> = {
          type: 'list',
          ordered: token.type === 'ordered_list_open',
          start: Number(token.attrGet('start') ?? 1),
          items: [],
        };
        current().push(list);
        lists.push(list);
        break;
      }
      case 'bullet_list_close':
      case 'ordered_list_close':
        lists.pop();
        break;
      case 'list_item_open': {
        const item: ContentBlock[] = [];
        lists[lists.length - 1].items.push(item);
        containers.push(item);
        break;
      }
      case 'blockquote_open': {
        const quote: Extract<ContentBlock, { type: 'quote' }> = { type: 'quote', blocks: [] };
        current().push(quote);
        containers.push(quote.blocks);
        break;
      }
      case 'list_item_close':
      case 'blockquote_close':
        containers.pop();
        break;
      case 'fence':
        current().push({ type: 'code', text: restoreSlotSource(token.content.replace(/\n$/, ''), ctx.math, ctx.refs) });
        break;
      case 'hr':
        current().push({ type: 'hr' });
        break;
    }
  }

  return root;
}

/** Senza gruppi di cattura annidati (split con due gruppi alternati inserisce `undefined`) */
const BLOCK_MARKER_RE = /<!--FORMULA:[\d.]+-->|<!--IMAGE:\{[\s\S]*?\}-->/g;

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

/** Parse smartbook body into blocks; numbered formulas and images split the markdown flow */
export function parseContentBlocks(content: string): ContentBlock[] {
  if (!content) return [];

  const blocks: ContentBlock[] = [];
  const re = new RegExp(BLOCK_MARKER_RE.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const appendMarkdown = (text: string) => {
    if (text.trim()) blocks.push(...blocksFromMarkdown(text));
  };

  while ((match = re.exec(content)) !== null) {
    appendMarkdown(content.slice(lastIndex, match.index));

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

  appendMarkdown(content.slice(lastIndex));
  return blocks;
}
