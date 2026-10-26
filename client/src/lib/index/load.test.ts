import { describe, expect, it } from "vitest";

import { SetupError } from "../errors";
import { assertEmbeddingMatchesIndex, findIndexProblem, type IndexFacts } from "./load";

const healthy: IndexFacts = {
  tableExists: true,
  bm25IndexExists: true,
  chunkCount: 3067,
  dimensions: 1536,
};

describe("findIndexProblem", () => {
  it("accepts a built index", () => {
    expect(findIndexProblem(healthy)).toBeNull();
  });

  it("asks for ingestion when the chunks table doesn't exist", () => {
    const facts = { tableExists: false, bm25IndexExists: false, chunkCount: 0, dimensions: null };

    expect(findIndexProblem(facts)).toMatch(/hasn't been built.*npm run ingest/);
  });

  it("asks for ingestion when the table is empty", () => {
    const facts = { ...healthy, chunkCount: 0, dimensions: null };

    expect(findIndexProblem(facts)).toMatch(/empty.*npm run ingest/);
  });

  it("reports a missing BM25 index", () => {
    const facts = { ...healthy, bm25IndexExists: false };

    expect(findIndexProblem(facts)).toMatch(/BM25.*npm run ingest/);
  });
});

describe("assertEmbeddingMatchesIndex", () => {
  it("passes when the query vector has the index's length", () => {
    expect(() => assertEmbeddingMatchesIndex("text-embedding-3-small", 1536, 1536)).not.toThrow();
  });

  it("names the model and both lengths when they differ", () => {
    const check = () => assertEmbeddingMatchesIndex("text-embedding-3-large", 3072, 1536);

    expect(check).toThrow(SetupError);
    expect(check).toThrow(/text-embedding-3-large.*3072.*1536/);
  });
});
