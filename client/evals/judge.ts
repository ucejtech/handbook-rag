import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { Source } from "../src/lib/answer/sources";
import { requireEnv } from "../src/lib/env";
import { formatPages, formatSectionPath } from "../src/lib/format";

const verdictSchema = z.object({
  verdict: z.enum(["supported", "partial", "unsupported"]),
  reason: z.string().describe("One short sentence explaining the verdict."),
});

export type Verdict = z.infer<typeof verdictSchema>;

const JUDGE_INSTRUCTIONS = `You check whether an answer is faithful to the handbook sources it was given.
- "supported": every factual claim in the answer is backed by the sources.
- "partial": the main claims are backed, but at least one claim isn't.
- "unsupported": the main claims aren't backed by the sources, or contradict them.
An answer that says the handbook doesn't cover the question, and makes no other claims, is "supported".
Judge only against the sources, not your own knowledge.`;

/**
 * LLM judge for faithfulness. Uses JUDGE_MODEL if set, otherwise ANSWER_MODEL;
 * a different model from the one that answered makes a fairer judge.
 */
export async function judgeFaithfulness(question: string, answer: string, sources: Source[]): Promise<Verdict> {
  const model = process.env.JUDGE_MODEL?.trim() || requireEnv("ANSWER_MODEL");
  // Include each passage's links: the answering model sees them, so an answer
  // that passes one on is supported.
  const sourceText = sources
    .map((source) => {
      const links = source.links.map((link) => `- ${link.text}: ${link.target}`).join("\n");
      const header = `[${source.id}] ${formatSectionPath(source.sectionPath)} (${formatPages(source.pages)})`;
      return [header, source.text, ...(links ? ["Links:", links] : [])].join("\n");
    })
    .join("\n\n");

  const { output } = await generateText({
    model: openai(model),
    instructions: JUDGE_INSTRUCTIONS,
    prompt: `Sources:\n\n${sourceText || "(none)"}\n\nQuestion: ${question}\n\nAnswer:\n${answer}`,
    output: Output.object({ schema: verdictSchema }),
  });
  return output;
}
