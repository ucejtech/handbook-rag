import { describe, expect, it } from "vitest";

import { fuseRankings, RRF_K } from "./hybrid";
import type { SearchResult } from "./types";

// Chunks are made up for the test; only the ids matter to fusion.
function chunk(chunkId: number, score = 0): SearchResult {
  return { chunkId, sectionPath: [`Section ${chunkId}`], pages: [chunkId], text: `Chunk ${chunkId}`, score };
}

const ids = (results: SearchResult[]) => results.map((result) => result.chunkId);

describe("fuseRankings", () => {
  it("scores each chunk as the sum of 1 / (k + rank) over the lists it appears in", () => {
    const fused = fuseRankings([[chunk(1), chunk(2)], [chunk(2), chunk(3)]], 10);

    expect(ids(fused)).toEqual([2, 1, 3]);
    expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 2) + 1 / (RRF_K + 1));
    expect(fused[1].score).toBeCloseTo(1 / (RRF_K + 1));
    expect(fused[2].score).toBeCloseTo(1 / (RRF_K + 2));
  });

  it("ranks a chunk both searches found above one that topped only a single list", () => {
    const keyword = [chunk(1), chunk(2), chunk(3)];
    const vector = [chunk(4), chunk(5), chunk(3)];

    expect(fuseRankings([keyword, vector], 1)[0].chunkId).toBe(3);
  });

  it("ignores the input scores, since BM25 and cosine scores aren't comparable", () => {
    const fused = fuseRankings([[chunk(1, 0.1)], [chunk(2, 99)]], 10);

    expect(fused[0].score).toBeCloseTo(fused[1].score);
  });

  it("returns at most `limit` results", () => {
    const list = [1, 2, 3, 4, 5].map((id) => chunk(id));

    expect(fuseRankings([list, list], 3)).toHaveLength(3);
  });

  it("breaks ties by lower chunk id so results are stable", () => {
    expect(ids(fuseRankings([[chunk(9)], [chunk(4)]], 10))).toEqual([4, 9]);
  });

  it("still works when one search found nothing", () => {
    expect(ids(fuseRankings([[], [chunk(7), chunk(8)]], 10))).toEqual([7, 8]);
  });

  it("keeps the chunk's section, pages and text, and leaves the inputs unchanged", () => {
    const input = chunk(5, 0.42);
    const [fused] = fuseRankings([[input], [input]], 10);

    expect(fused).toMatchObject({ sectionPath: ["Section 5"], pages: [5], text: "Chunk 5" });
    expect(input.score).toBe(0.42);
  });
});
