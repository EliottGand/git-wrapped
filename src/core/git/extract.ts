/**
 * The ONE impure module in core: shells out to `git` and parses its output into a
 * normalized `RepoData`. Everything downstream is pure.
 *
 * Extraction strategy: a single `git log` pass using control characters as field
 * (\x1f) and record (\x1e) separators so commit subjects/bodies can contain anything
 * (newlines, quotes, the word "fix") without breaking the parse. Per-commit numstat
 * lines follow each record.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Commit, FileChange, Identity, RepoData } from '../types.js';

const FIELD = '\x1f'; // unit separator
const RECORD = '\x1e'; // record separator

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024, // big repos
  });
}

/** Parse a git "<unix> <tz>" pair into local hour/weekday using the recorded offset. */
function localParts(unix: number, tzOffset: string): { hour: number; weekday: number } {
  // tzOffset like "+0200" or "-0500"
  const sign = tzOffset.startsWith('-') ? -1 : 1;
  const hh = Number(tzOffset.slice(1, 3));
  const mm = Number(tzOffset.slice(3, 5));
  const offsetSec = sign * (hh * 3600 + mm * 60);
  const local = new Date((unix + offsetSec) * 1000);
  return { hour: local.getUTCHours(), weekday: local.getUTCDay() };
}

function isGitRepo(cwd: string): boolean {
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

function resolveCurrentUser(cwd: string): Identity | null {
  try {
    const name = git(['config', 'user.name'], cwd).trim();
    const email = git(['config', 'user.email'], cwd).trim();
    if (!name && !email) return null;
    return { name, email };
  } catch {
    return null;
  }
}

const LOG_FORMAT = [
  '%H', // hash
  '%P', // parent hashes
  '%an', // author name
  '%ae', // author email
  '%at', // author unix time
  '%ai', // author iso (for tz offset)
  '%cn', // committer name
  '%ce', // committer email
  '%ct', // committer unix time
  '%s', // subject
  '%b', // body
].join(FIELD);

function parseLog(raw: string): Commit[] {
  const commits: Commit[] = [];
  const records = raw.split(RECORD);

  for (const record of records) {
    const trimmed = record.replace(/^\n+/, '');
    if (!trimmed) continue;

    // Header fields are FIELD-separated; numstat lines come after the last field,
    // which is the body. The body itself can contain newlines, so we split the
    // header off by counting FIELD-delimited fields first.
    const parts = trimmed.split(FIELD);
    if (parts.length < 11) continue;

    const [hash, parentStr, an, ae, at, ai, cn, ce, ct] = parts;
    const subject = parts[9] ?? '';
    // The 11th field (body) plus any trailing numstat block live in parts[10].
    const bodyAndStat = parts.slice(10).join(FIELD);

    // Split body from the numstat block. numstat lines look like "12\t3\tpath"
    // or "-\t-\tpath" for binaries. They begin after a blank line / newlines.
    const lines = bodyAndStat.split('\n');
    const bodyLines: string[] = [];
    const files: FileChange[] = [];
    let inStat = false;
    for (const line of lines) {
      const statMatch = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
      if (statMatch) {
        inStat = true;
        files.push({
          added: statMatch[1] === '-' ? null : Number(statMatch[1]),
          deleted: statMatch[2] === '-' ? null : Number(statMatch[2]),
          path: statMatch[3]!,
        });
      } else if (!inStat) {
        bodyLines.push(line);
      }
    }

    const authorDate = Number(at);
    const tzOffset = (ai ?? '').trim().split(' ').pop() ?? '+0000';
    const { hour, weekday } = localParts(authorDate, tzOffset);
    const parents = (parentStr ?? '').trim() ? parentStr!.trim().split(' ') : [];

    commits.push({
      hash: hash!,
      parents,
      isMerge: parents.length > 1,
      author: { name: an ?? '', email: (ae ?? '').toLowerCase() },
      committer: { name: cn ?? '', email: (ce ?? '').toLowerCase() },
      authorDate,
      committerDate: Number(ct),
      authorHourLocal: hour,
      authorWeekdayLocal: weekday,
      subject,
      body: bodyLines.join('\n').trim(),
      files,
    });
  }

  return commits;
}

export interface ExtractOptions {
  /** Include merge commits (needed for self-merger stat). Default true. */
  includeMerges?: boolean;
  /** Generation timestamp (unix seconds). Injected for determinism/testability. */
  now?: number;
}

/** Build a RepoData by reading the git repo at `cwd`. Throws if not a git repo. */
export function extractRepoData(cwd: string, opts: ExtractOptions = {}): RepoData {
  const root = resolve(cwd);
  if (!isGitRepo(root)) {
    throw new Error(`Not a git repository: ${root}`);
  }

  const realRoot = git(['rev-parse', '--show-toplevel'], root).trim();

  const logArgs = [
    'log',
    '--no-color',
    '--numstat',
    `--pretty=format:${RECORD}${LOG_FORMAT}`,
  ];
  if (opts.includeMerges !== false) {
    // default git log already follows first-parent? No — it shows all. Keep merges.
  } else {
    logArgs.push('--no-merges');
  }

  const rawLog = git(logArgs, realRoot);
  const commits = parseLog(rawLog);

  let trackedFiles: string[] = [];
  try {
    trackedFiles = git(['ls-files'], realRoot)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    trackedFiles = [];
  }

  return {
    root: realRoot,
    commits,
    currentUser: resolveCurrentUser(realRoot),
    trackedFiles,
    generatedAt: opts.now ?? Math.floor(Date.now() / 1000),
  };
}
