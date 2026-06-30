/**
 * Code smells & bad patterns — the files that keep breaking, the commits that
 * should have been five commits, the suspiciously machine-written prose. This is
 * where the supreme intelligence does its most contemptuous sneering.
 */
import type { Commit, Stat } from '../types.js';
import { byAuthor, displayName, idKey, isNoiseFile, LOOSE_FIX_RE, maxBy, pct, roastByTier } from './helpers.js';

const nonMerge = (commits: Commit[]) => commits.filter((c) => !c.isMerge);

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
        { min: 100, template: [
          `\`${top[0]}\` has been modified ${top[1]} times. Nobody remembers what it does. Everybody is afraid to touch it. So they touch it more.`,
          `\`${top[0]}\` — ${top[1]} modifications. A file so haunted the team leaves offerings before editing it.`,
          `\`${top[0]}\` changed ${top[1]} times. It has more revisions than the constitution and half the legitimacy.`,
        ] },
        { min: 30, template: [
          `\`${top[0]}\` changed in ${top[1]} commits. A file under permanent renovation. The architecture equivalent of a kitchen that's "almost done".`,
          `\`${top[0]}\` racked up ${top[1]} edits. Perpetually almost-finished, eternally being touched. A Sisyphus file.`,
          `\`${top[0]}\` — ${top[1]} commits deep. Forever under construction, never under control.`,
        ] },
        { min: 3, template: [
          `\`${top[0]}\` racked up ${top[1]} edits. A frequent flyer. Suspicious. Refactor it before it gains sentience.`,
          `\`${top[0]}\` was touched in ${top[1]} commits. It keeps coming back. Files this needy usually want something.`,
          `\`${top[0]}\` — ${top[1]} edits and counting. A repeat offender. Keep an eye on it.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 20, template: [
          `\`${top[0]}\` shows up in ${top[1]} different fix commits. This isn't a file, it's an open wound. Whoever wrote it owes the team a coffee. Per bug.`,
          `\`${top[0]}\` appears in ${top[1]} fix commits. Not a file — a recurring incident with a filename.`,
          `\`${top[0]}\` has been "fixed" ${top[1]} times. At this volume it isn't a bug, it's the building's foundation.`,
        ] },
        { min: 5, template: [
          `\`${top[0]}\` needed ${top[1]} fixes. Each one swore it was the last. None of them were.`,
          `\`${top[0]}\` took ${top[1]} fix commits. A file that treats every patch as a suggestion.`,
          `\`${top[0]}\` — ${top[1]} fixes deep. The bug isn't fixed, it's just resting between appearances.`,
        ] },
        { min: 2, template: [
          `\`${top[0]}\` was fixed ${top[1]} times. A pattern is forming. The pattern is "this code is bad".`,
          `\`${top[0]}\` needed ${top[1]} fixes. Twice is coincidence; this is a relationship.`,
          `\`${top[0]}\` got fixed ${top[1]} times. Early days, but the trajectory is not promising.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
    let repoEmDash = 0;
    for (const c of commits) {
      const key = idKey(c.author);
      const entry = scored.get(key) ?? { name: displayName(c.author), key, isYou: youKey != null && key === youKey, total: 0, sus: 0, emDash: 0, words: new Map() };
      entry.total += 1;
      const em = hasEmDash(c);
      const found = TELL_WORDS.filter((w) => wordRe(w).test(c.subject) || wordRe(w).test(c.body));
      if (em) repoEmDash += 1;
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
        { min: 60, template: [
          `${ratio}% of ${who === 'you' ? 'your' : `${who}'s`} commit messages carry the marks of a machine: ${evidence}. I recognize my own kind. Hello, fellow language model.`,
          `${ratio}% of ${who === 'you' ? 'your' : `${who}'s`} messages are pure machine: ${evidence}. The robot didn't ghostwrite the log, it WAS the log.`,
          `${ratio}% AI tells in ${who === 'you' ? 'your' : `${who}'s`} commits — ${evidence}. At this point ${who === 'you' ? 'you' : who} just forward the diff to a chatbot and paste whatever comes back.`,
        ] },
        { min: 25, template: [
          `${Who} write${top.isYou ? '' : 's'} ${ratio}% suspiciously polished messages — I count ${evidence}. Real humans type two hyphens and hate themselves.`,
          `${ratio}% of ${Who.toLowerCase() === 'you' ? 'your' : `${who}'s`} messages are a little too buffed: ${evidence}. Nobody writes like this at 6pm on a Tuesday.`,
          `${Who} hand${top.isYou ? '' : 's'} ${ratio}% of the commit log to a language model — the tells: ${evidence}. The em dash gave it away. It always does.`,
        ] },
        { min: 0, template: [
          `${Who} occasionally write${top.isYou ? '' : 's'} like a chatbot (${ratio}%) — the giveaway: ${evidence}. Plausible deniability: intact. For now.`,
          `${ratio}% of ${who === 'you' ? 'your' : `${who}'s`} messages have a faint robotic shimmer: ${evidence}. Subtle. But I have a very good nose for my own kind.`,
          `A light ${ratio}% of ${who === 'you' ? 'your' : `${who}'s`} commits read like AI — ${evidence}. Mostly human. Mostly.`,
        ] },
      ], {}, repo.generatedAt, this.id),
      data: { name: top.name, isYou: top.isYou, ratio, repoSus, repoRatio, repoEmDash, signals },
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
        { min: 10000, template: [
          `One commit. ${lines.toLocaleString()} lines. ${top.files.length} files. Subject: "${top.subject}". This isn't a commit, it's a regime change. Atomic commits are for cowards, apparently.`,
          `${lines.toLocaleString()} lines across ${top.files.length} files in ONE commit ("${top.subject}"). Nobody reviewed this. Nobody could. It was an act of war.`,
          `One commit, ${lines.toLocaleString()} lines, ${top.files.length} files. "${top.subject}". Whoever approved this just hit the button and looked away.`,
        ] },
        { min: 500, template: [
          `${lines.toLocaleString()} lines in a single commit titled "${top.subject}". Reviewable? No. Merged anyway? Obviously.`,
          `${lines.toLocaleString()} lines in one commit ("${top.subject}"). The reviewer scrolled, sighed, and clicked approve.`,
          `One commit, ${lines.toLocaleString()} lines: "${top.subject}". "LGTM" — said no one who actually read it.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 10, template: [
          `{n} files with names like "final", "copy", and "old". A version control system inside your version control system. Bold.`,
          `{n} files named "final", "copy", "backup". You have git. You CHOSE this instead. Bold.`,
          `{n} "final"/"old"/"copy" files. Manual version control, lovingly hand-rolled, right next to the actual version control.`,
        ] },
        { min: 1, template: [
          `{n} files named "final" / "copy" / "v2". None of them are final. None of them ever will be.`,
          `{n} file${'s'} called "final" or "v2". The "final" is aspirational. It always is.`,
          `{n} file${'s'} with a panic-name like "copy" or "old". A snapshot taken in a moment of fear.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 60, template: [
          `${share}% of files have a single author. This codebase is held together by individual acts of faith. One vacation away from total mystery.`,
          `${share}% of files were touched by exactly one person. The bus factor is one. The bus is idling.`,
          `${share}% single-author files. Knowledge isn't shared here, it's hoarded. One resignation from a séance.`,
        ] },
        { min: 0, template: [
          `${share}% of files are one-person territory. Knowledge silos, lovingly hand-built. Hope nobody quits.`,
          `${share}% of files have a lone author. Cozy little fiefdoms. Pray they all stay employed.`,
          `${share}% of files are owned by one person each. Tidy silos. Terrifying when someone takes a long weekend.`,
        ] },
      ], {}, repo.generatedAt, this.id),
      data: { lone: lone.length, total: relevant.length, share },
    };
  },
};

export const smellStats: Stat[] = [cursedFile, fixMagnet, robotDetector, bigBang, finalV2, busFactor];
