// Answer eval: runs every case through the app's answering code, applies the
// deterministic checks, then asks an LLM judge whether the answer is faithful.
//
//   npm run eval:answers

import type { UIMessageStreamWriter } from "ai";

import type { CitationCheck } from "../src/lib/answer/citations";
import type { HandbookMessage } from "../src/lib/answer/messages";
import { streamOneShotAnswer } from "../src/lib/answer/oneshot";
import { NOT_FOUND_PHRASE } from "../src/lib/answer/prompt";
import type { Source } from "../src/lib/answer/sources";
import { closePool } from "../src/lib/db";
import { judgeFaithfulness, type Verdict } from "./judge";
import {
  caseLabel,
  loadCases,
  pagesOverlap,
  percent,
  printTable,
  saveResults,
  warnAboutUnverified,
  type EvalCase,
} from "./shared";

// Only one-shot exists so far; agentic mode gets added here when it's built.
const MODES = ["oneshot"] as const;
type AnswerMode = (typeof MODES)[number];

interface AnswerRun {
  answer: string;
  sources: Source[];
  citations: CitationCheck;
  error: string | null;
  latencyMs: number;
}

/** Run the same code the chat uses, recording what it writes to the stream. */
async function runOneShot(question: string): Promise<AnswerRun> {
  const run: AnswerRun = { answer: "", sources: [], citations: { cited: [], unknown: [] }, error: null, latencyMs: 0 };
  const writer: UIMessageStreamWriter<HandbookMessage> = {
    write(chunk) {
      if (chunk.type === "text-delta") run.answer += chunk.delta;
      if (chunk.type === "data-sources") run.sources = chunk.data;
      if (chunk.type === "data-citations") run.citations = chunk.data;
      if (chunk.type === "error") run.error = chunk.errorText;
    },
    merge() {
      throw new Error("One-shot answering doesn't merge streams.");
    },
    onError: undefined,
  };

  const started = performance.now();
  try {
    await streamOneShotAnswer(question, writer);
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }
  run.latencyMs = Math.round(performance.now() - started);
  return run;
}

// Lowercase, collapse whitespace, straighten quotes and drop thousands
// separators, so "$1,000" matches "1000" and "It’s" matches "it's".
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/\s+/g, " ");
}

interface Checks {
  declineCorrect: boolean;
  citationsValid: boolean;
  /** null when the case has no expected pages or should be declined. */
  citationsAccurate: boolean | null;
  /** null when the case has no required phrases. */
  mustInclude: boolean | null;
  /** A non-decline answer with no citations. */
  uncited: boolean;
}

function check(evalCase: EvalCase, run: AnswerRun): Checks {
  const declined = run.answer.trimStart().startsWith(NOT_FOUND_PHRASE);
  const citedSources = run.sources.filter((source) => run.citations.cited.includes(source.id));
  return {
    declineCorrect: declined === evalCase.shouldDecline,
    citationsValid: run.citations.unknown.length === 0,
    citationsAccurate:
      evalCase.expectedPages.length > 0 && !evalCase.shouldDecline
        ? citedSources.some((source) => pagesOverlap(source.pages, evalCase.expectedPages))
        : null,
    mustInclude:
      evalCase.mustInclude.length > 0
        ? evalCase.mustInclude.every((phrase) => normalize(run.answer).includes(normalize(phrase)))
        : null,
    uncited: !declined && run.citations.cited.length === 0,
  };
}

interface CaseResult {
  id: string;
  category: string;
  verified: boolean;
  mode: AnswerMode;
  question: string;
  answer: string;
  cited: string[];
  error: string | null;
  latencyMs: number;
  checks: Checks | null;
  judge: Verdict | null;
}

const mark = (value: boolean | null) => (value === null ? "–" : value ? "✓" : "✗");

function passed(result: CaseResult): boolean {
  if (result.error || !result.checks) return false;
  const { declineCorrect, citationsValid, citationsAccurate, mustInclude, uncited } = result.checks;
  return (
    declineCorrect &&
    citationsValid &&
    citationsAccurate !== false &&
    mustInclude !== false &&
    !uncited &&
    result.judge?.verdict === "supported"
  );
}

function summarize(results: CaseResult[]) {
  const answered = results.filter((result) => result.checks);
  const rate = (pick: (checks: Checks) => boolean | null) => {
    const values = answered.map((result) => pick(result.checks!)).filter((value) => value !== null);
    return percent(values.filter(Boolean).length, values.length);
  };
  const judged = results.filter((result) => result.judge);
  return {
    cases: results.length,
    errors: results.filter((result) => result.error).length,
    decline: rate((checks) => checks.declineCorrect),
    "citations valid": rate((checks) => checks.citationsValid),
    "citations accurate": rate((checks) => checks.citationsAccurate),
    "must include": rate((checks) => checks.mustInclude),
    uncited: answered.filter((result) => result.checks!.uncited).length,
    faithful: percent(judged.filter((result) => result.judge!.verdict === "supported").length, judged.length),
    "avg latency": `${Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / Math.max(results.length, 1))} ms`,
  };
}

async function main(): Promise<void> {
  const cases = loadCases();
  console.log(`Answer eval: ${cases.length} cases, modes ${MODES.join(", ")}\n`);
  warnAboutUnverified(cases);

  const results: CaseResult[] = [];
  for (const mode of MODES) {
    for (const evalCase of cases) {
      console.log(`→ ${mode} · ${evalCase.id}`);
      const run = await runOneShot(evalCase.question);
      const checks = run.error ? null : check(evalCase, run);
      const judge = run.error ? null : await judgeFaithfulness(evalCase.question, run.answer, run.sources);
      if (run.error) console.log(`  error: ${run.error}`);
      results.push({
        id: evalCase.id,
        category: evalCase.category,
        verified: evalCase.verified,
        mode,
        question: evalCase.question,
        answer: run.answer,
        cited: run.citations.cited,
        error: run.error,
        latencyMs: run.latencyMs,
        checks,
        judge,
      });
    }
  }
  console.log();

  printTable(
    results.map((result) => ({
      case: caseLabel(cases.find((evalCase) => evalCase.id === result.id)!),
      category: result.category,
      decline: mark(result.checks?.declineCorrect ?? null),
      "cites valid": mark(result.checks?.citationsValid ?? null),
      "cites right pages": mark(result.checks?.citationsAccurate ?? null),
      "must include": mark(result.checks?.mustInclude ?? null),
      uncited: result.checks?.uncited ? "⚠" : "",
      judge: result.judge?.verdict ?? (result.error ? "error" : "–"),
    })),
  );

  const failures = results.filter((result) => !passed(result));
  for (const result of failures) {
    console.log(`✗ ${result.id}: ${result.error ?? result.judge?.reason ?? ""}`);
    console.log(`  ${result.answer.replace(/\s+/g, " ").slice(0, 240)}\n`);
  }

  const summary = Object.fromEntries(MODES.map((mode) => [mode, summarize(results.filter((result) => result.mode === mode))]));
  printTable(Object.entries(summary).map(([mode, values]) => ({ mode, ...values })));

  const categories = [...new Set(cases.map((evalCase) => evalCase.category))];
  printTable(
    categories.map((category) => {
      const inCategory = results.filter((result) => result.category === category);
      return {
        category,
        cases: inCategory.length,
        "all checks pass": percent(inCategory.filter(passed).length, inCategory.length),
      };
    }),
  );

  const file = saveResults("answers", { ranAt: new Date().toISOString(), model: process.env.ANSWER_MODEL, summary, results });
  console.log(`Saved ${file}`);
}

main()
  .catch((error: unknown) => {
    console.error(`Answer eval failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(closePool);
