import { getPool } from "../db";
import { SetupError } from "../errors";

// Names created by ingest/db.py.
const CHUNKS_TABLE = "document_chunks";
const BM25_INDEX = "document_chunks_search_idx";

const REBUILD_HINT = "Run `npm run ingest` first.";

export interface IndexFacts {
  tableExists: boolean;
  bm25IndexExists: boolean;
  chunkCount: number;
  dimensions: number | null;
}

export interface IndexInfo {
  chunkCount: number;
  dimensions: number;
}

export function findIndexProblem(facts: IndexFacts): string | null {
  if (!facts.tableExists) {
    return `The search index hasn't been built yet. ${REBUILD_HINT}`;
  }
  if (facts.chunkCount === 0 || facts.dimensions === null) {
    return `The search index is empty. ${REBUILD_HINT}`;
  }
  if (!facts.bm25IndexExists) {
    return `The keyword (BM25) index is missing. ${REBUILD_HINT}`;
  }
  return null;
}

// Nothing records which model built the index, so vector length is the check
// we can make: a different model family returns a different length.
export function assertEmbeddingMatchesIndex(
  model: string,
  embeddingLength: number,
  indexDimensions: number,
): void {
  if (embeddingLength !== indexDimensions) {
    throw new SetupError(
      `EMBEDDING_MODEL "${model}" returns ${embeddingLength}-dimension vectors, ` +
        `but the index was built with ${indexDimensions}. Set EMBEDDING_MODEL to the ` +
        `model used for ingestion, or re-run \`npm run ingest\`.`,
    );
  }
}

async function readIndexFacts(): Promise<IndexFacts> {
  const pool = getPool();

  const { rows: [objects] } = await pool.query<{
    table_exists: boolean;
    bm25_index_exists: boolean;
  }>(
    `SELECT to_regclass($1) IS NOT NULL AS table_exists,
            to_regclass($2) IS NOT NULL AS bm25_index_exists`,
    [CHUNKS_TABLE, BM25_INDEX],
  );

  if (!objects.table_exists) {
    return { tableExists: false, bm25IndexExists: false, chunkCount: 0, dimensions: null };
  }

  const { rows: [stats] } = await pool.query<{
    chunk_count: number;
    dimensions: number | null;
  }>(
    `SELECT count(*)::int AS chunk_count,
            (SELECT vector_dims(embedding) FROM ${CHUNKS_TABLE} LIMIT 1) AS dimensions
     FROM ${CHUNKS_TABLE}`,
  );

  return {
    tableExists: true,
    bm25IndexExists: objects.bm25_index_exists,
    chunkCount: stats.chunk_count,
    dimensions: stats.dimensions,
  };
}

// A refused localhost connection arrives as an AggregateError (IPv4 + IPv6
// attempts) with an empty message, so fall back to its code (ECONNREFUSED).
function connectionFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.message || (error as NodeJS.ErrnoException).code || error.name;
}

async function checkIndex(): Promise<IndexInfo> {
  let facts: IndexFacts;
  try {
    facts = await readIndexFacts();
  } catch (error) {
    if (error instanceof SetupError) throw error;
    const reason = connectionFailureReason(error);
    throw new SetupError(
      `Can't reach the database (${reason}). Start it with \`docker compose up -d\` ` +
        `and check DATABASE_URL in .env.`,
    );
  }

  const problem = findIndexProblem(facts);
  if (problem) throw new SetupError(problem);

  return { chunkCount: facts.chunkCount, dimensions: facts.dimensions! };
}

let ready: Promise<IndexInfo> | null = null;

// A failed check isn't cached, so fixing the problem (e.g. starting the
// database) works without restarting the app.
export function ensureIndexReady(): Promise<IndexInfo> {
  ready ??= checkIndex().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}
