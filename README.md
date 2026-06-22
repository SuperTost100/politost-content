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
- Types in `types/smartbook.ts`
