// Citation markers in an answer: [S1], [S1][S3], or the occasional [S1, S3].
const CITATION = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;

export type AnswerSegment = { type: "text"; text: string } | { type: "citation"; ids: string[] };

export function splitCitations(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;

  for (const match of answer.matchAll(CITATION)) {
    if (match.index > last) segments.push({ type: "text", text: answer.slice(last, match.index) });
    segments.push({ type: "citation", ids: match[1].split(/\s*,\s*/) });
    last = match.index + match[0].length;
  }
  if (last < answer.length) segments.push({ type: "text", text: answer.slice(last) });

  return segments;
}

export interface CitationCheck {
  /** Source ids the answer cites, in the order first cited. */
  cited: string[];
  unknown: string[];
}

export function checkCitations(answer: string, sourceIds: Iterable<string>): CitationCheck {
  const known = new Set(sourceIds);
  const cited = new Set<string>();
  const unknown = new Set<string>();

  for (const segment of splitCitations(answer)) {
    if (segment.type !== "citation") continue;
    for (const id of segment.ids) (known.has(id) ? cited : unknown).add(id);
  }

  return { cited: [...cited], unknown: [...unknown] };
}
