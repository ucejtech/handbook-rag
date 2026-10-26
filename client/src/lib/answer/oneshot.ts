import { openai } from '@ai-sdk/openai';
import { streamText, type UIMessageStreamWriter } from 'ai';

import { requireEnv } from '../env';
import { reportError } from '../errors';
import { search } from '../search/search';
import { checkCitations } from './citations';
import type { HandbookMessage } from './messages';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt';
import { createSourceRegistry } from './sources';

const ANSWER_TIMEOUT_MS = 60_000;

// One-shot mode: search once, then answer from the top passages.
export async function streamOneShotAnswer(
  question: string,
  writer: UIMessageStreamWriter<HandbookMessage>
): Promise<void> {
  const model = requireEnv('ANSWER_MODEL');

  writer.write({
    type: 'data-status',
    data: 'Searching the handbook…',
    transient: true
  });
  const registry = createSourceRegistry();
  for (const result of await search(question)) registry.add(result);
  const sources = registry.list();
  writer.write({ type: 'data-sources', data: sources });

  writer.write({
    type: 'data-status',
    data: 'Writing the answer…',
    transient: true
  });
  const started = performance.now();
  const result = streamText({
    model: openai(model),
    instructions: SYSTEM_PROMPT,
    prompt: buildUserPrompt(question, sources),
    // Answering from given passages needs little reasoning; more only adds delay.
    reasoning: 'low',
    timeout: ANSWER_TIMEOUT_MS
  });

  // Forward chunks one by one rather than merging the stream, so the citation
  // check below is written after the whole answer.
  let answer = '';
  let failed = false;
  const chunks = result.toUIMessageStream<HandbookMessage>({
    sendStart: false,
    sendFinish: false,
    sendReasoning: false,
    onError: reportError
  });
  for await (const chunk of chunks) {
    if (chunk.type === 'text-delta') answer += chunk.delta;
    if (chunk.type === 'error') failed = true;
    writer.write(chunk);
  }
  if (failed) return;

  // Markers that point to no source are dropped by the chat and logged here.
  const citations = checkCitations(
    answer,
    sources.map((source) => source.id)
  );
  if (citations.unknown.length > 0) {
    console.warn(
      `[ask] answer cited unknown sources: ${citations.unknown.join(', ')}`
    );
  }
  writer.write({ type: 'data-citations', data: citations });
  writer.write({ type: 'finish' });

  const usage = await result.totalUsage;
  console.info(
    `[ask] one-shot answer in ${Math.round(performance.now() - started)} ms, ` +
      `${usage.inputTokens} input + ${usage.outputTokens} output tokens`
  );
}
