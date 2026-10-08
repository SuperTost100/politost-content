import { unzipSync } from 'fflate';
import { isValidAssetPath } from './assetResolver';
import { validateBundle } from './validateChapter';
import type { GraficoConfig, IdeSnippet, SmartbookConfig } from './types/smartbook';

/** Limits applied before and after unzipping, so a hostile archive cannot exhaust memory. */
export interface ZipLimits {
  maxCompressedBytes: number;
  maxFiles: number;
  maxTotalUncompressed: number;
  maxFileBytes: number;
}

export const PTSB_ZIP_LIMITS: ZipLimits = {
  maxCompressedBytes: 50 * 1024 * 1024,
  maxFiles: 200,
  maxTotalUncompressed: 100 * 1024 * 1024,
  maxFileBytes: 5 * 1024 * 1024,
};

/** `ptsb.json` at the root of every package written by ptsb-pack. */
export interface PtsbManifest {
  formatVersion: number;
  packageType: string;
  encrypted: boolean;
  access: 'public' | 'licensed';
  createdAt: string;
  producer?: string;
}

/** A plain `.ptsb` after parsing and validation. Apps add their own fields, such as an import date. */
export interface PtsbBundle {
  manifest: PtsbManifest | null;
  /** Non-fatal validation notices that callers should display to the reader. */
  warnings: string[];
  config: SmartbookConfig;
  chapterFiles: Record<string, string>;
  eserciziRaw: string;
  esamiRaw: string;
  ide: IdeSnippet[];
  grafici: GraficoConfig[];
  assets: Record<string, Uint8Array>;
}

/** `zip` for a plain package, `encrypted` for the `PTSB` container, which needs the Politost platform. */
export type PtsbKind = 'zip' | 'encrypted' | 'unknown';

export function ptsbKind(bytes: Uint8Array): PtsbKind {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'PTSB') return 'encrypted';
  return 'unknown';
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const ID_RE = /^[a-z0-9-]+$/;

function readU32(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function readU16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/** Scan the ZIP central directory without decompressing, to enforce the limits up front. */
function scanZipLimits(data: Uint8Array, limits: ZipLimits): void {
  if (data.length < 22) {
    throw new Error('Archivio ZIP non valido');
  }

  let eocdOffset = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (readU32(data, i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Archivio ZIP non valido: fine directory mancante');
  }

  const totalEntries = readU16(data, eocdOffset + 10);
  // fflate reads the per-disk count and follows ZIP64 locators. Reject layouts
  // this preflight does not scan, so extraction cannot bypass these limits.
  if (
    readU16(data, eocdOffset + 4) !== 0 ||
    readU16(data, eocdOffset + 6) !== 0 ||
    readU16(data, eocdOffset + 8) !== totalEntries ||
    totalEntries === 0xffff ||
    (eocdOffset >= 20 && readU32(data, eocdOffset - 20) === 0x07064b50)
  ) {
    throw new Error('Archivio ZIP non supportato: directory multidisco o ZIP64');
  }
  if (totalEntries > limits.maxFiles) {
    throw new Error(`Troppi file nell'archivio (max ${limits.maxFiles})`);
  }

  let offset = readU32(data, eocdOffset + 16);
  const directoryEnd = offset + readU32(data, eocdOffset + 12);
  if (directoryEnd !== eocdOffset) {
    throw new Error('Archivio ZIP corrotto: dimensione directory centrale non valida');
  }
  let totalUncompressed = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > directoryEnd) {
      throw new Error('Archivio ZIP corrotto');
    }
    if (readU32(data, offset) !== CD_SIG) {
      throw new Error('Archivio ZIP corrotto: directory centrale non valida');
    }

    const compression = readU16(data, offset + 10);
    const compressedSize = readU32(data, offset + 20);
    const uncompressedSize = readU32(data, offset + 24);
    const nameLen = readU16(data, offset + 28);
    const extraLen = readU16(data, offset + 30);
    const commentLen = readU16(data, offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;

    if (nameEnd + extraLen + commentLen > directoryEnd) {
      throw new Error('Archivio ZIP corrotto');
    }

    const name = new TextDecoder().decode(data.slice(nameStart, nameEnd));
    if (name.includes('..') || name.startsWith('/') || name.includes('\\')) {
      throw new Error(`Percorso non consentito nell'archivio: ${name}`);
    }

    const size = compression === 0 ? compressedSize : uncompressedSize;
    if (size > limits.maxFileBytes) {
      throw new Error(`File troppo grande nell'archivio: ${name}`);
    }

    totalUncompressed += size;
    if (totalUncompressed > limits.maxTotalUncompressed) {
      throw new Error('Archivio troppo grande (limite decompressione superato)');
    }

    offset = nameEnd + extraLen + commentLen;
  }
  if (offset !== directoryEnd) {
    throw new Error('Archivio ZIP corrotto: numero di file non valido');
  }
}

/** Unzip with size, count and path checks. The sizes in the directory are checked again after extraction. */
export function safeUnzip(data: Uint8Array, limits: ZipLimits = PTSB_ZIP_LIMITS): Record<string, Uint8Array> {
  if (data.length > limits.maxCompressedBytes) {
    throw new Error(`File troppo grande (max ${limits.maxCompressedBytes / (1024 * 1024)} MB)`);
  }

  scanZipLimits(data, limits);

  const entries = unzipSync(data) as Record<string, Uint8Array>;

  let total = 0;
  for (const [path, content] of Object.entries(entries)) {
    if (content.length > limits.maxFileBytes) {
      throw new Error(`File troppo grande dopo estrazione: ${path}`);
    }
    total += content.length;
  }
  if (total > limits.maxTotalUncompressed) {
    throw new Error('Archivio troppo grande (limite decompressione superato)');
  }

  return entries;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function parseJson<T>(bytes: Uint8Array, name: string): T {
  try {
    return JSON.parse(decodeText(bytes)) as T;
  } catch (e) {
    throw new Error(`${name}: JSON non valido — ${(e as Error).message}`, { cause: e });
  }
}

/**
 * Parse and validate the entries of a plain package: the unzipped `.ptsb`, or the decrypted
 * payload of an encrypted one. Throws with the validator's error list when the bundle is invalid.
 */
export function parsePtsbEntries(entries: Record<string, Uint8Array>): PtsbBundle {
  if (!entries['smartbook.json']) {
    throw new Error('smartbook.json mancante nel pacchetto');
  }
  const config = parseJson<SmartbookConfig>(entries['smartbook.json'], 'smartbook.json');
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('smartbook.json: atteso un oggetto JSON');
  }
  if (typeof config.id !== 'string' || !ID_RE.test(config.id)) {
    throw new Error(`ID smartbook non valido: ${config.id}`);
  }

  const chapterFiles: Record<string, string> = {};
  const assets: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith('chapters/') && path.endsWith('.md')) {
      chapterFiles[path.slice('chapters/'.length)] = decodeText(data);
    } else if (path.startsWith('assets/') && !path.endsWith('/') && isValidAssetPath(path)) {
      assets[path] = data;
    }
  }

  const text = (name: string) => (entries[name] ? decodeText(entries[name]) : '');
  const eserciziRaw = text('esercizi.md');
  const esamiRaw = text('esami.md');
  const ideRaw = text('ide.json');
  const graficiRaw = text('grafici.json');

  const validation = validateBundle(config, chapterFiles, assets, { eserciziRaw, esamiRaw, ideRaw, graficiRaw });
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  return {
    manifest: entries['ptsb.json'] ? parseJson<PtsbManifest>(entries['ptsb.json'], 'ptsb.json') : null,
    warnings: validation.warnings,
    config: { ...config, access: config.access ?? 'public' },
    chapterFiles,
    eserciziRaw,
    esamiRaw,
    ide: ideRaw ? (JSON.parse(ideRaw) as IdeSnippet[]) : [],
    grafici: graficiRaw ? (JSON.parse(graficiRaw) as GraficoConfig[]) : [],
    assets,
  };
}

/** Read a plain `.ptsb`. Encrypted packages throw: opening them needs the Politost platform. */
export function readPtsb(bytes: Uint8Array, limits: ZipLimits = PTSB_ZIP_LIMITS): PtsbBundle {
  const kind = ptsbKind(bytes);
  if (kind === 'encrypted') {
    throw new Error('Libro protetto: richiede la piattaforma Politost.');
  }
  if (kind === 'unknown') {
    throw new Error('Formato file non riconosciuto. Usa un file .ptsb valido.');
  }
  return parsePtsbEntries(safeUnzip(bytes, limits));
}

/** `ptsb.json` of a plain package, or null when it is missing, unreadable or over the limits. */
export function readPtsbManifest(bytes: Uint8Array, limits: ZipLimits = PTSB_ZIP_LIMITS): PtsbManifest | null {
  try {
    if (ptsbKind(bytes) !== 'zip') return null;
    const entries = safeUnzip(bytes, limits);
    return entries['ptsb.json'] ? parseJson<PtsbManifest>(entries['ptsb.json'], 'ptsb.json') : null;
  } catch {
    return null;
  }
}
