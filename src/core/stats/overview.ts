/** Overview / raw-stat scoreboard. */
import type { Stat } from '../types.js';
import { byAuthor, displayName, ext, pluralize, roastByTier, sum } from './helpers.js';

const DAY = 86400;

const repoAge: Stat = {
  id: 'repo-age',
  title: 'Repo Birthday',
  category: 'overview',
  compute(repo) {
    if (repo.commits.length === 0) return null;
    const first = repo.commits[repo.commits.length - 1]!;
    const ageDays = Math.max(0, Math.floor((repo.generatedAt - first.authorDate) / DAY));
    const years = (ageDays / 365).toFixed(1);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${ageDays} days old (~${years} years), born ${new Date(first.authorDate * 1000).toISOString().slice(0, 10)}`,
      roast: roastByTier(ageDays, [
        { min: 1460, template: `{n} days old. This repo has been legally able to drive for years and still can't pass CI.` },
        { min: 730, template: `{n} days of history. Older than most startups. Fewer pivots, hopefully.` },
        { min: 180, template: `A respectable {n} days old. Past the honeymoon, into the technical debt.` },
        { min: 0, template: `Only {n} days old. Still fresh. Still innocent. Give it time.` },
      ]),
      data: { ageDays, firstCommit: first.authorDate },
    };
  },
};

const totals: Stat = {
  id: 'totals',
  title: 'The Scoreboard',
  category: 'overview',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    if (commits.length === 0) return null;
    const added = sum(commits.flatMap((c) => c.files.map((f) => f.added ?? 0)));
    const deleted = sum(commits.flatMap((c) => c.files.map((f) => f.deleted ?? 0)));
    const authors = byAuthor(commits).size;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${commits.length} commits · +${added.toLocaleString()} / -${deleted.toLocaleString()} lines · ${authors} ${pluralize(authors, 'human')}`,
      roast: roastByTier(deleted === 0 ? 0 : added / Math.max(1, deleted), [
        { min: 5, template: `${added.toLocaleString()} lines in, only ${deleted.toLocaleString()} out. A hoarder. This codebase only ever grows.` },
        { min: 1.2, template: `You wrote far more than you removed (${added.toLocaleString()} vs ${deleted.toLocaleString()}). Every line left behind is one someone else now has to maintain.` },
        { min: 0, template: `${deleted.toLocaleString()} deleted against ${added.toLocaleString()} added. Refreshingly destructive. I respect it.` },
      ]),
      data: { commits: commits.length, added, deleted, authors },
    };
  },
};

const languages: Stat = {
  id: 'languages',
  title: 'The Polyglot Report',
  category: 'overview',
  compute(repo) {
    if (repo.trackedFiles.length === 0) return null;
    const counts = new Map<string, number>();
    for (const f of repo.trackedFiles) {
      const e = ext(f);
      if (!e) continue;
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (ranked.length === 0) return null;
    const top = ranked[0]!;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: ranked.map(([e, n]) => `.${e} (${n})`).join('  '),
      roast: `Mostly \`.${top[0]}\` — ${top[1]} files. Whatever helps you sleep at night.`,
      data: { ranked },
    };
  },
};

const ghosts: Stat = {
  id: 'ghosts',
  title: 'The Ghosts',
  category: 'overview',
  compute(repo) {
    const authors = byAuthor(repo.commits.filter((c) => !c.isMerge));
    const oneHit = [...authors.values()].filter((a) => a.commits.length === 1);
    if (oneHit.length === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${oneHit.length} ${pluralize(oneHit.length, 'contributor')} committed exactly once`,
      roast: roastByTier(oneHit.length, [
        { min: 5, template: `{n} people made exactly one commit and were never seen again. A graveyard of good intentions.` },
        { min: 1, template: `{n} drive-by ${pluralize(oneHit.length, 'contributor')} — one commit each, then vanished into the night.` },
      ]),
      data: { ghosts: oneHit.map((a) => displayName(a.id)) },
    };
  },
};

export const overviewStats: Stat[] = [repoAge, totals, languages, ghosts];
