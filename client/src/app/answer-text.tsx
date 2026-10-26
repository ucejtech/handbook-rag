import { Fragment } from "react";

import { splitCitations } from "../lib/answer/citations";

const URL_PATTERN = /(https?:\/\/[^\s<>()[\]"'`]+[^\s<>()[\]"'`.,;:!?])/g;

function Linkified({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

// Markers that match no source are left out (the server logs them).
export function AnswerText({
  text,
  sourceIds,
  onCite,
}: {
  text: string;
  sourceIds: Set<string>;
  onCite: (id: string) => void;
}) {
  return (
    <div className="answer">
      {splitCitations(text).map((segment, index) =>
        segment.type === "text" ? (
          <Linkified key={index} text={segment.text} />
        ) : (
          segment.ids
            .filter((id) => sourceIds.has(id))
            .map((id) => (
              <button
                key={`${index}-${id}`}
                type="button"
                className="cite-chip"
                onClick={() => onCite(id)}
                aria-label={`Show source ${id}`}
              >
                {id}
              </button>
            ))
        ),
      )}
    </div>
  );
}
