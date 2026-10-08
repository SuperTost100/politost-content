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
  countOrphanFormulaLines,
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
  ValidateProfile,
  ValidateChapterOptions,
  BundleValidateOptions,
} from './validateChapter';

export { validateExercises } from './validateExercises';
export type { ExerciseValidationResult } from './validateExercises';

export { serializeChapter } from './serializeChapter';
export { parseChapterFrontmatter, withChapterFrontmatter } from './chapterFrontmatter';

export {
  PTSB_ZIP_LIMITS,
  ptsbKind,
  safeUnzip,
  parsePtsbEntries,
  readPtsb,
  readPtsbManifest,
} from './ptsb';
export type { ZipLimits, PtsbManifest, PtsbBundle, PtsbKind } from './ptsb';

export { CONTENT_FORMAT_VERSION, validateBookMeta, compareSpecVersions } from './bookMeta';
export type { BookMeta } from './bookMeta';
