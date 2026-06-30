/** Pure helpers shared by stat modules. No I/O. */
import type { Commit, Identity, RepoData } from '../types.js';

/**
 * A commit whose subject reads like a fix/bug/revert. Shared so the fix-magnet stat,
 * the fix-prone-files aggregate, and the sanity index all agree on what "a fix" is.
 */
export const LOOSE_FIX_RE = /\bfix(e[ds])?\b|\bhotfix\b|\bbugfix\b|\brevert\b/i;

/** Canonical key for an identity — email if present, else lowercased name. */
export function idKey(id: Identity): string {
  return (id.email || id.name).toLowerCase();
}

export function displayName(id: Identity): string {
  return id.name || id.email || 'unknown';
}

/** True when a commit was authored by the current user (best-effort identity match). */
export function isCurrentUser(commit: Commit, repo: RepoData): boolean {
  if (!repo.currentUser) return false;
  return idKey(commit.author) === idKey(repo.currentUser);
}

/** Group commits by author identity key. */
export function byAuthor(commits: Commit[]): Map<string, { id: Identity; commits: Commit[] }> {
  const map = new Map<string, { id: Identity; commits: Commit[] }>();
  for (const c of commits) {
    const key = idKey(c.author);
    const entry = map.get(key);
    if (entry) entry.commits.push(c);
    else map.set(key, { id: c.author, commits: [c] });
  }
  return map;
}

/** Pick the entry with the max score; ties broken by first seen. */
export function maxBy<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}

export function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural ?? `${singular}s`);
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/**
 * Deterministic pseudo-random index in [0, length). Stable for a given (seed, salt)
 * pair — so a single run is fully reproducible — but it varies between runs because the
 * seed (the extraction timestamp, `repo.generatedAt`) changes, and varies between call
 * sites because the salt differs. This is how the persona can say the same thing a
 * different way each run, and pick an independent phrasing for each section, WITHOUT
 * ever touching `Math.random` (which core forbids, to keep output reproducible).
 */
export function seededIndex(seed: number, salt: string, length: number): number {
  if (length <= 1) return 0;
  // FNV-1a over the salt, seeded with the run timestamp, then a final avalanche mix so
  // consecutive seeds (runs a second apart) don't map to neighbouring indices and the
  // choices across different salts stay decorrelated.
  let h = (2166136261 ^ (Math.floor(seed) >>> 0)) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) % length;
}

/** Pick one element of `arr`, varying per run (seed) and per call site (salt). */
export function pickVariant<T>(arr: readonly T[], seed: number, salt: string): T {
  return arr[seededIndex(seed, salt, arr.length)]!;
}

/**
 * Threshold-based roast template picker. Given a numeric value and an ordered list of
 * `{ min, template }` tiers, returns the first tier's template whose threshold the value
 * meets. A tier's `template` may be a SINGLE string or an ARRAY of interchangeable
 * phrasings — when it's an array and a `seed` is supplied, one phrasing is picked per run
 * (so the same chapter is worded differently between runs). Without a `seed`, the first
 * phrasing is used, keeping behaviour deterministic. Templates may contain `{n}`
 * (replaced by `value`) and any `{key}` present in `extra`.
 */
export interface RoastTier {
  min: number;
  template: string | readonly string[];
}

export function roastByTier(
  value: number,
  tiers: RoastTier[],
  extra: Record<string, string | number> = {},
  seed?: number,
  salt = '',
): string {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const tier = sorted.find((t) => value >= t.min) ?? sorted[sorted.length - 1];
  const options = tier ? (Array.isArray(tier.template) ? tier.template : [tier.template as string]) : [''];
  let out = seed === undefined ? options[0]! : pickVariant(options, seed, `${salt}#${tier?.min ?? 0}`);
  out = out.replace(/\{n\}/g, String(value));
  for (const [k, v] of Object.entries(extra)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

/**
 * "Noise" files that dominate churn/fix rankings for boring reasons: dependency
 * lockfiles, package manifests, generated version stamps, snapshots, and translation
 * catalogs. They get touched on nearly every commit but say nothing about who suffers
 * or what's rotten — so we exclude them from "most-disturbed" rankings to keep the
 * spotlight on files a human actually fought with.
 */
const NOISE_RE = new RegExp(
  [
    // dependency lockfiles
    '(^|/)(package-lock\\.json|npm-shrinkwrap\\.json|yarn\\.lock|pnpm-lock\\.ya?ml|bun\\.lockb?|composer\\.lock|gemfile\\.lock|poetry\\.lock|cargo\\.lock|go\\.sum|packages\\.lock\\.json|podfile\\.lock|flake\\.lock)$',
    // package / dependency / build manifests, across ecosystems. These churn on
    // every version bump and dependency change but aren't a file anyone "fought" —
    // and in a monorepo there's one per package, so they'd otherwise flood the chart.
    // Anchored with (^|/) so nested manifests in sub-packages are matched too.
    '(^|/)(package\\.json|composer\\.json|requirements[^/]*\\.txt|pipfile(\\.lock)?|pyproject\\.toml|setup\\.cfg|tox\\.ini|pom\\.xml|build\\.gradle(\\.kts)?|settings\\.gradle(\\.kts)?|gemfile|cargo\\.toml|go\\.mod|pubspec\\.yaml|mix\\.exs|build\\.sbt)$',
    '(^|/)[^/]+\\.csproj$',
    // translation / locale catalogs
    '(translations?|locales?|i18n|lang|messages)[._-][^/]*\\.(json|ya?ml|po|xliff|strings|arb)$',
    '(^|/)(translations?|locales?|i18n|lang)/',
    // generated version stamps
    '(^|/)(RUNTIME_VERSION|VERSION|CHANGELOG)(\\.[a-z0-9]+)?$',
    // snapshots & other generated artifacts
    '\\.snap$',
  ].join('|'),
  'i',
);

/** True when a file is churn "noise" we don't want crowding the haunted-files charts. */
export function isNoiseFile(path: string): boolean {
  return NOISE_RE.test(path);
}

/** File extension (lowercased, no dot) or '' if none. */
export function ext(path: string): string {
  const base = path.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Final path segment, e.g. "src/pom.xml" → "pom.xml". */
export function basename(path: string): string {
  return path.split('/').pop() ?? path;
}
