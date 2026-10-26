import { ensureIndexReady } from "../index/load";
import { hybridSearch } from "./hybrid";
import { keywordSearch } from "./keyword";
import type { SearchMode, SearchResult } from "./types";
import { vectorSearch } from "./vector";

export const RESULT_LIMIT = 8;

// Provisional: the retrieval eval (Milestone 3) picks the real default.
export const DEFAULT_SEARCH_MODE: SearchMode = "hybrid";

export async function search(
  query: string,
  mode: SearchMode = DEFAULT_SEARCH_MODE,
  limit: number = RESULT_LIMIT,
): Promise<SearchResult[]> {
  const question = query.trim();
  if (!question) throw new Error("The search query is empty.");

  await ensureIndexReady();

  switch (mode) {
    case "keyword":
      return keywordSearch(question, limit);
    case "vector":
      return vectorSearch(question, limit);
    case "hybrid":
      return hybridSearch(question, limit);
  }
}
