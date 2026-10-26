"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import { checkCitations } from "../lib/answer/citations";
import type { HandbookMessage } from "../lib/answer/messages";
import type { Source } from "../lib/answer/sources";
import { MAX_QUESTION_LENGTH, validateQuestion } from "../lib/question";
import { AnswerText } from "./answer-text";
import { SourceCard } from "./source-card";

const EXAMPLE_QUESTIONS = [
  "How much parental leave do I get?",
  "What should I do if I'm sick?",
  "What laptop and monitor can I get?",
  "Is there a budget for books and training?",
  "Can I work on a side project outside of work?",
  "What pension and health insurance do UK employees get?",
];

const DEFAULT_PROGRESS = "Searching the handbook…";

// Each question stands alone (no conversation memory), so only the latest
// question is sent, matching the API's { question } input.
const transport = new DefaultChatTransport<HandbookMessage>({
  api: "/api/ask",
  prepareSendMessagesRequest: ({ messages }) => ({
    body: { question: latestQuestion(messages) },
  }),
});

function latestQuestion(messages: HandbookMessage[]): string {
  const last = messages.findLast((message) => message.role === "user");
  return last ? textOf(last) : "";
}

function textOf(message: HandbookMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function sourcesOf(message: HandbookMessage): Source[] {
  for (const part of message.parts) {
    if (part.type === "data-sources") return part.data;
  }
  return [];
}

interface Turn {
  question: HandbookMessage;
  reply?: HandbookMessage;
}

function toTurns(messages: HandbookMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "user") turns.push({ question: message });
    else if (turns.length > 0) turns[turns.length - 1].reply = message;
  }
  return turns;
}

export function Chat() {
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);

  const { messages, sendMessage, status, error, regenerate, setMessages, clearError } =
    useChat<HandbookMessage>({
      transport,
      onData: (part) => {
        if (part.type === "data-status") setProgress(part.data);
      },
    });

  const turns = toTurns(messages);
  const latestTurn = turns.at(-1);
  const busy = status === "submitted" || status === "streaming";
  const waitingForAnswer = busy && !(latestTurn?.reply && textOf(latestTurn.reply));
  const inputProblem = input.trim() ? validateQuestion(input) : null;

  // Scroll a new question to the top. .turn-latest is at least as tall as the
  // chat area, so there's always room to, and the answer streams in below.
  const latestQuestionId = latestTurn?.question.id;
  useEffect(() => {
    if (!latestQuestionId) return;
    document
      .getElementById(`question-${latestQuestionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [latestQuestionId]);

  function ask(question: string) {
    if (busy || validateQuestion(question)) return;
    setProgress(DEFAULT_PROGRESS);
    void sendMessage({ text: question.trim() });
    setInput("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      ask(input);
    }
  }

  function startOver() {
    setMessages([]);
    clearError();
  }

  return (
    <main className="chat">
      <div className="messages" aria-live="polite">
        {turns.length === 0 && (
          <section className="welcome">
            <p>Try one of these, or ask your own question:</p>
            <div className="examples">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button key={question} type="button" className="example" onClick={() => ask(question)}>
                  {question}
                </button>
              ))}
            </div>
          </section>
        )}

        {turns.map((turn) => {
          const isLatest = turn === latestTurn;
          return (
            <div key={turn.question.id} className={isLatest ? "turn turn-latest" : "turn"}>
              <p id={`question-${turn.question.id}`} className="question">
                {textOf(turn.question)}
              </p>

              {turn.reply && <Reply message={turn.reply} />}

              {isLatest && waitingForAnswer && <p className="progress">{progress}</p>}

              {isLatest && error && (
                <div className="error" role="alert">
                  <p>{error.message}</p>
                  <button type="button" onClick={() => void regenerate()}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="question" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about leave, benefits, equipment, expenses…"
          rows={2}
          aria-invalid={inputProblem ? true : undefined}
          aria-describedby="question-hint"
        />
        <div className="composer-footer">
          <span id="question-hint" className={inputProblem ? "hint hint-error" : "hint"}>
            {inputProblem ??
              (input.length > MAX_QUESTION_LENGTH * 0.8
                ? `${input.trim().length} / ${MAX_QUESTION_LENGTH} characters`
                : "Enter to ask · Shift+Enter for a new line")}
          </span>
          {messages.length > 0 && (
            <button type="button" className="text-button" onClick={startOver} disabled={busy}>
              Start over
            </button>
          )}
          <button type="submit" disabled={busy || !input.trim() || inputProblem !== null}>
            Ask
          </button>
        </div>
      </form>
    </main>
  );
}

// Renders nothing until the answer starts; the progress line shows until then.
function Reply({ message }: { message: HandbookMessage }) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const answer = textOf(message);
  if (!answer) return null;

  const sources = sourcesOf(message);
  const sourceIds = new Set(sources.map((source) => source.id));
  // Recomputed as the answer streams, so cited cards appear as markers do.
  const { cited } = checkCitations(answer, sourceIds);
  const citedSources = cited.flatMap((id) => sources.filter((source) => source.id === id));
  const otherSources = sources.filter((source) => !cited.includes(source.id));

  const cardId = (sourceId: string) => `source-${message.id}-${sourceId}`;

  function showSource(sourceId: string) {
    setHighlighted(sourceId);
    document.getElementById(cardId(sourceId))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const renderCards = (list: Source[]) => (
    <ol className="sources">
      {list.map((source) => (
        <li key={source.id}>
          <SourceCard
            source={source}
            domId={cardId(source.id)}
            highlighted={source.id === highlighted}
          />
        </li>
      ))}
    </ol>
  );

  return (
    <section className="reply">
      <AnswerText text={answer} sourceIds={sourceIds} onCite={showSource} />

      {citedSources.length > 0 && (
        <>
          <h2 className="sources-heading">Sources</h2>
          {renderCards(citedSources)}
        </>
      )}

      {otherSources.length > 0 && (
        <details className="more-sources">
          <summary>
            {citedSources.length > 0 ? "Other passages searched" : "Passages searched"} (
            {otherSources.length})
          </summary>
          {renderCards(otherSources)}
        </details>
      )}
    </section>
  );
}
