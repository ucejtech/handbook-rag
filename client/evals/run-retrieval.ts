import { closePool } from '../src/lib/db';
import { search } from '../src/lib/search/search';
import { SEARCH_MODES, type SearchMode } from '../src/lib/search/types';
import {
  caseLabel,
  loadCases,
  pagesOverlap,
  percent,
  printTable,
  saveResults,
  warnAboutUnverified
} from './shared';

interface CaseResult {
  id: string;
  category: string;
  verified: boolean;
  /** Rank (1-8) of the first result on an expected page, or null if none. */
  ranks: Record<SearchMode, number | null>;
}

async function main(): Promise<void> {
  const cases = loadCases().filter(
    (evalCase) => evalCase.expectedPages.length > 0
  );
  console.log(
    `Retrieval eval: ${cases.length} cases with expected pages, modes ${SEARCH_MODES.join(', ')}\n`
  );
  warnAboutUnverified(cases);

  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    const ranks = {} as Record<SearchMode, number | null>;
    for (const mode of SEARCH_MODES) {
      const found = await search(evalCase.question, mode);
      const index = found.findIndex((result) =>
        pagesOverlap(result.pages, evalCase.expectedPages)
      );
      ranks[mode] = index === -1 ? null : index + 1;
    }
    results.push({
      id: evalCase.id,
      category: evalCase.category,
      verified: evalCase.verified,
      ranks
    });
  }

  printTable(
    results.map((result) => ({
      case: caseLabel(cases.find((evalCase) => evalCase.id === result.id)!),
      category: result.category,
      ...Object.fromEntries(
        SEARCH_MODES.map((mode) => [mode, result.ranks[mode] ?? 'miss'])
      )
    }))
  );

  const summary = SEARCH_MODES.map((mode) => {
    const ranks = results.map((result) => result.ranks[mode]);
    const hits = (k: number) =>
      ranks.filter((rank) => rank !== null && rank <= k).length;
    const mrr =
      ranks.reduce<number>((sum, rank) => sum + (rank ? 1 / rank : 0), 0) /
      ranks.length;
    return {
      mode,
      'hit@5': percent(hits(5), ranks.length),
      'hit@8': percent(hits(8), ranks.length),
      MRR: mrr.toFixed(2)
    };
  });
  printTable(summary);

  const file = saveResults('retrieval', {
    ranAt: new Date().toISOString(),
    summary,
    results
  });
  console.log(`Saved ${file}`);
}

main()
  .catch((error: unknown) => {
    console.error(
      `Retrieval eval failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  })
  .finally(closePool);
