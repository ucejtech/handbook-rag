export const MAX_QUESTION_LENGTH = 1_000;

// Shared by the chat box and the API so both show the same message.
export function validateQuestion(question: string): string | null {
  const trimmed = question.trim();
  if (!trimmed) return "Please type a question.";
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return `Please keep your question under ${MAX_QUESTION_LENGTH.toLocaleString("en-US")} characters (it's ${trimmed.length.toLocaleString("en-US")}).`;
  }
  return null;
}
