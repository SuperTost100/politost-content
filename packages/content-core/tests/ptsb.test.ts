import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { ptsbKind, readPtsb, readPtsbManifest, safeUnzip, PTSB_ZIP_LIMITS } from '../src/ptsb.ts';

const CONFIG = {
  id: 'demo-book',
  title: 'Demo',
  subject: 'Fisica',
  sections: Object.fromEntries(
    ['smartbook', 'formulario', 'esercizi', 'esami', 'ide', 'grafici', 'risposte'].map((key) => [
      key,
      { enabled: true, label: key },
    ]),
  ),
  chapters: [{ id: 'uno', number: 1, title: 'Uno', file: '01-uno.md', printable: true }],
};

const MANIFEST = {
  formatVersion: 1,
  packageType: 'smartbook',
  encrypted: false,
  access: 'public',
  createdAt: '2026-09-29T00:00:00Z',
  producer: 'test',
};

function pack(files: Record<string, string | Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(files)) {
    entries[name] = typeof value === 'string' ? strToU8(value) : value;
  }
  return zipSync(entries);
}

const VALID_FILES = {
  'ptsb.json': JSON.stringify(MANIFEST),
  'smartbook.json': JSON.stringify(CONFIG),
  'chapters/01-uno.md': '## p1 | Primo\n\nTesto con $a$.\n',
};

describe('ptsbKind', () => {
  it('tells plain, encrypted and unknown files apart', () => {
    assert.equal(ptsbKind(pack(VALID_FILES)), 'zip');
    assert.equal(ptsbKind(strToU8('PTSB{"id":"x"}')), 'encrypted');
    assert.equal(ptsbKind(strToU8('hello')), 'unknown');
  });
});

describe('readPtsb', () => {
  it('reads a valid plain package', () => {
    const bundle = readPtsb(pack(VALID_FILES));
    assert.equal(bundle.config.id, 'demo-book');
    assert.equal(bundle.config.access, 'public');
    assert.equal(bundle.manifest?.formatVersion, 1);
    assert.ok(bundle.chapterFiles['01-uno.md'].includes('Primo'));
    assert.deepEqual(bundle.ide, []);
    assert.deepEqual(bundle.warnings, []);
  });

  it('opens a future-format book and returns its compatibility warning', () => {
    const files = {
      ...VALID_FILES,
      'smartbook.json': JSON.stringify({ ...CONFIG, specVersion: '2.0' }),
    };
    const bundle = readPtsb(pack(files));
    assert.equal(bundle.config.id, CONFIG.id);
    assert.ok(bundle.warnings.some((warning) => warning.includes('formato 2.0')));
  });

  it('refuses encrypted packages', () => {
    assert.throws(() => readPtsb(strToU8('PTSB{"id":"x"}')), /piattaforma/);
  });

  it('rejects a package without smartbook.json', () => {
    assert.throws(() => readPtsb(pack({ 'ptsb.json': JSON.stringify(MANIFEST) })), /smartbook.json mancante/);
  });

  it('reports validator errors', () => {
    const files = { ...VALID_FILES, 'chapters/01-uno.md': 'nessun paragrafo' };
    assert.throws(() => readPtsb(pack(files)), /paragrafo/);
  });
});

describe('readPtsb config shape', () => {
  it('rejects a smartbook.json that is not an object', () => {
    const bytes = zipSync({ 'smartbook.json': strToU8('null') });
    assert.throws(() => readPtsb(bytes), /atteso un oggetto JSON/);
  });
});

describe('safeUnzip', () => {
  it('rejects mismatched entry counts before extracting unchecked paths', () => {
    const bytes = pack({ '../evil.md': 'x' });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint16(bytes.length - 22 + 10, 0, true);
    assert.throws(() => safeUnzip(bytes, { ...PTSB_ZIP_LIMITS, maxFiles: 0 }), /multidisco/);
  });

  it('rejects a ZIP64 locator instead of following an unchecked directory', () => {
    const bytes = pack({ 'x.md': 'x' });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint32(bytes.length - 22 - 20, 0x07064b50, true);
    assert.throws(() => safeUnzip(bytes), /ZIP64/);
  });

  it('rejects central-directory entries omitted from both counts', () => {
    const bytes = pack({ 'safe.md': 'x', '../evil.md': 'x' });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint16(bytes.length - 22 + 8, 1, true);
    view.setUint16(bytes.length - 22 + 10, 1, true);
    assert.throws(() => safeUnzip(bytes), /numero di file/);
  });

  it('rejects path traversal', () => {
    assert.throws(() => safeUnzip(pack({ '../evil.md': 'x' })), /Percorso non consentito/);
  });

  it('applies custom limits', () => {
    const limits = { ...PTSB_ZIP_LIMITS, maxFileBytes: 10 };
    assert.throws(() => safeUnzip(pack({ 'a.txt': 'more than ten bytes' }), limits), /troppo grande/);
  });

  it('rejects too many entries', () => {
    const limits = { ...PTSB_ZIP_LIMITS, maxFiles: 1 };
    assert.throws(() => safeUnzip(pack({ 'a.txt': 'a', 'b.txt': 'b' }), limits), /Troppi file/);
  });
});

describe('readPtsbManifest', () => {
  it('returns the manifest, or null for non-zip input', () => {
    assert.equal(readPtsbManifest(pack(VALID_FILES))?.producer, 'test');
    assert.equal(readPtsbManifest(strToU8('PTSB')), null);
  });
});
