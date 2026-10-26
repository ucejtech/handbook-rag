import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import type { HandbookMessage } from "../../../lib/answer/messages";
import { streamOneShotAnswer } from "../../../lib/answer/oneshot";
import { requireEnv } from "../../../lib/env";
import { reportError, SetupError } from "../../../lib/errors";
import { ensureIndexReady } from "../../../lib/index/load";
import { validateQuestion } from "../../../lib/question";

// POST /api/ask { question }. Error responses are plain text, which the chat shows as is.
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const question =
    typeof body === "object" && body !== null && "question" in body && typeof body.question === "string"
      ? body.question.trim()
      : "";

  const problem = validateQuestion(question);
  if (problem) return new Response(problem, { status: 400 });

  // Check setup before streaming, so problems come back as a clear 503 rather
  // than a broken stream.
  try {
    requireEnv("OPENAI_API_KEY");
    requireEnv("ANSWER_MODEL");
    await ensureIndexReady();
  } catch (error) {
    if (error instanceof SetupError) return new Response(error.message, { status: 503 });
    throw error;
  }

  const stream = createUIMessageStream<HandbookMessage>({
    async execute({ writer }) {
      writer.write({ type: "start" });
      await streamOneShotAnswer(question, writer);
    },
    onError: reportError,
  });

  return createUIMessageStreamResponse({ stream });
}
