/**
 * Core domain types for git-wrapped.
 *
 * IMPORTANT: This module — and everything under `core/` — must stay free of any
 * presentation or runtime concerns (no ink, no chalk, no process.stdout). The only
 * impure thing in `core` is `git/extract.ts`, which shells out to `git` to BUILD a
 * `RepoData`. Every stat is a pure function `(RepoData) => StatResult | null`.
 *
 * This is the contract a future Go/Rust/Python port would re-implement: produce the
 * same `RepoData` shape, and the same stat semantics, and the CLI layer is the only
 * thing that needs rewriting per-language.
 */

/** A single person identified by name + email, as recorded in git. */
export interface Identity {
  name: string;
  email: string;
}

/** Per-file change within one commit. `null` line counts mean a binary file. */
export interface FileChange {
  path: string;
  added: number | null;
  deleted: number | null;
}

/** One commit, normalized. Dates are unix seconds (UTC). */
export interface Commit {
  hash: string;
  parents: string[];
  isMerge: boolean;
  author: Identity;
  committer: Identity;
  /** Author timestamp, unix seconds. */
  authorDate: number;
  /** Committer timestamp, unix seconds. */
  committerDate: number;
  /** Local-time hour (0-23) the author committed, derived from the git tz offset. */
  authorHourLocal: number;
  /** Local-time weekday (0=Sun..6=Sat) the author committed. */
  authorWeekdayLocal: number;
  subject: string;
  body: string;
  files: FileChange[];
}

/** One TODO/FIXME-style marker found in the working tree. */
export interface MarkerHit {
  /** The marker keyword, uppercased: TODO | FIXME | HACK | XXX. */
  marker: string;
  path: string;
  line: number;
  /** The trimmed source line the marker sits on. */
  text: string;
}

/** Counts of leftover-intent markers across tracked text files. */
export interface MarkerScan {
  /** Per-marker totals, e.g. { TODO: 42, FIXME: 7 }. */
  counts: Record<string, number>;
  /** Grand total across all markers. */
  total: number;
  /** A few representative (ideally spicy) example lines. */
  examples: MarkerHit[];
}

/** Everything a stat is allowed to read. Built once by `git/extract.ts`. */
export interface RepoData {
  /** Absolute path to the repository root. */
  root: string;
  /** Commits, newest first. */
  commits: Commit[];
  /** The person running the command (from `git config user.*`), if resolvable. */
  currentUser: Identity | null;
  /** Files currently tracked in the working tree (relative paths). */
  trackedFiles: string[];
  /**
   * Raw contents of a small allowlist of "signal" files (manifests, lockless
   * configs, hook scripts) when present and small. Keyed by repo-relative path.
   * Stats parse these purely — extraction just hands over the bytes.
   */
  signalFiles: Record<string, string>;
  /** TODO/FIXME/HACK/XXX markers scanned from the working tree. */
  markers: MarkerScan;
  /** When extraction ran (unix seconds) — injected so core stays free of Date.now ambiguity. */
  generatedAt: number;
}

/**
 * The output of a single stat. `roast` is the templated, human-facing burn.
 * `headline`/`detail` carry the raw factual stat so the CLI can show numbers too.
 */
export interface StatResult {
  /** Stable id, matches the Stat.id that produced it. */
  id: string;
  /** Display title, e.g. "The Night Owl". */
  title: string;
  /** Short factual line, e.g. "7 commits between 2–4am". */
  headline: string;
  /** Optional secondary fact / breakdown line. */
  detail?: string;
  /** The templated roast. */
  roast: string;
  /** Category for grouping in the UI. */
  category: StatCategory;
  /** Optional structured payload for richer rendering later (charts etc.). */
  data?: Record<string, unknown>;
}

export type StatCategory =
  | 'overview'
  | 'people'
  | 'habits'
  | 'messages'
  | 'smells'
  | 'code'
  | 'project';

/**
 * A stat is a pure analyzer. Return `null` when the stat does not apply to this
 * repo (e.g. no conventional commits found) so the runner can skip it cleanly.
 */
export interface Stat {
  id: string;
  title: string;
  category: StatCategory;
  compute: (repo: RepoData) => StatResult | null;
}
