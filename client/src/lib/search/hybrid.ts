import { keywordSearch } from "./keyword";
import type { SearchResult } from "./types";
import { vectorSearch } from "./vector";

export const CANDIDATES_PER_SEARCH = 20;

export const RRF_K = 60;

// Reciprocal rank fusion: each list adds 1 / (k + rank) per chunk. It uses
// ranks, not scores, because BM25 and cosine scores aren't on the same scale.
export function fuseRankings(
  rankings: SearchResult[][],
  limit: number,
  k: number = RRF_K,
): SearchResult[] {
  const fused = new Map<number, SearchResult>();

  for (const ranking of rankings) {
    ranking.forEach((result, index) => {
      const share = 1 / (k + index + 1);
      const seen = fused.get(result.chunkId);
      if (seen) {
        seen.score += share;
      } else {
        fused.set(result.chunkId, { ...result, score: share });
      }
    });
  }

  return [...fused.values()]
    // Ties go to the lower chunk id so results are the same on every run.
    .sort((a, b) => b.score - a.score || a.chunkId - b.chunkId)
    .slice(0, limit);
}

export async function hybridSearch(query: string, limit: number): Promise<SearchResult[]> {
  const [keyword, vector] = await Promise.all([
    keywordSearch(query, CANDIDATES_PER_SEARCH),
    vectorSearch(query, CANDIDATES_PER_SEARCH),
  ]);
  return fuseRankings([keyword, vector], limit);
}
