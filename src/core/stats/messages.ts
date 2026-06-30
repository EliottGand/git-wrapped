/** Commit-message forensics. Your commit log is a diary you forgot was public. */
import type { Commit, Stat } from '../types.js';
import { byAuthor, displayName, maxBy, pickVariant, pluralize, roastByTier } from './helpers.js';

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
        { min: 60, template: [
          `Average ${avg.toFixed(0)} chars per subject. Verbose. Nobody reads them anyway.`,
          `Average ${avg.toFixed(0)} chars a subject. You write paragraphs where a sentence would do. The diff already said it.`,
          `${avg.toFixed(0)} chars on average. Eloquent. Exhausting. Skimmed by everyone, including future-you.`,
        ] },
        { min: 25, template: [
          `Average ${avg.toFixed(0)} chars. Functional. Forgettable. Like the commits themselves.`,
          `${avg.toFixed(0)} chars on average — just enough to say nothing memorable.`,
          `Average ${avg.toFixed(0)} chars. Workmanlike. The commit-message equivalent of beige.`,
        ] },
        { min: 0, template: [
          `Average ${avg.toFixed(0)} chars. Your commit messages have the depth of a puddle. "${shortest[0]}", really?`,
          `${avg.toFixed(0)} chars on average. "${shortest[0]}" is not a message, it's a grunt with a hash attached.`,
          `Average ${avg.toFixed(0)} chars. Shallower than a phone screen. "${shortest[0]}" — bold of you to press enter.`,
        ] },
      ], {}, repo.generatedAt, this.id),
      data: { avg, shortest },
    };
  },
};

const matchStat = (
  id: string,
  title: string,
  re: RegExp,
  tiers: { min: number; template: string | readonly string[] }[],
  noneRoast?: string | readonly string[],
): Stat => ({
  id,
  title,
  category: 'messages',
  compute(repo) {
    const commits = nonMerge(repo.commits);
    const hits = commits.filter((c) => re.test(c.subject) || re.test(c.body));
    if (hits.length === 0) {
      if (!noneRoast) return null;
      const roast = Array.isArray(noneRoast) ? pickVariant(noneRoast, repo.generatedAt, `${id}-none`) : (noneRoast as string);
      return { id, title, category: 'messages', headline: `0 matches`, roast, data: { count: 0 } };
    }
    const examples = hits.slice(0, 3).map((c) => `"${c.subject}"`);
    return {
      id,
      title,
      category: 'messages',
      headline: `${hits.length} ${pluralize(hits.length, 'commit')} matched`,
      detail: `e.g. ${examples.join(', ')}`,
      roast: roastByTier(hits.length, tiers, {}, repo.generatedAt, id),
      data: { count: hits.length, examples },
    };
  },
});

const profanity = matchStat('profanity', 'The Sailor', PROFANITY_RE, [
  { min: 10, template: [
    `{n} commit messages contained profanity. The codebase is fine. You, however, are clearly not.`,
    `{n} sweary commits. At this volume it's not frustration, it's a personality.`,
    `{n} messages with profanity. The git log reads like a man losing an argument with a compiler.`,
  ] },
  { min: 1, template: [
    `{n} sweary messages in the log. Something broke and you needed the whole world to feel it.`,
    `{n} commit${'s'} with a curse in it. The code upset you, and you made it permanent.`,
    `{n} profane commit${'s'}. A small confession, etched into the history forever.`,
  ] },
], [
  `Not a single curse word in the log. Either serene or repressed. Probably repressed.`,
  `Zero profanity in the entire history. Suspiciously composed. Nobody is this calm at 2am.`,
  `Not one swear in the log. Either a monk wrote this, or the rage is being stored somewhere worse.`,
]);

const apologizer = matchStat('apologizer', 'The Apologizer', APOLOGY_RE, [
  { min: 10, template: [
    `{n} commits read like apologies or pleas ("please work", "finally"). The git log as a prayer.`,
    `{n} apologetic commits. The history reads less like changelog, more like bargaining with a deity.`,
    `{n} commits begging the code to behave. "please work" is not a strategy, but here we are.`,
  ] },
  { min: 1, template: [
    `{n} apologetic commits. "oops" is doing a lot of heavy lifting in this history.`,
    `{n} commits that say sorry. To whom? The code? It does not forgive.`,
    `{n} commit${'s'} with an apology baked in. Regret, version-controlled.`,
  ] },
]);

const reverter = matchStat('reverter', 'The Reverter', REVERT_RE, [
  { min: 10, template: [
    `{n} reverts. Two steps forward, {n} steps back. A dance, really.`,
    `{n} reverts. The repo has trust issues now, and you gave it every one of them.`,
    `{n} reverts in the log. Shipping, panicking, un-shipping — a full cardio routine.`,
  ] },
  { min: 1, template: [
    `{n} reverts. Confidence: shaky. Direction: negotiable.`,
    `{n} revert${'s'}. You committed, then thought better of it, in front of everyone.`,
    `{n} revert${'s'}. The undo button, but with a public audit trail.`,
  ] },
]);

const typoFixer = matchStat('typo-fixer', 'The Typo Hunter', TYPO_RE, [
  { min: 10, template: [
    `{n} dedicated typo-fix commits. Spellcheck exists. It's right there. It's free.`,
    `{n} commits just to fix typos. Each one a tiny monument to "I'll proofread later".`,
    `{n} typo-fix commits. The keyboard keeps winning and you keep coming back for more.`,
  ] },
  { min: 1, template: [
    `{n} commits exist purely to fix typos. The keyboard is not your ally.`,
    `{n} typo-fix commit${'s'}. Proofreading: a service you offer only in hindsight.`,
    `{n} commit${'s'} chasing a stray letter. Noble work. Avoidable work.`,
  ] },
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
        { min: 30, template: [
          `{n} commits named things like "wip" and "stuff". Future archaeologists will weep trying to read this history.`,
          `{n} commits called "wip", "stuff", "." and friends. A history written entirely in shrugs.`,
          `{n} placeholder commits. At this point "wip" is your most-used word, and that is a diagnosis.`,
        ] },
        { min: 1, template: [
          `{n} placeholder commits. "wip" is not a message, it's a confession.`,
          `{n} low-effort commits. "stuff" describes the message, the commit, and possibly the plan.`,
          `{n} commit${'s'} that just say "wip". A shrug with a hash attached.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 100, template: [
          `${fixes.length} fix commits. Bugs created or bugs solved? The git log refuses to say. ${displayName(top.id)} leads the cleanup with ${top.commits.length}.`,
          `${fixes.length} commits with "fix" in them. A repo that spends its life patching itself. ${displayName(top.id)} alone wrote ${top.commits.length} of them.`,
          `${fixes.length} fixes. That's not maintenance, that's a lifestyle. ${displayName(top.id)} is its most devoted practitioner at ${top.commits.length}.`,
        ] },
        { min: 1, template: [
          `${fixes.length} fixes, ${displayName(top.id)} responsible for ${top.commits.length}. Heroic. Or self-inflicted. Likely both.`,
          `${fixes.length} fix commits, ${top.commits.length} of them ${displayName(top.id)}'s. Cleaning up a mess, possibly their own.`,
          `${fixes.length} fixes total. ${displayName(top.id)} owns ${top.commits.length} — firefighter, arsonist, or, realistically, both.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 20, template: [
          `{n} emoji-laden commits. 🚀 used liberally. Nothing was ever actually shipped.`,
          `{n} commits with emoji. The 🚀 count is high; the actual launch count remains zero.`,
          `{n} emoji commits. A git log that thinks it's a group chat.`,
        ] },
        { min: 1, template: [
          `{n} commits with emoji. Decorating the git log won't make the code work, but here we are.`,
          `{n} emoji commit${'s'}. ✨ Sparkles ✨ do not, it turns out, fix the build.`,
          `{n} commit${'s'} reaching for an emoji. Cute. The compiler is unmoved.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
        { min: 200, template: [
          `A {n}-word commit body. An essay. A manifesto. Nobody read past line two.`,
          `{n} words in one commit body. A novella. The reviewer skimmed to the diff and you know it.`,
          `A {n}-word commit message. Somewhere a blog post is jealous. No human finished this.`,
        ] },
        { min: 40, template: [
          `{n} words to justify one commit ("${longest.subject}"). The diff said it all already.`,
          `{n} words explaining "${longest.subject}". The code was clearer than the explanation.`,
          `{n} words of justification for one commit. Methinks the committer doth explain too much.`,
        ] },
      ], {}, repo.generatedAt, this.id),
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
