export const SEARCH_MODES = ["keyword", "vector", "hybrid"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export interface SearchResult {
  chunkId: number;
  sectionPath: string[];
  pages: number[];
  text: string;
  // BM25, cosine similarity or RRF score depending on the mode, so only
  // comparable within one mode.
  score: number;
}

export interface ChunkRow {
  id: string; // BIGSERIAL; node-postgres returns 64-bit ints as strings
  section_path: string[];
  page_numbers: number[];
  content: string;
  score: number;
}

export const CHUNK_COLUMNS = "id, section_path, page_numbers, content";

export function toSearchResult(row: ChunkRow): SearchResult {
  return {
    chunkId: Number(row.id),
    sectionPath: row.section_path,
    pages: row.page_numbers,
    text: row.content,
    score: Number(row.score),
  };
}
