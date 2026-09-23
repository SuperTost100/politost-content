import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseChapterFrontmatter } from '../src/chapterFrontmatter';
import { parseChapterMarkdown } from '../src/parser';
import { serializeChapter } from '../src/serializeChapter';
import { validateChapter } from '../src/validateChapter';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/02-nel-libro.md');

test('serializeChapter round-trip passes validateChapter', () => {
  const raw = readFileSync(fixture, 'utf8');
  const { chapterNumber, title } = parseChapterFrontmatter(raw);
  const parsed = parseChapterMarkdown(raw, chapterNumber);
  const roundTripped = serializeChapter(parsed, title, chapterNumber);

  assert.equal(validateChapter(raw, chapterNumber).valid, true);
  assert.equal(validateChapter(roundTripped, chapterNumber).valid, true);
});

test('serializeChapter keeps } inside a quoted image alt', () => {
  const raw = `---
chapter: 1
title: T
---

## p1 | Test

:::image{src="assets/fig.png" alt="caption with } brace" caption="ok"}
:::
`;
  const parsed = parseChapterMarkdown(raw, 1);
  assert.match(parsed.paragraphs[0].content, /\} brace/);
  const out = serializeChapter(parsed, 'T', 1);
  assert.match(out, /alt="caption with \} brace"/);
});
