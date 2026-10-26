import type { SearchResult } from '../search/types';
import { extractLinks, toPlainText, type Link } from './markdown';

export interface Source {
  id: string;
  chunkId: number;
  sectionPath: string[];
  pages: number[];
  text: string;
  links: Link[];
}

// Gives each chunk a stable id for the request: a chunk found twice keeps its
// first id
export function createSourceRegistry() {
  const byChunk = new Map<number, Source>();

  return {
    add(result: SearchResult): Source {
      const known = byChunk.get(result.chunkId);
      if (known) return known;

      const source: Source = {
        id: `S${byChunk.size + 1}`,
        chunkId: result.chunkId,
        // Some headings contain links, e.g. "Draft [budget](https://…)".
        sectionPath: result.sectionPath.map(toPlainText),
        pages: result.pages,
        text: toPlainText(result.text),
        links: extractLinks(result.text)
      };
      byChunk.set(result.chunkId, source);
      return source;
    },

    list(): Source[] {
      return [...byChunk.values()];
    }
  };
}
