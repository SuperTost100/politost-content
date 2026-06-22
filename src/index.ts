export type {
  SectionConfig,
  SmartbookConfig,
  ChapterMeta,
  FormulaRef,
  Paragraph,
  Chapter,
  Exercise,
  IdeSnippet,
  GraficoConfig,
  SectionKey,
} from './types/smartbook';

export type { ImageRef } from './parser';
export {
  processImageBlocks,
  extractImageRefs,
  hasExternalImageMarkdown,
  parseChapterMarkdown,
  parseExercises,
  buildFormulaIndex,
  processInlineRefs,
  processLinks,
  preprocessContent,
} from './parser';

export {
  renderLatexInText,
  splitMarkdownBlocks,
  renderInlineFragment,
  parseInlineSegments,
  parseContentBlocks,
} from './renderContent';
export type { InlineSegment, ContentBlock } from './renderContent';

export {
  extractDisplayTex,
  renderDisplayTex,
  renderFormulaLatex,
  renderNumberedFormulaHtml,
} from './formulaRender';
export type { FormulaRenderVariant } from './formulaRender';

export {
  ALLOWED_IMAGE_EXT,
  MAX_ASSET_BYTES,
  MAX_BOOK_ASSETS_BYTES,
  ASSET_PATH_RE,
  isValidAssetPath,
  mimeForAssetPath,
  buildAssetUrlMap,
  revokeAssetUrls,
  validateAssetSizes,
} from './assetResolver';

export { sanitizeHtml, escapeHtml } from './sanitizeHtml';

export { validateChapter, validateBundle } from './validateChapter';
export type {
  ChapterValidationResult,
  BundleValidationResult,
} from './validateChapter';
