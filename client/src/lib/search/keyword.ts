import { getPool } from "../db";
import { CHUNK_COLUMNS, toSearchResult, type ChunkRow, type SearchResult } from "./types";

// BM25 runs in ParadeDB (index built in ingest/db.py). `|||` matches any word
// of the query, tokenized and stemmed like the index, so the raw question
// needs no escaping.
export async function keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
  const { rows } = await getPool().query<ChunkRow>(
    `SELECT ${CHUNK_COLUMNS}, pdb.score(id) AS score
     FROM document_chunks
     WHERE content ||| $1::text
     ORDER BY pdb.score(id) DESC, id
     LIMIT $2`,
    [query, limit],
  );
  return rows.map(toSearchResult);
}
