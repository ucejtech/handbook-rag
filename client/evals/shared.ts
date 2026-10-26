import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EVALS_DIR = path.join(process.cwd(), 'evals');

export interface EvalCase {
  id: string;
  category: string;
  question: string;
  expectedPages: number[];
  mustInclude: string[];
  shouldDecline: boolean;
  /** Set to true once the case is checked against the handbook. */
  verified: boolean;
  notes?: string;
}

export function loadCases(): EvalCase[] {
  const cases = JSON.parse(
    readFileSync(path.join(EVALS_DIR, 'cases.json'), 'utf8')
  ) as EvalCase[];
  const ids = new Set<string>();
  for (const evalCase of cases) {
    if (ids.has(evalCase.id))
      throw new Error(`Duplicate case id in cases.json: ${evalCase.id}`);
    ids.add(evalCase.id);
  }
  return cases;
}

export function pagesOverlap(a: number[], b: number[]): boolean {
  return a.some((page) => b.includes(page));
}

/** Results for unverified cases are provisional, so say how many there are. */
export function warnAboutUnverified(cases: EvalCase[]): void {
  const unverified = cases.filter((evalCase) => !evalCase.verified).length;
  if (unverified > 0) {
    console.log(
      `Note: ${unverified} of ${cases.length} cases aren't verified yet (marked *).\n`
    );
  }
}

export function caseLabel(evalCase: EvalCase): string {
  return evalCase.verified ? evalCase.id : `${evalCase.id}*`;
}

export function printTable(rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column]).length))
  );
  const line = (values: string[]) =>
    values.map((value, i) => value.padEnd(widths[i])).join('  ');
  console.log(line(columns));
  console.log(line(widths.map((width) => '-'.repeat(width))));
  for (const row of rows)
    console.log(line(columns.map((column) => String(row[column]))));
  console.log();
}

export function percent(part: number, total: number): string {
  return total === 0 ? 'n/a' : `${Math.round((part / total) * 100)}%`;
}

/** Save a run to evals/results/<name>-<timestamp>.json and return the path. */
export function saveResults(name: string, data: unknown): string {
  const dir = path.join(EVALS_DIR, 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(dir, `${name}-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return path.relative(process.cwd(), file);
}
