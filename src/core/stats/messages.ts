/** Commit-message forensics. Your commit log is a diary you forgot was public. */
import type { Commit, Stat } from '../types.js';
import { byAuthor, displayName, maxBy, pluralize, roastByTier } from './helpers.js';

const nonMerge = (commits: Commit[]) => commits.filter((c) => !c.isMerge);

const FIX_RE = /^fix(\(.+\))?!?:/i;
const LOOSE_FIX_RE = /\bfix(e[ds])?\b|\bhotfix\b|\bbugfix\b/i;
// Low-effort commits: a "wip/tmp" prefix, OR the entire subject is one lazy word.
const WIP_RE = /^(wip|tmp|temp)\b|^(wip|tmp|temp|stuff|things|misc|asdf|qwerty?|\.+|update|changes|minor|cleanup|fixes?|nit|nits)\s*$/i;
const PROFANITY_RE = /\b(fuck|fucking|shit|crap|wtf|damn|ugh|argh|fml|christ)\b/i;
const APOLOGY_RE = /\b(oops|sorry|my bad|whoops|oof|nvm|never ?mind|please work|finally)\b/i;
const REVERT_RE = /^revert\b|\brevert(ed|ing)?\b/i;
const TYPO_RE = /\btypos?\b/i;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

const shortMessages: Stat = {
  id: 'short-messages',
  title: 'The Minimalist Poet',
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    if (commits.length === 0) return null;
    const avg = commits.reduce((a, c) => a + c.subject.length, 0) / commits.length;
    const shortest = [...commits]
      .sort((a, b) => a.subject.length - b.subject.length)
      .slice(0, 4)
      .map((c) => `"${c.subject}"`);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `Average subject length: ${avg.toFixed(0)} chars`,
      detail: `Shortest masterpieces: ${shortest.join(', ')}`,
      roast: roastByTier(Math.round(avg), [
        { min: 60, template: `Average ${avg.toFixed(0)} chars per subject. Verbose. Nobody reads them anyway.` },
        { min: 25, template: `Average ${avg.toFixed(0)} chars. Functional. Forgettable. Like the commits themselves.` },
        { min: 0, template: `Average ${avg.toFixed(0)} chars. Your commit messages have the depth of a puddle. "${shortest[0]}", really?` },
      ]),
      data: { avg, shortest },
    };
  },
};

const matchStat = (
  id: string,
  title: string,
  re: RegExp,
  tiers: { min: number; template: string }[],
  noneRoast?: string,
): Stat => ({
  id,
  title,
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    const hits = commits.filter((c) => re.test(c.subject) || re.test(c.body));
    if (hits.length === 0) {
      if (!noneRoast) return null;
      return { id, title, category: 'messages', headline: `0 matches`, roast: noneRoast, data: { count: 0 } };
    }
    const examples = hits.slice(0, 3).map((c) => `"${c.subject}"`);
    return {
      id,
      title,
      category: 'messages',
      headline: `${hits.length} ${pluralize(hits.length, 'commit')} matched`,
      detail: `e.g. ${examples.join(', ')}`,
      roast: roastByTier(hits.length, tiers),
      data: { count: hits.length, examples },
    };
  },
});

const profanity = matchStat('profanity', 'The Sailor', PROFANITY_RE, [
  { min: 10, template: `{n} commit messages contained profanity. The codebase is fine. You, however, are clearly not.` },
  { min: 1, template: `{n} sweary messages in the log. Something broke and you needed the whole world to feel it.` },
], `Not a single curse word in the log. Either serene or repressed. Probably repressed.`);

const apologizer = matchStat('apologizer', 'The Apologizer', APOLOGY_RE, [
  { min: 10, template: `{n} commits read like apologies or pleas ("please work", "finally"). The git log as a prayer.` },
  { min: 1, template: `{n} apologetic commits. "oops" is doing a lot of heavy lifting in this history.` },
]);

const reverter = matchStat('reverter', 'The Reverter', REVERT_RE, [
  { min: 10, template: `{n} reverts. Two steps forward, {n} steps back. A dance, really.` },
  { min: 1, template: `{n} reverts. Confidence: shaky. Direction: negotiable.` },
]);

const typoFixer = matchStat('typo-fixer', 'The Typo Hunter', TYPO_RE, [
  { min: 10, template: `{n} dedicated typo-fix commits. Spellcheck exists. It's right there. It's free.` },
  { min: 1, template: `{n} commits exist purely to fix typos. The keyboard is not your ally.` },
]);

const wipKing: Stat = {
  id: 'wip-king',
  title: 'The WIP King',
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    const hits = commits.filter((c) => WIP_RE.test(c.subject.trim()));
    if (hits.length === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${hits.length} low-effort commits ("wip", "stuff", ".", "update"...)`,
      detail: `e.g. ${hits.slice(0, 3).map((c) => `"${c.subject}"`).join(', ')}`,
      roast: roastByTier(hits.length, [
        { min: 30, template: `{n} commits named things like "wip" and "stuff". Future archaeologists will weep trying to read this history.` },
        { min: 1, template: `{n} placeholder ${'commits'}. "wip" is not a message, it's a confession.` },
      ]),
      data: { count: hits.length },
    };
  },
};

const fixIt: Stat = {
  id: 'fix-it',
  title: 'Mr. Fix-It',
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    const conventional = commits.filter((c) => FIX_RE.test(c.subject));
    const usingConventional = conventional.length >= 3;
    const fixes = usingConventional ? conventional : commits.filter((c) => LOOSE_FIX_RE.test(c.subject));
    if (fixes.length === 0) return null;
    const authors = byAuthor(fixes);
    const top = maxBy([...authors.values()], (a) => a.commits.length)!;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${fixes.length} fix commits${usingConventional ? ' (conventional)' : ''} · top fixer: ${displayName(top.id)} (${top.commits.length})`,
      roast: roastByTier(fixes.length, [
        { min: 100, template: `${fixes.length} fix commits. Bugs created or bugs solved? The git log refuses to say. ${displayName(top.id)} leads the cleanup with ${top.commits.length}.` },
        { min: 1, template: `${fixes.length} fixes, ${displayName(top.id)} responsible for ${top.commits.length}. Heroic. Or self-inflicted. Likely both.` },
      ]),
      data: { fixes: fixes.length, topFixer: displayName(top.id), conventional: usingConventional },
    };
  },
};

const emojiEnthusiast: Stat = {
  id: 'emoji-enthusiast',
  title: 'The Emoji Enthusiast',
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    const hits = commits.filter((c) => EMOJI_RE.test(c.subject));
    if (hits.length === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${hits.length} commit subjects contain emoji`,
      roast: roastByTier(hits.length, [
        { min: 20, template: `{n} emoji-laden commits. 🚀 used liberally. Nothing was ever actually shipped.` },
        { min: 1, template: `{n} ${'commits'} with emoji. Decorating the git log won't make the code work, but here we are.` },
      ]),
      data: { count: hits.length },
    };
  },
};

const monologue: Stat = {
  id: 'monologue',
  title: 'The Monologue',
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits).filter((c) => c.body.length > 0);
    if (commits.length === 0) return null;
    const longest = maxBy(commits, (c) => c.body.length)!;
    const words = longest.body.split(/\s+/).length;
    if (words < 40) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `Longest commit body: ${words} words`,
      detail: `Subject: "${longest.subject}"`,
      roast: roastByTier(words, [
        { min: 200, template: `A {n}-word commit body. An essay. A manifesto. Nobody read past line two.` },
        { min: 40, template: `{n} words to justify one commit ("${longest.subject}"). The diff said it all already.` },
      ]),
      data: { words, subject: longest.subject },
    };
  },
};

export const messageStats: Stat[] = [
  shortMessages,
  fixIt,
  wipKing,
  profanity,
  apologizer,
  reverter,
  typoFixer,
  emojiEnthusiast,
  monologue,
];
