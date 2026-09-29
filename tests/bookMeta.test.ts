import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_FORMAT_VERSION, compareSpecVersions, validateBookMeta } from '../src/bookMeta.ts';
import { validateBundle } from '../src/validateChapter.ts';

describe('validateBookMeta', () => {
  it('accepts a book with no metadata, as in spec 1.0', () => {
    assert.deepEqual(validateBookMeta({}), { errors: [], warnings: [] });
  });

  it('accepts complete metadata', () => {
    const r = validateBookMeta({ authors: ['Ada Rossi', 'Luca Bianchi'], version: '1.2.0', specVersion: '1.1' });
    assert.deepEqual(r, { errors: [], warnings: [] });
  });

  it('rejects wrong types', () => {
    assert.equal(validateBookMeta({ authors: 'Ada Rossi' }).errors.length, 1);
    assert.equal(validateBookMeta({ authors: [] }).errors.length, 1);
    assert.equal(validateBookMeta({ authors: ['Ada', ' '] }).errors.length, 1);
    assert.equal(validateBookMeta({ version: 3 }).errors.length, 1);
    assert.equal(validateBookMeta({ specVersion: '1' }).errors.length, 1);
    assert.equal(validateBookMeta({ specVersion: 1.1 }).errors.length, 1);
  });

  it('warns on a non-semver version', () => {
    const r = validateBookMeta({ version: 'seconda edizione' });
    assert.equal(r.errors.length, 0);
    assert.ok(r.warnings[0].includes('semver'));
  });

  it('warns, without failing, on a newer spec', () => {
    const r = validateBookMeta({ specVersion: '2.0' });
    assert.equal(r.errors.length, 0);
    assert.ok(r.warnings[0].includes(CONTENT_FORMAT_VERSION));
    assert.equal(validateBookMeta({ specVersion: '1.0' }).warnings.length, 0);
  });
});

describe('compareSpecVersions', () => {
  it('compares numerically', () => {
    assert.ok(compareSpecVersions('1.10', '1.9') > 0);
    assert.ok(compareSpecVersions('1.1', '2.0') < 0);
    assert.equal(compareSpecVersions('1.1', '1.1'), 0);
  });
});

describe('validateBundle metadata', () => {
  it('reports metadata errors with the bundle', () => {
    const config = { id: 'demo-book', chapters: [{ file: 'ch01.md', number: 1 }], authors: 'Ada' };
    const r = validateBundle(config, { 'ch01.md': '## p1 | X\n\nTesto.\n' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('authors')));
  });
});
