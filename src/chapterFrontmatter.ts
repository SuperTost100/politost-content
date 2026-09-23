const FRONTMATTER = /^---\s*\nchapter:\s*(\d+)\s*\ntitle:\s*(.+?)\s*\n---\s*\n?/;

export function parseChapterFrontmatter(raw: string): {
  chapterNumber: number;
  title: string;
  body: string;
} {
  const m = raw.match(FRONTMATTER);
  if (!m) {
    throw new Error('Frontmatter mancante — atteso blocco --- con chapter e title');
  }
  return {
    chapterNumber: Number(m[1]),
    title: m[2].trim(),
    body: raw.slice(m[0].length),
  };
}

export function withChapterFrontmatter(
  body: string,
  chapterNumber: number,
  title: string,
): string {
  return `---\nchapter: ${chapterNumber}\ntitle: ${title}\n---\n\n${body.replace(/^\n+/, '')}`;
}
