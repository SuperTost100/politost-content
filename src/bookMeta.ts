/** Content-format version this package reads and writes. Bump together with the spec's VERSION file. */
export const CONTENT_FORMAT_VERSION = '1.1';

const SPEC_RE = /^(\d+)\.(\d+)$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface BookMeta {
  authors?: unknown;
  version?: unknown;
  specVersion?: unknown;
}

/**
 * Check the optional metadata fields of smartbook.json. Wrong types are errors.
 * A newer spec version is a warning, so readers can still try to open the book.
 */
export function validateBookMeta(config: BookMeta): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.authors !== undefined) {
    if (!Array.isArray(config.authors) || config.authors.length === 0) {
      errors.push('smartbook.json: authors deve essere una lista non vuota di nomi');
    } else if (config.authors.some((a) => typeof a !== 'string' || !a.trim())) {
      errors.push('smartbook.json: ogni voce di authors deve essere un nome non vuoto');
    }
  }

  if (config.version !== undefined) {
    if (typeof config.version !== 'string' || !config.version.trim()) {
      errors.push('smartbook.json: version deve essere una stringa non vuota');
    } else if (!SEMVER_RE.test(config.version)) {
      warnings.push(`smartbook.json: version "${config.version}" non segue semver (es. 1.2.0)`);
    }
  }

  if (config.specVersion !== undefined) {
    const m = typeof config.specVersion === 'string' ? SPEC_RE.exec(config.specVersion) : null;
    if (!m) {
      errors.push('smartbook.json: specVersion deve avere la forma MAJOR.MINOR, es. "1.1"');
    } else if (compareSpecVersions(config.specVersion as string, CONTENT_FORMAT_VERSION) > 0) {
      warnings.push(
        `smartbook.json: scritto per il formato ${config.specVersion}, questo lettore conosce il ${CONTENT_FORMAT_VERSION}. ` +
          'Alcune parti potrebbero non essere mostrate.',
      );
    }
  }

  return { errors, warnings };
}

/** Compare two "MAJOR.MINOR" versions. Returns a negative, zero or positive number. */
export function compareSpecVersions(a: string, b: string): number {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}
