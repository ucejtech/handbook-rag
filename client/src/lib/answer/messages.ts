import type { UIMessage } from "ai";

import type { CitationCheck } from "./citations";
import type { Source } from "./sources";

/**
 * Shared by POST /api/ask and the chat. Besides the answer text, a reply has:
 * - `data-status`: progress text (transient)
 * - `data-sources`: the passages the answer may cite (S1, S2, …)
 * - `data-citations`: which sources the finished answer cited
 */
export type HandbookMessage = UIMessage<
  never,
  {
    status: string;
    sources: Source[];
    citations: CitationCheck;
  }
>;
