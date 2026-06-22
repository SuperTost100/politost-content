export const ALLOWED_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
export const MAX_BOOK_ASSETS_BYTES = 20 * 1024 * 1024;
export const ASSET_PATH_RE = /^assets\/[a-zA-Z0-9._/-]+$/;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export function isValidAssetPath(src: string): boolean {
  if (!ASSET_PATH_RE.test(src)) return false;
  if (src.includes('..')) return false;
  const ext = src.slice(src.lastIndexOf('.')).toLowerCase();
  return ALLOWED_IMAGE_EXT.has(ext);
}

export function mimeForAssetPath(src: string): string {
  const ext = src.slice(src.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export function buildAssetUrlMap(bytes: Record<string, Uint8Array>): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const [path, data] of Object.entries(bytes)) {
    if (!isValidAssetPath(path)) continue;
    const blob = new Blob([new Uint8Array(data)], { type: mimeForAssetPath(path) });
    urls[path] = URL.createObjectURL(blob);
  }
  return urls;
}

export function revokeAssetUrls(urls: Record<string, string>): void {
  for (const url of Object.values(urls)) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
}

export function validateAssetSizes(bytes: Record<string, Uint8Array>): string[] {
  const errors: string[] = [];
  let total = 0;
  for (const [path, data] of Object.entries(bytes)) {
    if (!path.startsWith('assets/')) continue;
    total += data.byteLength;
    if (data.byteLength > MAX_ASSET_BYTES) {
      errors.push(`${path}: immagine troppo grande (${data.byteLength} byte, max ${MAX_ASSET_BYTES})`);
    }
  }
  if (total > MAX_BOOK_ASSETS_BYTES) {
    errors.push(`Totale assets troppo grande (${total} byte, max ${MAX_BOOK_ASSETS_BYTES})`);
  }
  return errors;
}
