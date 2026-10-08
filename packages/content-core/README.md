# @politost/content-core

Parser, renderer, and validator for [Politost Smartbook](https://github.com/SuperTost100/politost-smartbook) markdown.

Spec: [`spec/content-format.md`](../../spec/content-format.md), format version in [`spec/VERSION`](../../spec/VERSION).

## Install

Each release has an npm tarball attached. Pin it by URL:

```bash
npm install https://github.com/SuperTost100/politost-content-core/releases/download/content-core-v0.3.0/politost-content-core-0.3.0.tgz
```

Or download the `.tgz` and vendor it (`"@politost/content-core": "file:vendor/politost-content-core-0.3.0.tgz"`). Releases up to v0.2.1 had the package at the repository root, so `https://codeload.github.com/SuperTost100/politost-content-core/tar.gz/refs/tags/v0.2.1` still works for those.

The package ships TypeScript source (`exports` points to `src/index.ts`). Consumers need a bundler or `tsx`.

## Test

```bash
npm ci && npm test && npm run typecheck
```

## Exports

- `parseChapterMarkdown`, `parseExercises`, `validateChapter`, `validateBundle`
- `renderContent`, `formulaRender`, `assetResolver`
- `.ptsb` plain packages: `ptsbKind`, `safeUnzip`, `readPtsb`, `parsePtsbEntries`, `readPtsbManifest`. Encrypted packages are detected and refused. Decryption stays in the reader, since it needs the Politost platform
- Types in `types/smartbook.ts`

`readPtsb` and `parsePtsbEntries` return non-fatal validation notices in `bundle.warnings`. Display them to readers, especially when a book declares a newer content-format version. Invalid bundles still throw.

## Changes in 0.3.0

- Markdown inside paragraphs goes through markdown-it (CommonMark): numbered and nested lists, `*italic*`, quotes, code and rules now render. Math, `[[hover:…]]` and `[[link:…]]` are protected before parsing.
- Breaking: `ContentBlock` is now `heading | p | math | list | quote | code | hr | formula | image`, and `InlineSegment` is a tree (`strong`, `em`, `anchor` and `link` carry `children`). `splitMarkdownBlocks` is gone; `renderInlineFragment(text)` lost its `bold` flag. New: `segmentsToHtml`.
- `validateChapter` / `validateBundle` reject leaked generator markup (`</markdown>`, `</invoke>`, …) in every profile.
- `sanitizeHtml` keeps all MathML that KaTeX emits (`mtext`, `msubsup`, `mathvariant`, …), so screen readers get the right formula.
- `validateExercises` warns about a missing `:::hint` only in `esercizi.md`. Exams are practised without hints.
- `CONTENT_FORMAT_VERSION` is `1.2`. A 0.2.x reader shows a "newer format" notice for books that declare `specVersion: "1.2"`.

## License

MIT. The reader, ptsb-pack and the content-format spec stay AGPL-3.0. content-core is MIT so that apps under other licenses, such as PoliTost Pyxis, can read smartbooks with the same code the reader uses.
