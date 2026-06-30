/** People & power dynamics. */
import type { Stat } from '../types.js';
import { byAuthor, displayName, idKey, isCurrentUser, maxBy, pct, roastByTier, sum } from './helpers.js';

const CONFIG_RE =
  /(^|\/)(package(-lock)?\.json|tsconfig.*\.json|\.eslintrc.*|\.prettierrc.*|webpack\..*|vite\.config\..*|babel\.config\..*|\.env.*|Dockerfile|docker-compose.*|\.github\/.*|.*\.ya?ml|metro\.config\..*|jest\.config\..*|.*\.config\.(js|ts|cjs|mjs))$/i;

const workhorse: Stat = {
  id: 'workhorse',
  title: 'The Workhorse',
  category: 'people',
  compute(repo) {
    const authors = byAuthor(repo.commits.filter((c) => !c.isMerge));
    if (authors.size === 0) return null;
    const top = maxBy([...authors.values()], (a) => a.commits.length)!;
    const total = sum([...authors.values()].map((a) => a.commits.length));
    const share = pct(top.commits.length, total);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${displayName(top.id)} — ${top.commits.length} commits (${share}% of everything)`,
      roast: roastByTier(share, [
        { min: 70, template: `${displayName(top.id)} authored ${share}% of all commits. This isn't a team, it's a one-person show with witnesses.` },
        { min: 40, template: `${displayName(top.id)} carries ${share}% of the commits. Everyone else is decorative.` },
        { min: 0, template: `${displayName(top.id)} leads with ${share}% of commits. A balanced team, how boring.` },
      ]),
      data: { name: displayName(top.id), commits: top.commits.length, share },
    };
  },
};

const kingdom: Stat = {
  id: 'kingdom',
  title: 'Your Kingdom',
  category: 'people',
  compute(repo) {
    if (!repo.currentUser) return null;
    const mine = repo.commits.filter((c) => !c.isMerge && isCurrentUser(c, repo));
    if (mine.length === 0) return null;
    // Tally top-level-ish directory (first two path segments) by your touches.
    const dirCounts = new Map<string, number>();
    for (const c of mine) {
      for (const f of c.files) {
        const segs = f.path.split('/');
        const dir = segs.length > 1 ? segs.slice(0, Math.min(2, segs.length - 1)).join('/') : '(root)';
        dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
      }
    }
    const top = maxBy([...dirCounts.entries()], ([, n]) => n);
    if (!top) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `You rule \`${top[0]}\` — ${top[1]} of your file-touches land there`,
      roast: `\`${top[0]}\` is your throne room. ${top[1]} touches. Nobody else dares refactor it, and frankly nobody else can read it.`,
      data: { dir: top[0], touches: top[1] },
    };
  },
};

const configWhisperer: Stat = {
  id: 'config-whisperer',
  title: 'The Config Whisperer',
  category: 'people',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    const score = new Map<string, { name: string; config: number; total: number }>();
    for (const c of commits) {
      const key = idKey(c.author);
      const entry = score.get(key) ?? { name: displayName(c.author), config: 0, total: 0 };
      entry.total += 1;
      if (c.files.some((f) => CONFIG_RE.test(f.path))) entry.config += 1;
      score.set(key, entry);
    }
    const candidates = [...score.values()].filter((s) => s.config >= 3);
    if (candidates.length === 0) return null;
    const top = maxBy(candidates, (s) => s.config)!;
    const ratio = pct(top.config, top.total);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${top.name} — ${top.config} config-touching commits (${ratio}% of theirs)`,
      roast: roastByTier(ratio, [
        { min: 50, template: `${top.name} spends ${ratio}% of their commits fiddling with config. A YAML whisperer. Possibly a YAML hostage.` },
        { min: 0, template: `${top.name} touched config in ${top.config} commits. Someone has to keep webpack happy. Better them than me.` },
      ]),
      data: { name: top.name, config: top.config, ratio },
    };
  },
};

const destroyer: Stat = {
  id: 'destroyer',
  title: 'The Destroyer',
  category: 'people',
  compute(repo) {
    const authors = byAuthor(repo.commits.filter((c) => !c.isMerge));
    if (authors.size === 0) return null;
    const scored = [...authors.values()].map((a) => ({
      name: displayName(a.id),
      deleted: sum(a.commits.flatMap((c) => c.files.map((f) => f.deleted ?? 0))),
    }));
    const top = maxBy(scored, (s) => s.deleted)!;
    if (top.deleted === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${top.name} deleted ${top.deleted.toLocaleString()} lines`,
      roast: roastByTier(top.deleted, [
        { min: 20000, template: `${top.name} deleted ${top.deleted.toLocaleString()} lines — a one-person austerity program. Efficient, ruthless, and faintly authoritarian. The others just watch it happen.` },
        { min: 0, template: `${top.name} removed ${top.deleted.toLocaleString()} lines. The only true progress is deletion. Take notes.` },
      ]),
      data: { name: top.name, deleted: top.deleted },
    };
  },
};

const selfMerger: Stat = {
  id: 'self-merger',
  title: 'The Self-Merger',
  category: 'people',
  compute(repo) {
    const merges = repo.commits.filter((c) => c.isMerge);
    if (merges.length === 0) return null;
    const counts = new Map<string, { name: string; n: number }>();
    for (const m of merges) {
      const key = idKey(m.committer);
      const entry = counts.get(key) ?? { name: displayName(m.committer), n: 0 };
      entry.n += 1;
      counts.set(key, entry);
    }
    const top = maxBy([...counts.values()], (c) => c.n)!;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${top.name} performed ${top.n} merges`,
      roast: roastByTier(top.n, [
        { min: 50, template: `${top.name} merged ${top.n} times. Peer review is, to them, a quaint suggestion from a more cautious era.` },
        { min: 1, template: `${top.name} owns ${top.n} merges. The keeper of the branches. The breaker of histories.` },
      ]),
      data: { name: top.name, merges: top.n },
    };
  },
};

export const peopleStats: Stat[] = [workhorse, kingdom, configWhisperer, destroyer, selfMerger];
