/**
 * The ONE impure module in core: shells out to `git` and parses its output into a
 * normalized `RepoData`. Everything downstream is pure.
 *
 * Extraction strategy: a single `git log` pass using control characters as field
 * (\x1f) and record (\x1e) separators so commit subjects/bodies can contain anything
 * (newlines, quotes, the word "fix") without breaking the parse. Per-commit numstat
 * lines follow each record.
 */
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Commit, FileChange, Identity, MarkerScan, RepoData } from '../types.js';
import { canonicalizeIdentities } from '../identity.js';

const FIELD = '\x1f'; // unit separator
const RECORD = '\x1e'; // record separator

const MAX_GIT_BUFFER = 256 * 1024 * 1024; // big repos

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_GIT_BUFFER,
  });
}

const execFileAsync = promisify(execFile);

/**
 * Async twin of `git()` for the one call that dominates wall-clock on a big repo —
 * the full `git log`. Running it async keeps the event loop free so the CLI's loading
 * spinner actually animates while git streams its (possibly enormous) output.
 */
async function gitAsync(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_GIT_BUFFER,
  });
  return stdout;
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

/**
 * "Signal" files worth reading in full — language manifests, hook scripts, and tool
 * configs across every ecosystem (JS, Python, Go, Rust, Java/Kotlin, PHP, Ruby, .NET,
 * Elixir, Dart…). Matched by BASENAME so nested manifests in monorepos / multi-module
 * builds are picked up too, not just the ones at the repo root.
 */
const SIGNAL_BASENAME_RE = new RegExp(
  [
    // JS / TS manifests & configs
    '^package\\.json$', '^tsconfig.*\\.json$', '^\\.nycrc(\\.json)?$', '^biome\\.jsonc?$',
    '^\\.eslintrc.*$', '^eslint\\.config\\.[cm]?js$', '^\\.prettierrc.*$',
    '^jest\\.config\\.[cm]?[jt]s(on)?$', '^vitest\\.config\\.[cm]?[jt]s$', '^vite\\.config\\.[cm]?[jt]s$',
    '^commitlint\\.config\\.[cm]?js$', '^\\.lintstagedrc.*$',
    // Python
    '^requirements[^/]*\\.txt$', '^pyproject\\.toml$', '^Pipfile$', '^setup\\.cfg$', '^tox\\.ini$',
    '^\\.coveragerc$', '^\\.flake8$', '^\\.pylintrc$', '^\\.?ruff\\.toml$', '^mypy\\.ini$',
    // Go
    '^go\\.mod$', '^\\.golangci\\.(ya?ml|toml)$',
    // Rust
    '^Cargo\\.toml$', '^\\.?rustfmt\\.toml$', '^clippy\\.toml$',
    // Java / Kotlin
    '^pom\\.xml$', '^build\\.gradle(\\.kts)?$', '^settings\\.gradle(\\.kts)?$',
    '^checkstyle\\.xml$', '^detekt\\.ya?ml$',
    // PHP
    '^composer\\.json$', '^phpstan\\.neon(\\.dist)?$', '^psalm\\.xml(\\.dist)?$',
    '^\\.?phpcs\\.xml(\\.dist)?$', '^\\.php-cs-fixer(\\.dist)?\\.php$', '^phpunit\\.xml(\\.dist)?$',
    // Ruby
    '^Gemfile$', '^\\.rubocop\\.yml$', '^\\.overcommit\\.yml$',
    // Elixir / Dart / .NET
    '^mix\\.exs$', '^pubspec\\.yaml$', '^.+\\.csproj$',
    // hooks / CI-adjacent / build
    '^\\.pre-commit-config\\.ya?ml$', '^lefthook\\.ya?ml$', '^\\.gitlint$',
    '^Dockerfile$', '^docker-compose\\.ya?ml$', '^Makefile$', '^CMakeLists\\.txt$',
  ].join('|'),
);

/** Files matched by exact relative path (not basename) — e.g. the Husky hook scripts. */
const SIGNAL_PATH_RE = /(^|\/)\.husky\/(pre-commit|pre-push|commit-msg)$/;

const MAX_SIGNAL_BYTES = 256 * 1024;
const MAX_SIGNAL_FILES = 120;

function basenameOf(p: string): string {
  return p.split('/').pop() ?? p;
}

/**
 * Read the signal files among the tracked set (so we honor .gitignore and find nested
 * manifests). Keyed by repo-relative path; bounded in count and per-file size.
 */
function readSignalFiles(root: string, trackedFiles: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const rel of trackedFiles) {
    if (n >= MAX_SIGNAL_FILES) break;
    if (!SIGNAL_BASENAME_RE.test(basenameOf(rel)) && !SIGNAL_PATH_RE.test(rel)) continue;
    try {
      const p = join(root, rel);
      const st = statSync(p);
      if (!st.isFile() || st.size > MAX_SIGNAL_BYTES) continue;
      out[rel] = readFileSync(p, 'utf8');
      n += 1;
    } catch {
      // missing / unreadable — just skip it
    }
  }
  return out;
}

const MARKER_KEYWORDS = ['TODO', 'FIXME', 'HACK', 'XXX'];
const MARKER_RE = new RegExp(`\\b(${MARKER_KEYWORDS.join('|')})\\b`, 'g');
// A marker only counts as real debt if it sits in a COMMENT, not in code that merely
// mentions the word (string literals, regexes, arrays). We approximate "is in a comment"
// by requiring a comment introducer before the marker on the line.
//
// Strong, unambiguous introducers — if one appears anywhere before the marker, the
// marker is inside that comment: // and /* (C-family), # (Python/PHP/Ruby/shell/YAML),
// and <!-- (HTML/XML).
const COMMENT_LEAD_RE = /(\/\/|#|\/\*|<!--)/;
// `--` and `;` ALSO introduce comments — but only in their comment form. Treated
// loosely they wreck Java/PHP/JS/C accuracy, where `;` ends nearly every statement and
// `i--`/`--i` is decrement, so a marker word in a string on a multi-statement line
// (`foo(); log("FIXME")`) would be miscounted as debt. So pin them to their real shape:
//   `--` is a SQL/Lua/Haskell comment only when space-delimited (` -- text`).
const DASH_COMMENT_RE = /(?:^|\s)--(?=\s)/;
//   `;`  is a Lisp/ini/asm comment only at the start of the line.
const SEMI_COMMENT_RE = /^\s*;/;
// Lines that read as a confession make the funniest examples — surface them first.
const SPICY_RE = /\b(temp|temporary|hack|sorry|don'?t|never|please|why|wtf|ugh|broken|dirty|gross|remove|delete|someday|later|nuke|cursed|magic)\b/i;

/** True when the marker at `idx` looks like it lives inside a comment on this line. */
function inComment(line: string, idx: number): boolean {
  const before = line.slice(0, idx);
  if (COMMENT_LEAD_RE.test(before)) return true;
  if (DASH_COMMENT_RE.test(before) || SEMI_COMMENT_RE.test(before)) return true;
  // Block-comment continuation lines: " * TODO ..."
  return /^\s*\*/.test(line);
}

/**
 * Scan the working tree for leftover-intent markers via `git grep` (fast, native,
 * binary-aware). Returns counts plus a few example lines, preferring "spicy" ones.
 */
function scanMarkers(root: string): MarkerScan {
  const counts: Record<string, number> = {};
  for (const k of MARKER_KEYWORDS) counts[k] = 0;
  const examples: MarkerScan['examples'] = [];

  let raw = '';
  try {
    raw = git(['grep', '-nI', '--no-color', '-E', '-w', '-e', MARKER_KEYWORDS.join('|')], root);
  } catch {
    // `git grep` exits non-zero when there are zero matches — treat as clean.
    return { counts, total: 0, examples };
  }

  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line) continue;
    // Format: path:lineno:content
    const m = /^(.+?):(\d+):(.*)$/.exec(line);
    if (!m) continue;
    const path = m[1]!;
    const lineNo = Number(m[2]);
    const text = m[3]!.trim();

    // Count each marker occurrence, but only the ones sitting inside a comment.
    let primary = '';
    MARKER_RE.lastIndex = 0;
    let m2: RegExpExecArray | null;
    while ((m2 = MARKER_RE.exec(text)) !== null) {
      if (!inComment(text, m2.index)) continue;
      const key = m2[1]!.toUpperCase();
      if (counts[key] === undefined) counts[key] = 0;
      counts[key] += 1;
      primary = key;
    }
    if (primary && examples.length < 40) {
      examples.push({ marker: primary, path, line: lineNo, text: text.slice(0, 160) });
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  // Keep the spiciest handful for display.
  examples.sort((a, b) => Number(SPICY_RE.test(b.text)) - Number(SPICY_RE.test(a.text)));
  return { counts, total, examples: examples.slice(0, 6) };
}

export interface ExtractOptions {
  /** Include merge commits (needed for self-merger stat). Default true. */
  includeMerges?: boolean;
  /**
   * Only analyze commits newer than this point in time. Passed straight to
   * `git log --since`, so it accepts git's relative ("2 years ago", "6 months")
   * or absolute ("2024-01-01") date syntax. Undefined ⇒ entire history.
   */
  since?: string;
  /** Generation timestamp (unix seconds). Injected for determinism/testability. */
  now?: number;
}

/** Resolve the repo root, throwing the same friendly error everywhere. */
function resolveRoot(cwd: string): string {
  const root = resolve(cwd);
  if (!isGitRepo(root)) {
    throw new Error(`Not a git repository: ${root}`);
  }
  return git(['rev-parse', '--show-toplevel'], root).trim();
}

function logArgsFor(opts: ExtractOptions): string[] {
  const logArgs = ['log', '--no-color', '--numstat', `--pretty=format:${RECORD}${LOG_FORMAT}`];
  if (opts.includeMerges === false) logArgs.push('--no-merges');
  if (opts.since) logArgs.push(`--since=${opts.since}`);
  return logArgs;
}

/**
 * Assemble a RepoData from an already-fetched `git log` dump. The remaining git/fs
 * reads (ls-files, signal files, marker grep) are comparatively cheap, so they stay
 * synchronous in both the sync and async entry points below.
 */
function assemble(realRoot: string, rawLog: string, opts: ExtractOptions): RepoData {
  // Merge the same human recorded under different name orderings / emails before any
  // stat counts them, so leaderboards don't list one person three times.
  const { commits, currentUser } = canonicalizeIdentities(parseLog(rawLog), resolveCurrentUser(realRoot));

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
    currentUser,
    trackedFiles,
    signalFiles: readSignalFiles(realRoot, trackedFiles),
    markers: scanMarkers(realRoot),
    generatedAt: opts.now ?? Math.floor(Date.now() / 1000),
  };
}

/** Build a RepoData by reading the git repo at `cwd`. Throws if not a git repo. */
export function extractRepoData(cwd: string, opts: ExtractOptions = {}): RepoData {
  const realRoot = resolveRoot(cwd);
  return assemble(realRoot, git(logArgsFor(opts), realRoot), opts);
}

/**
 * Async twin of `extractRepoData`. Identical result, but the heavy `git log` traversal
 * runs off the main thread so a UI can keep painting (a spinner) while a big repo loads.
 */
export async function extractRepoDataAsync(cwd: string, opts: ExtractOptions = {}): Promise<RepoData> {
  const realRoot = resolveRoot(cwd);
  return assemble(realRoot, await gitAsync(logArgsFor(opts), realRoot), opts);
}
