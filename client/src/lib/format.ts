// "p. 12" or "pp. 12–14"; expects the pages sorted.
export function formatPages(pages: number[]): string {
  if (pages.length === 0) return "page unknown";
  const first = pages[0];
  const last = pages[pages.length - 1];
  return first === last ? `p. ${first}` : `pp. ${first}–${last}`;
}

export function formatSectionPath(path: string[]): string {
  return path.length > 0 ? path.join(" › ") : "Untitled section";
}
