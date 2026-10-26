'use client';

import { useState } from 'react';

import type { Source } from '../lib/answer/sources';
import { formatPages, formatSectionPath } from '../lib/format';

const COLLAPSE_AFTER_CHARS = 320;

// Most passages open with their own heading, which the card header already
// shows. Drop that first line, unless the heading is all there is.
function withoutRepeatedHeading(text: string, sectionPath: string[]): string {
  const title = sectionPath.at(-1)?.trim();
  const [firstLine, ...rest] = text.split('\n');
  const body = rest.join('\n').trim();
  return title && firstLine.trim() === title && body ? body : text;
}

export function SourceCard({
  source,
  domId,
  highlighted = false
}: {
  source: Source;
  domId?: string;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = withoutRepeatedHeading(source.text, source.sectionPath);
  const collapsible = text.length > COLLAPSE_AFTER_CHARS;

  return (
    <article
      id={domId}
      className={highlighted ? 'source-card highlighted' : 'source-card'}
    >
      <header className='source-header'>
        <span className='source-id'>{source.id}</span>
        <span className='source-section'>
          {formatSectionPath(source.sectionPath)}
        </span>
        <span className='source-pages'>{formatPages(source.pages)}</span>
      </header>

      <blockquote
        className={
          collapsible && !expanded ? 'source-text clamped' : 'source-text'
        }
      >
        {text}
      </blockquote>

      {collapsible && (
        <button
          type='button'
          className='text-button'
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show full passage'}
        </button>
      )}

      {source.links.length > 0 && (
        <ul className='source-links' aria-label='Links in this passage'>
          {source.links.map((link) => (
            <li key={link.target}>
              <a
                href={
                  link.type === 'email' ? `mailto:${link.target}` : link.target
                }
                target='_blank'
                rel='noopener noreferrer'
                title={link.target}
              >
                {link.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
