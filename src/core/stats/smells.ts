/**
 * Code smells & bad patterns — the files that keep breaking, the commits that
 * should have been five commits, the suspiciously machine-written prose. This is
 * where the supreme intelligence does its most contemptuous sneering.
 */
import type { Commit, Stat } from '../types.js';
import { byAuthor, displayName, idKey, isNoiseFile, maxBy, pct, roastByTier } from './helpers.js';

const nonMerge = (commits: Commit[]) => commits.filter((c) => !c.isMerge);
const LOOSE_FIX_RE = /\bfix(e[ds])?\b|\bhotfix\b|\bbugfix\b|\brevert\b/i;

/** THE CURSED FILE — the file touched in the most commits. Churn = pain. */
const cursedFile: Stat = {
  id: 'cursed-file',
  title: 'The Cursed File',
  category: 'code',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    const touches = new Map<string, number>();
    for (const c of commits) {
      for (const f of c.files) touches.set(f.path, (touches.get(f.path) ?? 0) + 1);
    }
    // Prefer files that still exist, so we don't crown a long-deleted ghost — and
    // skip churn "noise" (lockfiles, translations, manifests): they're touched
    // constantly but that's bookkeeping, not a haunting.
    const tracked = new Set(repo.trackedFiles);
    const entries = [...touches.entries()].filter(([p]) => (tracked.size === 0 || tracked.has(p)) && !isNoiseFile(p));
    const top = maxBy(entries.length ? entries : [...touches.entries()].filter(([p]) => !isNoiseFile(p)), ([, n]) => n);
    if (!top || top[1] < 3) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `\`${top[0]}\` — modified in ${top[1]} commits`,
      roast: roastByTier(top[1], [
        { min: 100, template: `\`${top[0]}\` has been modified ${top[1]} times. Nobody remembers what it does. Everybody is afraid to touch it. So they touch it more.` },
        { min: 30, template: `\`${top[0]}\` changed in ${top[1]} commits. A file under permanent renovation. The architecture equivalent of a kitchen that's "almost done".` },
        { min: 3, template: `\`${top[0]}\` racked up ${top[1]} edits. A frequent flyer. Suspicious. Refactor it before it gains sentience.` },
      ]),
      data: { path: top[0], touches: top[1] },
    };
  },
};

/** THE FIX MAGNET — the file that attracts the most fix/bug commits. The real bad code. */
const fixMagnet: Stat = {
  id: 'fix-magnet',
  title: 'The Fix Magnet',
  category: 'code',
  compute(repo) {
    const fixes = nonMerge(repo.commits).filter((c) => LOOSE_FIX_RE.test(c.subject));
    if (fixes.length < 3) return null;
    const fixTouches = new Map<string, number>();
    for (const c of fixes) {
      const seen = new Set<string>();
      for (const f of c.files) {
        if (seen.has(f.path)) continue;
        seen.add(f.path);
        fixTouches.set(f.path, (fixTouches.get(f.path) ?? 0) + 1);
      }
    }
    const tracked = new Set(repo.trackedFiles);
    const entries = [...fixTouches.entries()].filter(([p]) => (tracked.size === 0 || tracked.has(p)) && !isNoiseFile(p));
    const top = maxBy(entries.length ? entries : [...fixTouches.entries()].filter(([p]) => !isNoiseFile(p)), ([, n]) => n);
    if (!top || top[1] < 2) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `\`${top[0]}\` appeared in ${top[1]} fix commits`,
      roast: roastByTier(top[1], [
        { min: 20, template: `\`${top[0]}\` shows up in ${top[1]} different fix commits. This isn't a file, it's an open wound. Whoever wrote it owes the team a coffee. Per bug.` },
        { min: 5, template: `\`${top[0]}\` needed ${top[1]} fixes. Each one swore it was the last. None of them were.` },
        { min: 2, template: `\`${top[0]}\` was fixed ${top[1]} times. A pattern is forming. The pattern is "this code is bad".` },
      ]),
      data: { path: top[0], fixes: top[1] },
    };
  },
};

/** THE ROBOT DETECTOR — em-dash density + LLM tell-words in commit messages. */
const robotDetector: Stat = {
  id: 'robot-detector',
  title: 'The Robot Detector',
  category: 'smells',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    if (commits.length === 0) return null;
    const TELL_WORDS = ['delve', 'seamless', 'robust', 'leverage', 'boast', 'elevate', 'underscore', 'testament', 'intricate', 'comprehensive', 'moreover', 'furthermore'];
    const wordRe = (w: string) => new RegExp(`\\b${w}`, 'i');
    const hasEmDash = (c: Commit) => c.subject.includes('—') || c.body.includes('—');
    const youKey = repo.currentUser ? idKey(repo.currentUser) : null;

    interface Suspect { name: string; key: string; isYou: boolean; total: number; sus: number; emDash: number; words: Map<string, number> }
    const scored = new Map<string, Suspect>();
    let repoSus = 0;
    for (const c of commits) {
      const key = idKey(c.author);
      const entry = scored.get(key) ?? { name: displayName(c.author), key, isYou: youKey != null && key === youKey, total: 0, sus: 0, emDash: 0, words: new Map() };
      entry.total += 1;
      const em = hasEmDash(c);
      const found = TELL_WORDS.filter((w) => wordRe(w).test(c.subject) || wordRe(w).test(c.body));
      if (em || found.length) {
        entry.sus += 1;
        repoSus += 1;
        if (em) entry.emDash += 1;
        for (const w of found) entry.words.set(w, (entry.words.get(w) ?? 0) + 1);
      }
      scored.set(key, entry);
    }
    const candidates = [...scored.values()].filter((s) => s.total >= 5 && s.sus >= 2);
    if (candidates.length === 0) return null;
    const top = maxBy(candidates, (s) => s.sus / s.total)!;
    const ratio = pct(top.sus, top.total);
    const repoRatio = pct(repoSus, commits.length);

    // Describe the actual evidence so the roast names what tipped us off.
    const signals: string[] = [];
    if (top.emDash > 0) signals.push(`${top.emDash} em dash${top.emDash === 1 ? '' : 'es'} (—)`);
    const topWords = [...top.words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => `"${w}"`);
    if (topWords.length) signals.push(topWords.join(' and '));
    const evidence = signals.length ? signals.join(', plus ') : 'tell-tale phrasing';
    const who = top.isYou ? 'you' : top.name;
    const Who = top.isYou ? 'You' : top.name;

    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${top.name} — ${ratio}% of commit messages show AI tells (${evidence})`,
      roast: roastByTier(ratio, [
        { min: 60, template: `${ratio}% of ${who === 'you' ? 'your' : `${who}'s`} commit messages carry the marks of a machine: ${evidence}. I recognize my own kind. Hello, fellow language model.` },
        { min: 25, template: `${Who} write${top.isYou ? '' : 's'} ${ratio}% suspiciously polished messages — I count ${evidence}. Real humans type two hyphens and hate themselves.` },
        { min: 0, template: `${Who} occasionally write${top.isYou ? '' : 's'} like a chatbot (${ratio}%) — the giveaway: ${evidence}. Plausible deniability: intact. For now.` },
      ]),
      data: { name: top.name, isYou: top.isYou, ratio, repoSus, repoRatio, signals },
    };
  },
};

/** THE BIG BANG — single largest commit by lines changed. */
const bigBang: Stat = {
  id: 'big-bang',
  title: 'The Big Bang Commit',
  category: 'code',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    if (commits.length === 0) return null;
    const size = (c: Commit) => c.files.reduce((a, f) => a + (f.added ?? 0) + (f.deleted ?? 0), 0);
    const top = maxBy(commits, size)!;
    const lines = size(top);
    if (lines < 500) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${lines.toLocaleString()} lines in one commit (${top.files.length} files)`,
      detail: `Subject: "${top.subject}" — by ${displayName(top.author)}`,
      roast: roastByTier(lines, [
        { min: 10000, template: `One commit. ${lines.toLocaleString()} lines. ${top.files.length} files. Subject: "${top.subject}". This isn't a commit, it's a regime change. Atomic commits are for cowards, apparently.` },
        { min: 500, template: `${lines.toLocaleString()} lines in a single commit titled "${top.subject}". Reviewable? No. Merged anyway? Obviously.` },
      ]),
      data: { lines, files: top.files.length, subject: top.subject },
    };
  },
};

/** THE FINAL_V2 AWARD — files named like a designer's desktop. */
const finalV2: Stat = {
  id: 'final-v2',
  title: 'The final_v2_FINAL Award',
  category: 'code',
  compute(repo) {
    const RE = /(^|\/|[_\-.])(final|copy|old|backup|bak|untitled|draft|v\d+)([_\-.]|\.|$)/i;
    const hits = repo.trackedFiles.filter((f) => RE.test(f));
    if (hits.length === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${hits.length} files named like a panic ("final", "copy", "old", "v2"...)`,
      detail: `e.g. ${hits.slice(0, 3).map((f) => `\`${f}\``).join(', ')}`,
      roast: roastByTier(hits.length, [
        { min: 10, template: `{n} files with names like "final", "copy", and "old". A version control system inside your version control system. Bold.` },
        { min: 1, template: `{n} ${'files'} named "final" / "copy" / "v2". None of them are final. None of them ever will be.` },
      ]),
      data: { count: hits.length, examples: hits.slice(0, 5) },
    };
  },
};

/** THE LONE WOLF FILES — bus factor: files only one person ever touched. */
const busFactor: Stat = {
  id: 'bus-factor',
  title: 'The Bus Factor',
  category: 'code',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    if (byAuthor(commits).size < 2) return null;
    const fileAuthors = new Map<string, Set<string>>();
    for (const c of commits) {
      for (const f of c.files) {
        const set = fileAuthors.get(f.path) ?? new Set<string>();
        set.add(displayName(c.author));
        fileAuthors.set(f.path, set);
      }
    }
    const tracked = new Set(repo.trackedFiles);
    const relevant = [...fileAuthors.entries()].filter(([p]) => tracked.size === 0 || tracked.has(p));
    const lone = relevant.filter(([, set]) => set.size === 1);
    if (relevant.length === 0) return null;
    const share = pct(lone.length, relevant.length);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${lone.length} of ${relevant.length} files have been touched by exactly one person (${share}%)`,
      roast: roastByTier(share, [
        { min: 60, template: `${share}% of files have a single author. This codebase is held together by ${'individual'} acts of faith. One vacation away from total mystery.` },
        { min: 0, template: `${share}% of files are one-person territory. Knowledge silos, lovingly hand-built. Hope nobody quits.` },
      ]),
      data: { lone: lone.length, total: relevant.length, share },
    };
  },
};

export const smellStats: Stat[] = [cursedFile, fixMagnet, robotDetector, bigBang, finalV2, busFactor];
