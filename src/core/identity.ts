/**
 * Pure identity de-duplication. Git records whoever the committer felt like being
 * that day, so one human shows up as several "authors": the same email under two
 * name spellings, or — the common one — a name written in a different word order
 * ("COLAS Alexandre" one week, "Alexandre Colas" the next).
 *
 * We cluster identities that are obviously the same person (shared email, OR the same
 * set of name tokens regardless of order) and collapse each cluster to a single
 * canonical Identity. Everything downstream keys off `Identity`, so applying this once
 * at extraction time merges the duplicates everywhere — leaderboards, stats, recap.
 */
import type { Commit, Identity } from './types.js';

/** Order-independent name signature: lowercased tokens, sorted, space-joined. */
function nameTokens(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
}

/** Signature distinguishing every (name, email) pair seen verbatim. */
function rawSig(id: Identity): string {
  return `${id.email.trim().toLowerCase()}\x00${id.name.trim().toLowerCase()}`;
}

export interface IdentityResolver {
  /** Map any identity to its cluster's canonical form (identity unchanged if unseen). */
  canonical(id: Identity): Identity;
}

/** Pick the heaviest key, breaking ties by "looks like a fuller name" then lexically. */
function pickName(weights: Map<string, number>): string {
  let best = '';
  let bestW = -1;
  for (const [name, w] of weights) {
    const better =
      w > bestW ||
      (w === bestW && (tokenCount(name) > tokenCount(best) || (tokenCount(name) === tokenCount(best) && name < best)));
    if (better) {
      best = name;
      bestW = w;
    }
  }
  return best;
}
const tokenCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Pick the heaviest key, breaking ties lexically (deterministic). */
function pickHeaviest(weights: Map<string, number>): string {
  let best = '';
  let bestW = -1;
  for (const [k, w] of weights) {
    if (w > bestW || (w === bestW && best !== '' && k < best)) {
      best = k;
      bestW = w;
    }
  }
  return best;
}

/**
 * Build a resolver over all identities appearing in `commits` (plus any `extra`, e.g.
 * the configured current user). Authoring weight decides which spelling wins, so the
 * canonical name is the one the person actually committed under most.
 */
export function buildIdentityResolver(commits: Commit[], extra: (Identity | null)[] = []): IdentityResolver {
  const idents: Identity[] = [];
  const sigToIndex = new Map<string, number>();
  const weight: number[] = [];
  const add = (id: Identity, w: number) => {
    const sig = rawSig(id);
    let i = sigToIndex.get(sig);
    if (i === undefined) {
      i = idents.length;
      sigToIndex.set(sig, i);
      idents.push(id);
      weight.push(0);
    }
    weight[i]! += w;
  };
  for (const c of commits) {
    add(c.author, 1);
    add(c.committer, 0);
  }
  for (const e of extra) if (e) add(e, 0);

  // Union-find: link identities that share a non-empty email or name-token-set.
  const parent = idents.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const firstByEmail = new Map<string, number>();
  const firstByName = new Map<string, number>();
  idents.forEach((id, i) => {
    const email = id.email.trim().toLowerCase();
    if (email) {
      const prev = firstByEmail.get(email);
      if (prev !== undefined) union(prev, i);
      else firstByEmail.set(email, i);
    }
    const nk = nameTokens(id.name);
    if (nk) {
      const prev = firstByName.get(nk);
      if (prev !== undefined) union(prev, i);
      else firstByName.set(nk, i);
    }
  });

  // Aggregate each cluster's name/email spellings by authoring weight.
  const nameW = new Map<number, Map<string, number>>();
  const emailW = new Map<number, Map<string, number>>();
  const bump = (m: Map<number, Map<string, number>>, root: number, key: string, w: number) => {
    let inner = m.get(root);
    if (!inner) {
      inner = new Map();
      m.set(root, inner);
    }
    inner.set(key, (inner.get(key) ?? 0) + w);
  };
  idents.forEach((id, i) => {
    const root = find(i);
    // +1 floor so committer-only/current-user spellings still register for tie-breaks.
    const w = weight[i]! + 1;
    if (id.name.trim()) bump(nameW, root, id.name, w);
    if (id.email.trim()) bump(emailW, root, id.email, w);
  });

  const canonByRoot = new Map<number, Identity>();
  for (let i = 0; i < idents.length; i++) {
    const root = find(i);
    if (canonByRoot.has(root)) continue;
    canonByRoot.set(root, {
      name: pickName(nameW.get(root) ?? new Map()),
      email: pickHeaviest(emailW.get(root) ?? new Map()),
    });
  }

  const sigToCanon = new Map<string, Identity>();
  idents.forEach((id, i) => sigToCanon.set(rawSig(id), canonByRoot.get(find(i))!));

  return {
    canonical: (id) => sigToCanon.get(rawSig(id)) ?? id,
  };
}

/** Rewrite every author/committer/current-user identity to its canonical form. */
export function canonicalizeIdentities(
  commits: Commit[],
  currentUser: Identity | null,
): { commits: Commit[]; currentUser: Identity | null } {
  const resolver = buildIdentityResolver(commits, [currentUser]);
  return {
    commits: commits.map((c) => ({
      ...c,
      author: resolver.canonical(c.author),
      committer: resolver.canonical(c.committer),
    })),
    currentUser: currentUser ? resolver.canonical(currentUser) : null,
  };
}
