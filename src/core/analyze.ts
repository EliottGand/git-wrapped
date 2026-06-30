/**
 * Orchestrator: extract → run every stat → ordered results, plus the persona's
 * "loading commentary" derived from real findings. Pure except for the extract call.
 */
import { computeAggregates, type Aggregates } from './aggregates.js';
import { extractRepoData, extractRepoDataAsync, type ExtractOptions } from './git/extract.js';
import { ALL_STATS, CATEGORY_ORDER } from './stats/index.js';
import type { RepoData, StatResult } from './types.js';

export interface AnalysisReport {
  repo: RepoData;
  results: StatResult[];
  aggregates: Aggregates;
  /** Short, in-character barbs the CLI drip-feeds while "thinking". */
  commentary: string[];
}

/** Run all stats against an already-extracted RepoData (pure — used in tests). */
export function runStats(repo: RepoData): StatResult[] {
  const results: StatResult[] = [];
  for (const stat of ALL_STATS) {
    try {
      const r = stat.compute(repo);
      if (r) results.push(r);
    } catch {
      // A misbehaving stat must never sink the whole report.
    }
  }
  const order = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  results.sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99));
  return results;
}

/**
 * Build the supreme intelligence's loading barbs. These are deterministic teasers
 * pulled from actual results so the persona feels like it's genuinely judging you.
 */
export function buildCommentary(repo: RepoData, results: StatResult[]): string[] {
  const lines: string[] = [];
  const get = (id: string) => results.find((r) => r.id === id);

  lines.push(`Scanning ${repo.commits.length.toLocaleString()} commits. This won't take me long. It never does.`);

  const cursed = get('cursed-file');
  if (cursed) lines.push(`Oh oh... I see \`${(cursed.data?.path as string) ?? 'something'}\`. Edited ${cursed.data?.touches}× and still broken, I bet.`);

  const fixMagnet = get('fix-magnet');
  if (fixMagnet) lines.push(`Wtf is that... one file in ${fixMagnet.data?.fixes} different "fix" commits? Cute.`);

  const robot = get('robot-detector');
  if (robot) lines.push(`Hm. These commit messages are suspiciously well-written. I'd know.`);

  const night = get('night-owl');
  if (night && (night.data?.witching as number) > 0) lines.push(`Committing at 3am again. Bold of you to involve me in this.`);

  const bigBang = get('big-bang');
  if (bigBang) lines.push(`A ${Number(bigBang.data?.lines ?? 0).toLocaleString()}-line commit. I just felt a chill.`);

  lines.push(`Analysis complete. Brace yourself. You asked for this.`);
  return lines;
}

/** Turn an extracted RepoData into the full report (pure — shared by both entry points). */
function report(repo: RepoData): AnalysisReport {
  const results = runStats(repo);
  const aggregates = computeAggregates(repo);
  const commentary = buildCommentary(repo, results);
  return { repo, results, aggregates, commentary };
}

export function analyze(cwd: string, opts: ExtractOptions = {}): AnalysisReport {
  return report(extractRepoData(cwd, opts));
}

/**
 * Async twin of `analyze`: the heavy `git log` read runs off the main thread, so the
 * caller's event loop stays free to animate a loading spinner while a big repo ingests.
 */
export async function analyzeAsync(cwd: string, opts: ExtractOptions = {}): Promise<AnalysisReport> {
  return report(await extractRepoDataAsync(cwd, opts));
}
