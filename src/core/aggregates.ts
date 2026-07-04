/**
 * Pure chart-friendly aggregates derived from RepoData. Stats answer "what's the
 * one funny fact"; aggregates answer "give me the distribution so the CLI can draw
 * a graph". Kept in core (pure) so any future port reuses the same numbers.
 */
import type { RepoData } from './types.js';
import { displayName, ext, idKey, isNoiseFile, LOOSE_FIX_RE, REFACTOR_RE } from './stats/helpers.js';

export interface AuthorStat {
  name: string;
  commits: number;
  added: number;
  deleted: number;
  /** Commits whose subject reads like a fix (LOOSE_FIX_RE). */
  fixes: number;
  /** Commits whose subject reads like a refactor/cleanup (REFACTOR_RE). */
  refactors: number;
  isYou: boolean;
}

/** Commit count for one calendar month, `key` = "YYYY-MM" (UTC). */
export interface MonthCount {
  key: string;
  count: number;
}

export interface FileStat {
  path: string;
  count: number;
}

/** A night/weekend coder. The higher the score, the more they live in the cave. */
export interface BatStat {
  name: string;
  night: number; // commits between 22:00 and 05:59
  weekend: number; // commits on Sat/Sun
  score: number;
  isYou: boolean;
}

export interface Aggregates {
  repoName: string;
  ageDays: number;
  years: string;
  firstDate: string;
  totalCommits: number;
  totalAdded: number;
  totalDeleted: number;
  humans: number;
  languages: { ext: string; files: number }[];
  topAuthors: AuthorStat[];
  workhorseShare: number;
  hourHistogram: number[]; // length 24
  weekdayHistogram: number[]; // length 7, 0=Sun
  topChurnFiles: FileStat[];
  /** Files ranked by how many distinct fix/bug commits touched them. */
  topFixFiles: FileStat[];
  /** Total number of (non-merge) commits whose subject reads like a fix. */
  fixCommits: number;
  /**
   * Lines (added + deleted) touched by those fix commits. Lets the sanity index weight
   * the fix share by effort, not just count — a one-line typo patch shouldn't count the
   * same as a week of feature work when judging "how much of this repo is firefighting".
   */
  fixLines: number;
  /** Commits per calendar month, ascending and gap-free from first to last month. */
  monthlyCommits: MonthCount[];
  batman: BatStat[];
  /** Mean number of files touched per (non-merge) commit. */
  avgFilesPerCommit: number;
  /** Commits that touched 15+ files at once — the "god commits". */
  godCommits: number;
  /** Most files touched in any single commit. */
  maxFilesInCommit: number;
}

const isNight = (hour: number) => hour >= 22 || hour <= 5;

export function computeAggregates(repo: RepoData): Aggregates {
  const commits = repo.commits.filter((c) => !c.isMerge);
  const youKey = repo.currentUser ? idKey(repo.currentUser) : null;

  // Per-author tallies.
  const authors = new Map<string, AuthorStat>();
  const bats = new Map<string, BatStat>();
  const hourHistogram = new Array(24).fill(0);
  const weekdayHistogram = new Array(7).fill(0);
  const churn = new Map<string, number>();
  const fixChurn = new Map<string, number>();
  const langs = new Map<string, number>();
  const monthly = new Map<string, number>();
  let totalFilesTouched = 0;
  let fixCommits = 0;
  let fixLines = 0;
  let godCommits = 0;
  let maxFilesInCommit = 0;

  for (const c of commits) {
    const key = idKey(c.author);
    const name = displayName(c.author);
    const isYou = youKey != null && key === youKey;

    const a = authors.get(key) ?? { name, commits: 0, added: 0, deleted: 0, fixes: 0, refactors: 0, isYou };
    a.commits += 1;
    for (const f of c.files) {
      a.added += f.added ?? 0;
      a.deleted += f.deleted ?? 0;
      churn.set(f.path, (churn.get(f.path) ?? 0) + 1);
    }
    if (REFACTOR_RE.test(c.subject)) a.refactors += 1;
    authors.set(key, a);

    const month = new Date(c.authorDate * 1000).toISOString().slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);

    // Fix-prone files: count each file at most once per fix commit, so a file is
    // ranked by how many bug/fix commits it appeared in, not how big they were.
    if (LOOSE_FIX_RE.test(c.subject)) {
      fixCommits += 1;
      a.fixes += 1;
      const seen = new Set<string>();
      for (const f of c.files) {
        if (seen.has(f.path)) continue;
        seen.add(f.path);
        fixChurn.set(f.path, (fixChurn.get(f.path) ?? 0) + 1);
        fixLines += (f.added ?? 0) + (f.deleted ?? 0);
      }
    }

    totalFilesTouched += c.files.length;
    if (c.files.length >= 15) godCommits += 1;
    if (c.files.length > maxFilesInCommit) maxFilesInCommit = c.files.length;

    hourHistogram[c.authorHourLocal] += 1;
    weekdayHistogram[c.authorWeekdayLocal] += 1;

    const weekend = c.authorWeekdayLocal === 0 || c.authorWeekdayLocal === 6;
    const night = isNight(c.authorHourLocal);
    if (night || weekend) {
      const b = bats.get(key) ?? { name, night: 0, weekend: 0, score: 0, isYou };
      if (night) b.night += 1;
      if (weekend) b.weekend += 1;
      b.score = b.night + b.weekend;
      bats.set(key, b);
    }
  }

  for (const f of repo.trackedFiles) {
    const e = ext(f);
    if (e) langs.set(e, (langs.get(e) ?? 0) + 1);
  }

  const topAuthors = [...authors.values()].sort((x, y) => y.commits - x.commits);
  const totalCommits = commits.length;
  const workhorseShare = topAuthors[0] && totalCommits ? Math.round((topAuthors[0].commits / totalCommits) * 100) : 0;

  const tracked = new Set(repo.trackedFiles);
  const rankFiles = (counts: Map<string, number>): FileStat[] =>
    [...counts.entries()]
      .filter(([p]) => tracked.size === 0 || tracked.has(p))
      .filter(([p]) => !isNoiseFile(p)) // lockfiles/translations/manifests aren't "haunted", just busy
      .map(([path, count]) => ({ path, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 6);
  const topChurnFiles = rankFiles(churn);
  const topFixFiles = rankFiles(fixChurn);

  const first = commits[commits.length - 1];
  const ageDays = first ? Math.max(0, Math.floor((repo.generatedAt - first.authorDate) / 86400)) : 0;

  // A contiguous month-by-month series (zeros filled in), so the fever chart can show
  // the silences as clearly as the spikes.
  const monthlyCommits: MonthCount[] = [];
  if (monthly.size > 0) {
    const keys = [...monthly.keys()].sort();
    const [firstKey, lastKey] = [keys[0]!, keys[keys.length - 1]!];
    let [y, m] = firstKey.split('-').map(Number) as [number, number];
    const [ly, lm] = lastKey.split('-').map(Number) as [number, number];
    while (y < ly || (y === ly && m <= lm)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthlyCommits.push({ key, count: monthly.get(key) ?? 0 });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  }

  return {
    repoName: repo.root.split('/').pop() || repo.root,
    ageDays,
    years: (ageDays / 365).toFixed(1),
    firstDate: first ? new Date(first.authorDate * 1000).toISOString().slice(0, 10) : '—',
    totalCommits,
    totalAdded: [...authors.values()].reduce((s, a) => s + a.added, 0),
    totalDeleted: [...authors.values()].reduce((s, a) => s + a.deleted, 0),
    humans: authors.size,
    languages: [...langs.entries()].map(([ext, files]) => ({ ext, files })).sort((x, y) => y.files - x.files).slice(0, 5),
    topAuthors,
    workhorseShare,
    hourHistogram,
    weekdayHistogram,
    topChurnFiles,
    topFixFiles,
    fixCommits,
    fixLines,
    monthlyCommits,
    batman: [...bats.values()].sort((x, y) => y.score - x.score),
    avgFilesPerCommit: totalCommits ? totalFilesTouched / totalCommits : 0,
    godCommits,
    maxFilesInCommit,
  };
}
