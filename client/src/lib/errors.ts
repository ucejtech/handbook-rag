import { APICallError, RetryError } from 'ai';

export class SetupError extends Error {
  override name = 'SetupError';
}

export function toUserMessage(error: unknown): string {
  if (error instanceof SetupError) return error.message;

  // The AI SDK retries failed calls and then wraps the last failure.
  if (RetryError.isInstance(error)) return toUserMessage(error.lastError);

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401) {
      return 'OpenAI rejected the API key. Check OPENAI_API_KEY in .env.';
    }
    if (error.statusCode === 404) {
      return "OpenAI doesn't recognise the model. Check ANSWER_MODEL and EMBEDDING_MODEL in .env.";
    }
    if (error.statusCode === 429) {
      return "OpenAI's rate limit was reached. Wait a moment and try again.";
    }
    return "OpenAI couldn't handle the request right now. Try again in a moment.";
  }

  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return 'Answering took too long. Try again.';
  }

  return 'Something went wrong while answering. Try again.';
}

export function reportError(error: unknown): string {
  if (!(error instanceof SetupError)) console.error('[ask] failed:', error);
  return toUserMessage(error);
}
