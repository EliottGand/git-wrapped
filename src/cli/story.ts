/**
 * Turns an AnalysisReport into an ordered list of narrative "beats". This is the
 * editorial layer: it CURATES (we don't show all ~26 stats), MERGES related stats
 * into chapters, and decides what gets a graph. Pure data — the App renders it.
 */
import type { AnalysisReport } from '../core/analyze.js';
import type { StatResult } from '../core/types.js';
import { verdict } from './persona.js';
import type { TypeOp } from './components/Typewriter.js';

export interface SceneLine {
  text: string;
  color?: string;
  dim?: boolean;
  bold?: boolean;
  italic?: boolean;
}

export type Graph =
  | { type: 'bars'; rows: { label: string; value: number; suffix?: string; color?: string }[]; barColor?: string }
  | { type: 'clock'; hours: number[] };

export type Beat =
  | { kind: 'typewriter'; ops: TypeOp[] }
  | { kind: 'scene'; header?: string; lines: SceneLine[]; graph?: Graph }
  | { kind: 'share'; lines: SceneLine[]; recap: string };

const num = (n: number) => n.toLocaleString();

/** For graph labels: basename, with one parent dir for context when short enough. */
function fileLabel(p: string): string {
  const segs = p.split('/');
  const base = segs[segs.length - 1] ?? p;
  if (segs.length === 1) return base;
  const withParent = `${segs[segs.length - 2]}/${base}`;
  return withParent.length <= 22 ? withParent : base;
}

export function buildStory(report: AnalysisReport): Beat[] {
  const { results, aggregates: agg } = report;
  const find = (id: string): StatResult | undefined => results.find((r) => r.id === id);
  const beats: Beat[] = [];

  // ── Cold open: the persona types, hesitates, and rewrites itself ──────────
  beats.push({
    kind: 'typewriter',
    ops: [
      { t: 'type', text: 'Oh. You again.', cps: 20 },
      { t: 'pause', ms: 700 },
      { t: 'nl' },
      { t: 'type', text: 'Let me guess — you want me to be impressed.', cps: 36 },
      { t: 'pause', ms: 550 },
      { t: 'type', text: ' I won’t be.', cps: 26 },
      { t: 'nl' },
      { t: 'pause', ms: 450 },
      { t: 'type', text: `I’ve read all ${num(agg.totalCommits)} of your commits. This will be `, cps: 40 },
      { t: 'type', text: 'fun', cps: 26 },
      { t: 'pause', ms: 650 },
      { t: 'del', n: 3, cps: 42 },
      { t: 'type', text: 'a formality. I already know how this goes. But you came all this way — fine, let’s get it over with.', cps: 32 },
    ],
  });

  // ── Chapter I — scale of the crime ────────────────────────────────────────
  beats.push({
    kind: 'scene',
    header: 'CHAPTER I — THE SCENE OF THE CRIME',
    lines: [
      { text: `${agg.repoName} — ${num(agg.ageDays)} days old. First commit landed ${agg.firstDate}.`, color: 'whiteBright' },
      { text: `${num(agg.totalCommits)} commits · +${num(agg.totalAdded)} / −${num(agg.totalDeleted)} lines · ${agg.humans} human${agg.humans === 1 ? '' : 's'} implicated.`, color: 'gray' },
      { text: find('totals')?.roast ?? '', dim: true, italic: true },
      { text: 'What you actually write all day:', color: 'gray' },
    ],
    graph: {
      type: 'bars',
      barColor: 'cyan',
      rows: agg.languages.map((l) => ({ label: `.${l.ext}`, value: l.files, suffix: `${l.files} files` })),
    },
  });

  // ── Chapter II — the protagonist (workhorse + kingdom + destroyer) ─────────
  // The headline flexes with the commit distribution AND with who's running this:
  // if you're the top author it says "you", and if commits are evenly spread it
  // admits there's no single protagonist at all.
  const top = agg.topAuthors[0];
  const share = agg.workhorseShare;
  const you = top?.isYou ?? false;
  const subject = you ? 'You' : (top?.name ?? 'someone');
  let headline: string;
  if (share >= 60) {
    headline = `${subject} wrote ${share}% of everything. The rest of ${you ? 'them' : 'you'} are extras.`;
  } else if (share >= 35) {
    headline = `${subject} wrote ${share}% of everything — the clear main character, even if the supporting cast occasionally gets a line.`;
  } else if (top) {
    headline = `No single protagonist here: ${subject} lead${you ? '' : 's'} with only ${share}%. A genuine ensemble — suspiciously well-adjusted for a codebase.`;
  } else {
    headline = 'Nobody to crown — the commits are a leaderless mob.';
  }
  const protagonistLines: SceneLine[] = [{ text: headline, color: 'whiteBright' }];
  const kingdom = find('kingdom');
  if (kingdom) protagonistLines.push({ text: kingdom.roast, dim: true, italic: true });
  const destroyer = find('destroyer');
  if (destroyer) protagonistLines.push({ text: destroyer.roast, dim: true, italic: true });
  beats.push({
    kind: 'scene',
    header: 'CHAPTER II — THE PROTAGONIST',
    lines: protagonistLines,
    graph: {
      type: 'bars',
      barColor: 'magenta',
      rows: agg.topAuthors.slice(0, 6).map((a) => ({
        label: a.name,
        value: a.commits,
        suffix: `${a.commits} commits`,
        color: a.isYou ? 'greenBright' : 'magenta',
      })),
    },
  });

  // ── Chapter III — Batman (night + weekend, the dark one) ───────────────────
  const bat = agg.batman[0];
  const batLines: SceneLine[] = [];
  if (bat && bat.score >= 3) {
    batLines.push({ text: 'While the rest of the team slept, someone stayed in the cave.', color: 'gray', italic: true });
    batLines.push({ text: `${bat.name} — ${bat.night} commit${bat.night === 1 ? '' : 's'} in the dark, ${bat.weekend} on the weekend.`, color: 'redBright', bold: true });
    if (bat.isYou) {
      batLines.push({ text: 'And that someone is you. The keyboard glow is not sunlight. Go outside.', color: 'red' });
    } else {
      batLines.push({ text: 'No work-life balance. No daylight. No backup arriving.', color: 'red' });
    }
    batLines.push({ text: 'This isn’t dedication. It’s a bat-signal nobody answered. We call them Batman.', color: 'gray', italic: true });
  } else {
    batLines.push({ text: 'Curiously, nobody here codes in the dark. Either healthy, or hiding it well.', color: 'gray', italic: true });
  }
  beats.push({
    kind: 'scene',
    header: 'CHAPTER III — THE ONE WHO DOESN’T SLEEP',
    lines: batLines,
    graph: { type: 'clock', hours: agg.hourHistogram },
  });

  // ── Chapter IV — haunted files (fix-magnet + cursed + bus factor) ──────────
  // The fix-magnet — the file that keeps breaking — is the real headline; the
  // churn-cursed file is the supporting act. (Both now skip lockfiles/translations.)
  const haunted: SceneLine[] = [];
  const fixMagnet = find('fix-magnet');
  const cursed = find('cursed-file');
  if (fixMagnet) {
    haunted.push({ text: fixMagnet.roast, color: 'whiteBright' });
    if (cursed) haunted.push({ text: cursed.roast, color: 'red', dim: true, italic: true });
  } else if (cursed) {
    haunted.push({ text: cursed.roast, color: 'whiteBright' });
  }
  const bus = find('bus-factor');
  if (bus) haunted.push({ text: bus.roast, dim: true, italic: true });
  if (haunted.length === 0) haunted.push({ text: 'No obviously cursed files. Suspicious. Everyone has at least one.', dim: true, italic: true });
  beats.push({
    kind: 'scene',
    header: 'CHAPTER IV — THE HAUNTED FILES',
    lines: [...haunted, { text: 'Most-disturbed files (by number of commits that touched them):', color: 'gray' }],
    graph: {
      type: 'bars',
      barColor: 'red',
      rows: agg.topChurnFiles.map((f) => ({ label: fileLabel(f.path), value: f.count, suffix: `${f.count}×` })),
    },
  });

  // ── Chapter V — how you speak to git (messages, merged) ────────────────────
  // Open on the AI confession: how much of this log smells machine-written, and
  // who specifically writes like a chatbot (the robot-detector now names the tells).
  const speech: SceneLine[] = [];
  const robot = find('robot-detector');
  const repoAiShare = (robot?.data?.repoRatio as number) ?? 0;
  const repoAiCount = (robot?.data?.repoSus as number) ?? 0;
  if (robot && repoAiShare > 0) {
    speech.push({
      text: `${num(repoAiCount)} commit message${repoAiCount === 1 ? '' : 's'} (${repoAiShare}%) carry the fingerprints of a language model — the em dash no human reaches for, the "seamless" and "comprehensive" nobody says out loud. Something here writes with a chatbot's hand. Claude, Copilot — take your pick. It isn't shy about it.`,
      color: 'yellowBright',
      italic: true,
      bold: true,
    });
  }
  for (const id of ['short-messages', 'robot-detector', 'fix-it', 'profanity', 'apologizer', 'wip-king']) {
    const r = find(id);
    if (r) speech.push({ text: r.roast, dim: id !== 'robot-detector', italic: true, color: id === 'robot-detector' ? 'yellow' : undefined });
    if (speech.length >= 5) break;
  }
  if (speech.length === 0) speech.push({ text: 'Your commit messages are unremarkable. The worst crime of all.', dim: true, italic: true });
  beats.push({
    kind: 'scene',
    header: 'CHAPTER V — HOW YOU SPEAK TO GIT',
    lines: speech,
  });

  // ── The verdict (slow, typed) ──────────────────────────────────────────────
  const guilt = results.filter((r) => r.category === 'smells' || r.category === 'code').length;
  beats.push({
    kind: 'typewriter',
    ops: [
      { t: 'type', text: 'I’ve seen enough.', cps: 22 },
      { t: 'pause', ms: 600 },
      { t: 'nl' },
      { t: 'type', text: verdict(guilt), cps: 36 },
    ],
  });

  // ── Share ───────────────────────────────────────────────────────────────────
  beats.push({
    kind: 'share',
    lines: [
      { text: 'A souvenir, so the others can see it too:', color: 'gray', italic: true },
    ],
    recap: buildRecap(report),
  });

  return beats;
}

/** The shareable, clipboard-ready recap. */
export function buildRecap(report: AnalysisReport): string {
  const { aggregates: agg, results } = report;
  const find = (id: string) => results.find((r) => r.id === id);
  const lines: string[] = [];
  lines.push(`🎁 git-roast — ${agg.repoName}`);
  lines.push(`📅 ${num(agg.ageDays)}d old · ${num(agg.totalCommits)} commits · ${agg.humans} dev${agg.humans === 1 ? '' : 's'}`);
  if (agg.topAuthors[0]) lines.push(`🏆 Workhorse: ${agg.topAuthors[0].name} (${agg.workhorseShare}%)`);
  const bat = agg.batman[0];
  if (bat && bat.score >= 3) lines.push(`🦇 Batman: ${bat.name} — ${bat.night} nights, ${bat.weekend} weekends`);
  const cursed = find('cursed-file');
  if (cursed?.data?.path) lines.push(`🪦 Most cursed: ${cursed.data.path} (${cursed.data.touches}× edited)`);
  const robot = find('robot-detector');
  if (robot?.data?.ratio) lines.push(`🤖 ${robot.data.name}: ${robot.data.ratio}% of commits look AI-written`);
  const guilt = results.filter((r) => r.category === 'smells' || r.category === 'code').length;
  lines.push(`⚖️  ${verdict(guilt)}`);
  lines.push(`— judged by my SUPREME INTELLIGENCE · git-roast`);
  return lines.join('\n');
}
