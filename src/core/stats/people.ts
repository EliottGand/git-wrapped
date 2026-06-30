/** People & power dynamics. */
import type { Stat } from '../types.js';
import { byAuthor, displayName, idKey, isCurrentUser, maxBy, pct, pickVariant, roastByTier, sum } from './helpers.js';

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
        { min: 70, template: [
          `${displayName(top.id)} authored ${share}% of all commits. This isn't a team, it's a one-person show with witnesses.`,
          `${share}% of commits are ${displayName(top.id)}'s. The "team" is a rounding error attached to one person.`,
          `${displayName(top.id)} owns ${share}% of the history. Everyone else is here for the credits.`,
        ] },
        { min: 40, template: [
          `${displayName(top.id)} carries ${share}% of the commits. Everyone else is decorative.`,
          `${share}% of commits belong to ${displayName(top.id)}. The rest of the team is set dressing.`,
          `${displayName(top.id)} hauls ${share}% of the load. The others are mostly here for moral support.`,
        ] },
        { min: 0, template: [
          `${displayName(top.id)} leads with ${share}% of commits. A balanced team, how boring.`,
          `${displayName(top.id)} edges ahead at ${share}%. Suspiciously egalitarian. Where's the drama?`,
          `Top spot: ${displayName(top.id)}, ${share}%. A flat, healthy distribution. Yawn.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
      roast: pickVariant([
        `\`${top[0]}\` is your throne room. ${top[1]} touches. Nobody else dares refactor it, and frankly nobody else can read it.`,
        `\`${top[0]}\` is yours — ${top[1]} touches. A private fiefdom. The locals have learned not to enter.`,
        `You've colonised \`${top[0]}\` with ${top[1]} touches. It's less a directory now, more a personality.`,
      ], repo.generatedAt, this.id),
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
        { min: 50, template: [
          `${top.name} spends ${ratio}% of their commits fiddling with config. A YAML whisperer. Possibly a YAML hostage.`,
          `${ratio}% of ${top.name}'s commits touch config. At this point the config touches back.`,
          `${top.name} lives in the config files — ${ratio}% of their commits. A life spent appeasing build tools.`,
        ] },
        { min: 0, template: [
          `${top.name} touched config in ${top.config} commits. Someone has to keep webpack happy. Better them than me.`,
          `${top.name} fiddled with config across ${top.config} commits. Thankless, endless, and apparently theirs.`,
          `Config duty falls to ${top.name}: ${top.config} commits of it. The team's designated YAML diplomat.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 20000, template: [
          `${top.name} deleted ${top.deleted.toLocaleString()} lines — a one-person austerity program. Efficient, ruthless, and faintly authoritarian. The others just watch it happen.`,
          `${top.name} erased ${top.deleted.toLocaleString()} lines. Not a contributor, a subtractor. The codebase flinches when they open the editor.`,
          `${top.deleted.toLocaleString()} lines, gone, courtesy of ${top.name}. A demolition crew of one, working without a permit.`,
        ] },
        { min: 0, template: [
          `${top.name} removed ${top.deleted.toLocaleString()} lines. The only true progress is deletion. Take notes.`,
          `${top.name} deleted ${top.deleted.toLocaleString()} lines. The rare hero who knows less code is the goal.`,
          `${top.deleted.toLocaleString()} lines removed by ${top.name}. Every deletion a small act of mercy.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 50, template: [
          `${top.name} merged ${top.n} times. Peer review is, to them, a quaint suggestion from a more cautious era.`,
          `${top.n} merges by ${top.name}. The branch protection is decorative; ${top.name} is the protection.`,
          `${top.name} performed ${top.n} merges. Judge, jury, and merge button, all in one confident click.`,
        ] },
        { min: 1, template: [
          `${top.name} owns ${top.n} merges. The keeper of the branches. The breaker of histories.`,
          `${top.n} merges, all ${top.name}'s. The self-appointed gatekeeper of \`main\`.`,
          `${top.name} handled ${top.n} merges. Someone has to push the button. They volunteered. Repeatedly.`,
        ] },
      ], {}, repo.generatedAt, this.id),
      data: { name: top.name, merges: top.n },
    };
  },
};

export const peopleStats: Stat[] = [workhorse, kingdom, configWhisperer, destroyer, selfMerger];
