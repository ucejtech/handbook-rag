import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";

import { SetupError, toUserMessage } from "./errors";

function openAiError(statusCode: number) {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://api.openai.com/v1/embeddings",
    requestBodyValues: {},
    statusCode,
  });
}

describe("toUserMessage", () => {
  it("passes setup messages through unchanged", () => {
    expect(toUserMessage(new SetupError("Run `npm run ingest` first."))).toBe("Run `npm run ingest` first.");
  });

  it("explains a rejected API key, an unknown model and a rate limit", () => {
    expect(toUserMessage(openAiError(401))).toMatch(/OPENAI_API_KEY/);
    expect(toUserMessage(openAiError(404))).toMatch(/ANSWER_MODEL/);
    expect(toUserMessage(openAiError(429))).toMatch(/rate limit/);
  });

  it("looks inside the AI SDK's retry wrapper", () => {
    const retried = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [openAiError(429), openAiError(429)],
    });
    expect(toUserMessage(retried)).toMatch(/rate limit/);
  });

  it("reports timeouts", () => {
    expect(toUserMessage(new DOMException("timed out", "TimeoutError"))).toMatch(/took too long/);
  });

  it("hides the details of unexpected errors", () => {
    expect(toUserMessage(new Error("relation does not exist"))).toBe(
      "Something went wrong while answering. Try again.",
    );
  });
});
