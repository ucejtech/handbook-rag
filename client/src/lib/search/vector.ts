import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

import { getPool } from "../db";
import { requireEnv } from "../env";
import { assertEmbeddingMatchesIndex, ensureIndexReady } from "../index/load";
import { CHUNK_COLUMNS, toSearchResult, type ChunkRow, type SearchResult } from "./types";

const EMBED_TIMEOUT_MS = 15_000;

export async function embedQuery(query: string): Promise<number[]> {
  const model = requireEnv("EMBEDDING_MODEL");
  requireEnv("OPENAI_API_KEY");

  const { embedding } = await embed({
    model: openai.embedding(model),
    value: query,
    abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });

  const { dimensions } = await ensureIndexReady();
  assertEmbeddingMatchesIndex(model, embedding.length, dimensions);
  return embedding;
}

// Exact scan, no approximate index: over ~3,000 chunks it takes milliseconds
// and never misses a match.
export async function vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
  const embedding = await embedQuery(query);

  const { rows } = await getPool().query<ChunkRow>(
    `SELECT ${CHUNK_COLUMNS}, 1 - (embedding <=> $1::vector) AS score
     FROM document_chunks
     ORDER BY embedding <=> $1::vector, id
     LIMIT $2`,
    [`[${embedding.join(",")}]`, limit],
  );
  return rows.map(toSearchResult);
}
