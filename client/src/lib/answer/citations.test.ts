import { describe, expect, it } from "vitest";

import { checkCitations, splitCitations } from "./citations";

describe("splitCitations", () => {
  it("splits an answer into text and citation markers", () => {
    expect(splitCitations("Leave is 24 weeks [S1]. See also [S2][S4]")).toEqual([
      { type: "text", text: "Leave is 24 weeks " },
      { type: "citation", ids: ["S1"] },
      { type: "text", text: ". See also " },
      { type: "citation", ids: ["S2"] },
      { type: "citation", ids: ["S4"] },
    ]);
  });

  it("reads comma-separated ids in one marker", () => {
    expect(splitCitations("[S1, S3]")).toEqual([{ type: "citation", ids: ["S1", "S3"] }]);
  });

  it("leaves other square brackets alone", () => {
    expect(splitCitations("Hey [name], thanks")).toEqual([{ type: "text", text: "Hey [name], thanks" }]);
  });
});

describe("checkCitations", () => {
  it("lists cited sources once each, in the order first cited", () => {
    expect(checkCitations("A [S2]. B [S1][S2].", ["S1", "S2", "S3"])).toEqual({
      cited: ["S2", "S1"],
      unknown: [],
    });
  });

  it("reports markers that point to no source", () => {
    expect(checkCitations("A [S1]. B [S9].", ["S1", "S2"])).toEqual({ cited: ["S1"], unknown: ["S9"] });
  });

  it("finds no citations in a decline", () => {
    expect(checkCitations("I couldn't find this in the handbook.", ["S1"])).toEqual({ cited: [], unknown: [] });
  });
});
