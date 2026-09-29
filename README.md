# @politost/content-core

Parser, renderer, and validator for [Politost Smartbook](https://github.com/SuperTost100/politost-smartbook) markdown.

Spec: [politost-content-format](https://github.com/SuperTost100/politost-content-format)

## Install

```bash
npm install github:SuperTost100/politost-content-core
```

Monorepo dev: `file:../packages/content-core`

## Test

```bash
npm ci && npm test
```

## Exports

- `parseChapterMarkdown`, `parseExercises`, `validateChapter`, `validateBundle`
- `renderContent`, `formulaRender`, `assetResolver`
- `.ptsb` plain packages: `ptsbKind`, `safeUnzip`, `readPtsb`, `parsePtsbEntries`, `readPtsbManifest`. Encrypted packages are detected and refused. Decryption stays in the reader, since it needs the Politost platform
- Types in `types/smartbook.ts`

`readPtsb` and `parsePtsbEntries` return non-fatal validation notices in `bundle.warnings`. Display them to readers, especially when a book declares a newer content-format version. Invalid bundles still throw.

## License

MIT. The reader, ptsb-pack and the content-format spec stay AGPL-3.0. content-core is MIT so that apps under other licenses, such as PoliTost Pyxis, can read smartbooks with the same code the reader uses.
