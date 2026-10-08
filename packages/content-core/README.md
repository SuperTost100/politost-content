# @politost/content-core

Parser, renderer, and validator for [Politost Smartbook](https://github.com/SuperTost100/politost-smartbook) markdown.

Spec: [`spec/content-format.md`](../../spec/content-format.md), format version in [`spec/VERSION`](../../spec/VERSION).

## Install

Each release has an npm tarball attached. Pin it by URL:

```bash
npm install https://github.com/SuperTost100/politost-content/releases/download/content-core-v0.4.0/politost-content-core-0.4.0.tgz
```

Or download the `.tgz` and vendor it (`"@politost/content-core": "file:vendor/politost-content-core-0.4.0.tgz"`). Releases up to v0.2.1 had the package at the repository root, so `https://codeload.github.com/SuperTost100/politost-content/tar.gz/refs/tags/v0.2.1` still works for those.

The package ships TypeScript source (`exports` points to `src/index.ts`). Consumers need a bundler or `tsx`.

> [!IMPORTANT]
> The HTML from `renderContent` and `formulaRender` needs the KaTeX stylesheet from the same KaTeX version that content-core uses, currently `katex@^0.19.0`. Add that range to the app's own dependencies so npm installs a single copy, and import `katex/dist/katex.min.css` from it. A stylesheet from KaTeX 0.17 or older does not match the class names and breaks formula layout.

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

## Changes in 0.4.0

- Breaking: KaTeX goes from 0.17 to 0.19. From 0.18 on, KaTeX renames some of its classes (`base`, `strut`, `tag`, `accent`, `sizing` and others now start with `katex-`), so apps must update their KaTeX stylesheet together with content-core. See [Install](#install). Most classes keep their names, including `katex`, `katex-display` and atom classes like `mord` and `mrel`.
- This also fixes Dependabot alert 3 (prototype pollution in KaTeX settings, fixed in 0.18.2). content-core never sets `trust`, so it was not exploitable here.
- `sanitizeHtml` keeps the SVG `line` elements of `\cancel`, `\bcancel` and `\xcancel`. Before, the strike-through was removed and only the crossed-out term showed.

## Changes in 0.3.2

- `serializeChapter` keeps `$$` in numbered formulas. 0.3.1 wrote `$$v$$` back as `$v$`.
- Chapters and exercise files saved with Windows line endings (CRLF) parse like the others. Before, their formulas were lost.
- Text before `## p1` stays in p1, with a warning. Before, it shifted every paragraph's text by one and dropped the last.
- `{{formula:X.Y}}` can point to a formula in another chapter, as the reader already allowed. Ship mode used to reject it.
- Fenced code and inline code are skipped by the `**` and LaTeX checks, so `x**2` in a Python block is no longer an error.
- A missing image is reported once instead of three times.
- `esercizi.md` and `esami.md` can put `type:` anywhere in the frontmatter.
- `validateBundle` rejects duplicate chapter numbers or files and non-integer numbers. It warns about missing `sections`, links to paragraphs missing in other chapters, and, in exercises, unknown `chapter`, broken refs and invalid LaTeX.
- `parsePtsbEntries` gives a clear error when `smartbook.json` is not an object.

## Changes in 0.3.1

- Inline code inside a link label (`` [`print()`](ref:chapter/1#p2) ``) no longer breaks the link. 0.3.0 showed the raw `[[link:…]]` text.

## Changes in 0.3.0

- Markdown inside paragraphs goes through markdown-it (CommonMark): numbered and nested lists, `*italic*`, quotes, code and rules now render. Math, `[[hover:…]]` and `[[link:…]]` are protected before parsing.
- Breaking: `ContentBlock` is now `heading | p | math | list | quote | code | hr | formula | image`, and `InlineSegment` is a tree (`strong`, `em`, `anchor` and `link` carry `children`). `splitMarkdownBlocks` is gone; `renderInlineFragment(text)` lost its `bold` flag. New: `segmentsToHtml`.
- `validateChapter` / `validateBundle` reject leaked generator markup (`</markdown>`, `</invoke>`, …) in every profile.
- `sanitizeHtml` keeps all MathML that KaTeX emits (`mtext`, `msubsup`, `mathvariant`, …), so screen readers get the right formula.
- `validateExercises` warns about a missing `:::hint` only in `esercizi.md`. Exams are practised without hints.
- `CONTENT_FORMAT_VERSION` is `1.2`. A 0.2.x reader shows a "newer format" notice for books that declare `specVersion: "1.2"`.

## License

MIT. The reader, ptsb-pack and the content-format spec stay AGPL-3.0. content-core is MIT so that apps under other licenses, such as PoliTost Pyxis, can read smartbooks with the same code the reader uses.
