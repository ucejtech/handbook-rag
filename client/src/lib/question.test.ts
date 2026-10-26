import { describe, expect, it } from "vitest";

import { MAX_QUESTION_LENGTH, validateQuestion } from "./question";

describe("validateQuestion", () => {
  it("accepts a normal question", () => {
    expect(validateQuestion("How much parental leave do I get?")).toBeNull();
  });

  it("rejects empty and whitespace-only questions", () => {
    expect(validateQuestion("")).toMatch(/type a question/);
    expect(validateQuestion("   \n ")).toMatch(/type a question/);
  });

  it("allows exactly the limit and rejects one character more", () => {
    expect(validateQuestion("a".repeat(MAX_QUESTION_LENGTH))).toBeNull();
    expect(validateQuestion("a".repeat(MAX_QUESTION_LENGTH + 1))).toMatch(/under 1,000 characters/);
  });
});
