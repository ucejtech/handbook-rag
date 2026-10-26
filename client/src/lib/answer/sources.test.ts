import { describe, expect, it } from "vitest";

import type { SearchResult } from "../search/types";
import { createSourceRegistry } from "./sources";

// Shaped like real search results; the text is chunk 32 of the handbook.
function result(chunkId: number, sectionPath: string[] = ["Press enquiries"]): SearchResult {
  return {
    chunkId,
    sectionPath,
    pages: [chunkId],
    text: "## **Press enquiries**\n\nAny press-related enquiries should be directed to [press@posthog.com](mailto:press@posthog.com).",
    score: 0.5,
  };
}

describe("createSourceRegistry", () => {
  it("numbers sources S1, S2, … in the order they are added", () => {
    const registry = createSourceRegistry();
    registry.add(result(32));
    registry.add(result(7));

    expect(registry.list().map((source) => [source.id, source.chunkId])).toEqual([
      ["S1", 32],
      ["S2", 7],
    ]);
  });

  it("keeps the first id when the same chunk is added again", () => {
    const registry = createSourceRegistry();
    registry.add(result(32));
    registry.add(result(7));

    expect(registry.add(result(32)).id).toBe("S1");
    expect(registry.list()).toHaveLength(2);
  });

  it("stores plain text, plain section names and the passage's links", () => {
    const registry = createSourceRegistry();
    const source = registry.add(result(32, ["Draft [budget](https://docs.google.com/spreadsheets/d/x)"]));

    expect(source.text).toBe(
      "Press enquiries\n\nAny press-related enquiries should be directed to press@posthog.com.",
    );
    expect(source.sectionPath).toEqual(["Draft budget"]);
    expect(source.links).toEqual([{ type: "email", target: "press@posthog.com", text: "press@posthog.com" }]);
  });
});
