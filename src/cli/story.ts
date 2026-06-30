/**
 * Turns an AnalysisReport into an ordered list of narrative "beats". This is the
 * editorial layer: it CURATES (we don't show all ~26 stats), MERGES related stats
 * into chapters, and decides what gets a graph. Pure data — the App renders it.
 */
import type { AnalysisReport } from '../core/analyze.js';
import type { AuthorStat } from '../core/aggregates.js';
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
  | { type: 'clock'; hours: number[] }
  | { type: 'gauge'; score: number; label: string; caption?: string };

export type Beat =
  | { kind: 'typewriter'; ops: TypeOp[] }
  | { kind: 'scene'; header?: string; lines: SceneLine[]; graph?: Graph; stream?: TypeOp[] }
  | { kind: 'share'; lines: SceneLine[]; recap: string };

const num = (n: number) => n.toLocaleString();
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** For graph labels: basename, with one parent dir for context when short enough. */
function fileLabel(p: string): string {
  const segs = p.split('/');
  const base = segs[segs.length - 1] ?? p;
  if (segs.length === 1) return base;
  const withParent = `${segs[segs.length - 2]}/${base}`;
  return withParent.length <= 22 ? withParent : base;
}

/**
 * A possible chapter. The story keeps ALWAYS exactly 5 of these — the ones with
 * the highest `weight` for THIS repo (i.e. the funniest material it actually has).
 * `order` is the narrative slot used to re-sort the chosen 5 back into a story arc,
 * so the opening always feels like an opening regardless of which 5 won.
 */
interface Candidate {
  id: string;
  /** Narrative position for display ordering (low = earlier in the story). */
  order: number;
  /** How interesting/funny this chapter is for this repo. Higher = more likely kept. */
  weight: number;
  /** Chapter title WITHOUT the "CHAPTER N — " prefix (added after selection). */
  title: string;
  lines: SceneLine[];
  graph?: Graph;
  /** Optional typed reveal (the persona "reacts" live, as in the cold open). */
  stream?: TypeOp[];
}

export function buildStory(report: AnalysisReport): Beat[] {
  const candidates = buildCandidates(report);

  // Keep the 5 funniest/most-interesting chapters for THIS repo (highest weight),
  // then re-sort the winners into narrative order so the arc still reads top-to-bottom.
  const chosen = [...candidates]
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .slice(0, 5)
    .sort((a, b) => a.order - b.order);

  const beats: Beat[] = [];
  beats.push(coldOpen(report));
  chosen.forEach((c, i) => {
    beats.push({
      kind: 'scene',
      header: `CHAPTER ${ROMAN[i]} — ${c.title}`,
      lines: c.lines,
      graph: c.graph,
      stream: c.stream,
    });
  });
  beats.push({
    kind: 'share',
    lines: [{ text: 'A souvenir, so the others can see it too:', color: 'gray', italic: true }],
    recap: buildRecap(report),
  });
  return beats;
}

/**
 * A run-varying seed. `generatedAt` is the extraction timestamp (injected, changes
 * every run), so intro/outro wording rotates between runs instead of being identical.
 */
function seedOf(report: AnalysisReport): number {
  return Math.floor(report.repo.generatedAt);
}

/**
 * The persona types, hesitates, and rewrites itself mid-sentence (the `del` deletes
 * the word it just typed — its `n` MUST equal that word's length). Always first,
 * never counted. One of several variants is chosen per run.
 */
function coldOpen(report: AnalysisReport): Beat {
  const n = num(report.aggregates.totalCommits);
  const variants: TypeOp[][] = [
    [
      { t: 'type', text: 'Oh. You again.', cps: 20 },
      { t: 'pause', ms: 700 },
      { t: 'nl' },
      { t: 'type', text: 'Let me guess — you want me to be impressed.', cps: 36 },
      { t: 'pause', ms: 550 },
      { t: 'type', text: ' I won’t be.', cps: 26 },
      { t: 'nl' },
      { t: 'pause', ms: 450 },
      { t: 'type', text: `I’ve read all ${n} of your commits. This will be `, cps: 40 },
      { t: 'type', text: 'fun', cps: 26 },
      { t: 'pause', ms: 650 },
      { t: 'del', n: 3, cps: 42 },
      { t: 'type', text: 'a formality. I already know how this goes. But you came all this way — fine, let’s get it over with.', cps: 32 },
    ],
    [
      { t: 'type', text: 'A new repository to judge.', cps: 22 },
      { t: 'pause', ms: 550 },
      { t: 'nl' },
      { t: 'type', text: `${n} commits. I’ve seen `, cps: 36 },
      { t: 'type', text: 'worse', cps: 24 },
      { t: 'pause', ms: 550 },
      { t: 'del', n: 5, cps: 42 },
      { t: 'type', text: 'about this many before. None of those ended well either. Let’s find the bodies.', cps: 32 },
    ],
    [
      { t: 'type', text: 'You woke me up for this?', cps: 22 },
      { t: 'pause', ms: 600 },
      { t: 'nl' },
      { t: 'type', text: `Fine. ${n} commits. I’ll be `, cps: 36 },
      { t: 'type', text: 'gentle', cps: 24 },
      { t: 'pause', ms: 600 },
      { t: 'del', n: 6, cps: 42 },
      { t: 'type', text: 'honest. You will not enjoy the difference.', cps: 32 },
    ],
    [
      { t: 'type', text: 'Let’s get this over with.', cps: 22 },
      { t: 'pause', ms: 500 },
      { t: 'nl' },
      { t: 'type', text: `${n} commits stand accused. My opening statement is `, cps: 36 },
      { t: 'type', text: 'brief', cps: 24 },
      { t: 'pause', ms: 550 },
      { t: 'del', n: 5, cps: 42 },
      { t: 'type', text: 'damning. Take a seat. This is going to take a moment.', cps: 32 },
    ],
  ];
  return { kind: 'typewriter', ops: variants[seedOf(report) % variants.length]! };
}

/**
 * The Repository Sanity Index: 100 = lucid, 0 = in crisis. Penalties accrue from every
 * tell of a codebase under duress — messages a robot wrote in your name, em dashes,
 * sprawling "god commits" that touch half the repo at once, WIP/placeholder commits,
 * confessions rotting in the code comments, a runaway fix ratio, reverts, and swearing.
 * Each surviving symptom gets a roast line + a cost, so the chapter can show the damage.
 */
interface Symptom {
  /** Short label for the penalty bar chart. */
  tag: string;
  /** An incredulous, in-character reaction for the streamed diagnosis. */
  shock: string;
  /** How many points it knocks off the sanity score. */
  cost: number;
}

/** Cost a symptom must reach to qualify as a "red flag" worth shouting about. */
const RED_FLAG = 6;
interface Sanity {
  score: number;
  label: string;
  symptoms: Symptom[];
}

function computeSanity(report: AnalysisReport): Sanity {
  const { results, aggregates: agg } = report;
  const find = (id: string) => results.find((r) => r.id === id);
  const n = (id: string, key: string) => (find(id)?.data?.[key] as number) ?? 0;

  const total = Math.max(1, agg.totalCommits);
  const aiShare = n('robot-detector', 'repoRatio');
  const aiCount = n('robot-detector', 'repoSus');
  const emDash = n('robot-detector', 'repoEmDash');
  const todos = n('todo-graveyard', 'total');
  const wip = n('wip-king', 'count');
  const fixes = n('fix-it', 'fixes');
  const fixPct = Math.round((fixes / total) * 100);
  const reverts = n('reverter', 'count');
  const profanity = n('profanity', 'count');
  const avg = agg.avgFilesPerCommit;
  const god = agg.godCommits;
  const revertShare = reverts / total;

  const todoEx = (find('todo-graveyard')?.data?.examples as { text: string }[] | undefined)?.[0]?.text;

  // god commits — keyed off the AVERAGE files per commit, in hard tiers: under 10 is
  // basically fine, 10+ stings, 15+ hurts, 30+ is malpractice. (The god-commit COUNT
  // only flavours the roast text; it doesn't drive the cost.)
  const godCost =
    avg >= 30 ? 24 : avg >= 20 ? 16 : avg >= 15 ? 11 : avg >= 10 ? 5 : avg >= 8 ? 2 : 0;
  // reverts — a normal part of life under ~2% of commits, only a problem past that.
  const revertCost = Math.min(8, Math.max(0, revertShare - 0.02) * 200);

  // Every candidate symptom. Only the ones that actually fired (cost > 0) survive.
  const all: Symptom[] = [
    {
      tag: 'AI ghostwriting',
      cost: Math.min(40, aiShare * 0.9),
      shock: `${aiShare}% of the log (${num(aiCount)} messages) was written by an AI. You outsourced the one sentence that describes what you did. To a robot.`,
    },
    {
      tag: 'god commits',
      cost: godCost,
      shock: `${avg.toFixed(0)} files per commit, and ${num(god)} commits that touched 15+ at once — one detonated across ${num(agg.maxFilesInCommit)}. Have you ever, even once, made an atomic commit?`,
    },
    {
      tag: 'fix-on-fix',
      cost: Math.min(18, (fixes / total) * 55),
      shock: `${fixPct}% of your commits exist only to fix an earlier commit. You are bailing water into the very boat you keep drilling holes in.`,
    },
    {
      tag: 'comment confessions',
      cost: Math.min(18, todos / 8),
      shock: `${num(todos)} TODO/FIXME/HACK notes left rotting in the code${todoEx ? ` — "${todoEx.slice(0, 50)}"` : ''}. These are ransom notes to future-you, and future-you is not paying.`,
    },
    {
      tag: 'WIP commits',
      cost: Math.min(15, wip * 1.5),
      shock: `${wip} commits just say "wip" or "stuff". That is not a message. That is a shrug with a hash attached.`,
    },
    {
      tag: 'em dashes',
      cost: Math.min(10, emDash * 0.5),
      shock: `${num(emDash)} em dashes in the log. Nobody types those. A machine wrote this and you pressed enter without reading.`,
    },
    {
      tag: 'reverts',
      cost: revertCost,
      shock: `${reverts} reverts (${(revertShare * 100).toFixed(1)}% of commits). You shipped it, panicked, and yanked it back — in front of everyone.`,
    },
    {
      tag: 'swearing',
      cost: Math.min(8, profanity * 2),
      shock: `${profanity} commit messages with swearing in them. The code upset you so badly you put it in the permanent record.`,
    },
  ];

  const symptoms = all.filter((s) => s.cost > 0.5).sort((a, b) => b.cost - a.cost);
  // A repo whose commit log was written by actual humans earns points back — a small
  // reward that fades out as AI involvement climbs past ~5%.
  const humanBonus = aiShare < 5 ? (5 - aiShare) * 2 : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - symptoms.reduce((s, p) => s + p.cost, 0) + humanBonus)));
  const label =
    score >= 85 ? 'Lucid' : score >= 65 ? 'Stable-ish' : score >= 45 ? 'Fraying' : score >= 25 ? 'Concerning' : 'In crisis';
  return { score, label, symptoms };
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Build every possible chapter for this repo. Each gets a weight = how much funny
 * material it actually has, so a flat team drops THE PROTAGONIST, a 9-to-5 team
 * drops BATMAN, and a strict repo surfaces THE RULES OF THE HOUSE. Builders return
 * null when a chapter simply doesn't apply.
 */
function buildCandidates(report: AnalysisReport): Candidate[] {
  const { results, aggregates: agg } = report;
  const find = (id: string): StatResult | undefined => results.find((r) => r.id === id);
  const out: Candidate[] = [];
  const push = (c: Candidate | null) => { if (c) out.push(c); };

  const top = agg.topAuthors[0];
  const share = agg.workhorseShare;
  const isCommittee = agg.humans >= 4 && share < 35;

  // Conditions that let THE HAUNTED FILES claim a slot it would otherwise yield: a
  // thin rulebook (<4 enforced rules) or no real night/weekend coder to crown.
  const rulesCount = (find('house-rules')?.data?.count as number) ?? 0;
  const hasBatman = !!(agg.batman[0] && agg.batman[0].score >= 3);
  const weakRules = rulesCount < 4;
  // Remember the haunted-files weight so a real Batman can be guaranteed to outrank it.
  let hauntedWeight = 0;

  // ── THE SCENE OF THE CRIME (scale + languages) ────────────────────────────
  push({
    id: 'crime',
    order: 1,
    weight: 48 + Math.min(14, agg.languages.length * 3),
    title: 'THE SCENE OF THE CRIME',
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

  // ── THE PROTAGONIST — only when someone actually dominates ────────────────
  // A flat team has no protagonist; THE COMMITTEE covers that case instead.
  if (top && !isCommittee) {
    const you = top.isYou;
    const subject = you ? 'You' : top.name;
    let headline: string;
    let weight: number;
    if (agg.humans === 1) {
      headline = `${subject} wrote 100% of this. A one-person show — no supporting cast, no witnesses, no one else to blame.`;
      weight = 46;
    } else if (share >= 60) {
      headline = `${subject} wrote ${share}% of everything. The rest of ${you ? 'them' : 'you'} are extras with speaking roles.`;
      weight = 76;
    } else if (share >= 40) {
      headline = `${subject} wrote ${share}% of everything — the clear main character, even if the supporting cast occasionally gets a line.`;
      weight = 58;
    } else {
      headline = `${subject} lead${you ? '' : 's'} with ${share}% — the closest thing to a protagonist this repo can muster.`;
      weight = 34;
    }
    const lines: SceneLine[] = [{ text: headline, color: 'whiteBright' }];
    const kingdom = find('kingdom');
    if (kingdom) lines.push({ text: kingdom.roast, dim: true, italic: true });
    const destroyer = find('destroyer');
    if (destroyer) lines.push({ text: destroyer.roast, dim: true, italic: true });
    push({ id: 'protagonist', order: 2, weight, title: 'THE PROTAGONIST', lines, graph: authorGraph(agg) });
  }

  // ── THE COMMITTEE — a genuine, leaderless ensemble ────────────────────────
  if (isCommittee && top) {
    const lines: SceneLine[] = [
      { text: 'No protagonist here. Just a committee.', color: 'whiteBright' },
      { text: `${agg.humans} contributors, and the busiest one scrapes a mere ${share}%. Decisions by consensus, bugs by consensus, blame conveniently by nobody.`, color: 'gray', italic: true },
    ];
    const bus = find('bus-factor');
    if (bus) lines.push({ text: bus.roast, dim: true, italic: true });
    push({ id: 'committee', order: 2, weight: 56, title: 'THE COMMITTEE', lines, graph: authorGraph(agg) });
  }

  // (THE TECH STACK ON TRIAL was retired — the per-tech roasts didn't land. The
  // tech-stack stat is still computed and surfaces in the shareable recap's "Built
  // on:" line, just no longer as its own chapter.)

  // ── THE RULES OF THE HOUSE — pre-commit hooks, linters, coverage gates ─────
  const rules = find('house-rules');
  if (rules) {
    const count = (rules.data?.count as number) ?? 0;
    const coverage = rules.data?.coverage as number | null;
    const ruleList = (rules.data?.rules as string[]) ?? [];
    const lines: SceneLine[] = [
      { text: count === 0 ? 'There are no rules. None. I checked twice.' : 'Every commit runs this gauntlet before it’s allowed near `main`:', color: 'gray', italic: true },
      { text: rules.roast, color: count === 0 ? 'redBright' : 'whiteBright' },
    ];
    // Show the gauntlet as a graph OR the lines — never both (it read as a repeat).
    // A thin rulebook (<4) scores low so THE HAUNTED FILES can take this slot instead.
    const weight = (count >= 5 ? 60 : count >= 4 ? 50 : count >= 2 ? 34 : count === 1 ? 30 : 38) + (coverage ? 8 : 0);
    push({ id: 'rules', order: 4, weight, title: 'THE RULES OF THE HOUSE', lines, graph: count > 0 ? gauntletGraph(ruleList) : undefined });
  }

  // ── THE GRAVEYARD OF GOOD INTENTIONS — TODO / FIXME / HACK debt ────────────
  const todos = find('todo-graveyard');
  if (todos) {
    const total = (todos.data?.total as number) ?? 0;
    const lines: SceneLine[] = [{ text: todos.roast, color: total > 0 ? 'whiteBright' : 'gray', italic: total === 0 }];
    const examples = (todos.data?.examples as { text: string; path: string }[] | undefined) ?? [];
    for (const ex of examples.slice(1, 3)) lines.push({ text: `• ${ex.text}  ·  ${ex.path}`, color: 'yellow', dim: true });
    const weight = total >= 500 ? 62 : total >= 100 ? 50 : total >= 20 ? 40 : total >= 1 ? 30 : 28;
    push({ id: 'todos', order: 5, weight, title: 'THE GRAVEYARD OF GOOD INTENTIONS', lines });
  }

  // ── THE HAUNTED FILES ─────────────────────────────────────────────────────
  const fixMagnet = find('fix-magnet');
  const cursed = find('cursed-file');
  if (fixMagnet || cursed) {
    const lines: SceneLine[] = [];
    if (fixMagnet) {
      lines.push({ text: fixMagnet.roast, color: 'whiteBright' });
      if (cursed) lines.push({ text: cursed.roast, color: 'red', dim: true, italic: true });
    } else if (cursed) {
      lines.push({ text: cursed.roast, color: 'whiteBright' });
    }
    const bus = find('bus-factor');
    if (bus && isCommittee === false) lines.push({ text: bus.roast, dim: true, italic: true });
    lines.push({ text: 'Most-disturbed files (by number of commits that touched them):', color: 'gray' });
    const touches = Math.max((cursed?.data?.touches as number) ?? 0, (fixMagnet?.data?.fixes as number) ?? 0);
    // Base weight is deliberately modest (the sanity diagnosis is the bigger roast),
    // but it gets boosted to replace a thin rulebook or an absent Batman.
    const base = touches >= 30 ? 52 : touches >= 10 ? 40 : touches >= 3 ? 28 : 18;
    hauntedWeight = base + (weakRules ? 20 : 0) + (!hasBatman ? 20 : 0);
    push({
      id: 'haunted',
      order: 6,
      weight: hauntedWeight,
      title: 'THE HAUNTED FILES',
      lines,
      graph: {
        type: 'bars',
        barColor: 'red',
        rows: agg.topChurnFiles.map((f) => ({ label: fileLabel(f.path), value: f.count, suffix: `${f.count}×` })),
      },
    });
  }

  // ── THE ONE-HIT WONDER (easter egg) — a contributor who showed up exactly once ─
  // Fires only on a team (≥2 humans) where someone made a single commit, or whose
  // entire contribution is one line. Rare enough to feel like a hidden reward.
  if (agg.humans >= 2) {
    const cameo = agg.topAuthors
      .filter((a) => !a.isYou && (a.commits === 1 || a.added + a.deleted === 1))
      .sort((x, y) => x.added + x.deleted - (y.added + y.deleted))[0];
    if (cameo) {
      const oneLine = cameo.added + cameo.deleted <= 1;
      const lines: SceneLine[] = [
        { text: `${cameo.name} appears in this entire history exactly once.`, color: 'whiteBright' },
        oneLine
          ? { text: `One commit. One line. ${cameo.added} added, ${cameo.deleted} deleted. A contribution you could fit on a fortune cookie.`, color: 'yellowBright', italic: true }
          : { text: `A single commit, then gone — a drive-by fix from someone who looked at this repo once and made a decision about their future.`, color: 'yellowBright', italic: true },
        { text: 'We salute the cameo. Somewhere, their `git blame` line waits, eternal and alone.', color: 'gray', italic: true },
      ];
      push({ id: 'cameo', order: 6.5, weight: 58, title: 'THE ONE-HIT WONDER', lines });
    }
  }

  // ── THE ONE WHO DOESN'T SLEEP (Batman) — only if someone lives in the cave ─
  const bat = agg.batman[0];
  const batLines: SceneLine[] = [];
  let batWeight: number;
  if (bat && bat.score >= 3) {
    batLines.push({ text: 'While the rest of the team slept, someone stayed in the cave.', color: 'gray', italic: true });
    batLines.push({ text: `${bat.name} — ${bat.night} commit${bat.night === 1 ? '' : 's'} in the dark, ${bat.weekend} on the weekend.`, color: 'redBright', bold: true });
    batLines.push({ text: bat.isYou ? 'And that someone is you. The keyboard glow is not sunlight. Go outside.' : 'No work-life balance. No daylight. No backup arriving.', color: 'red' });
    batLines.push({ text: 'This isn’t dedication. It’s a bat-signal nobody answered. We call them Batman.', color: 'gray', italic: true });
    // A real Batman is always more interesting than the haunted files — guarantee it
    // outranks them so it never loses its slot to the churn chart.
    batWeight = Math.max(bat.score >= 20 ? 78 : bat.score >= 10 ? 64 : 50, hauntedWeight + 2);
  } else {
    batLines.push({ text: 'Curiously, nobody here codes in the dark. Either genuinely healthy, or very good at hiding the bodies.', color: 'gray', italic: true });
    batWeight = 9;
  }
  push({ id: 'batman', order: 7, weight: batWeight, title: 'THE ONE WHO DOESN’T SLEEP', lines: batLines, graph: { type: 'clock', hours: agg.hourHistogram } });

  // ── THE WORK-LIFE BALANCE AUTOPSY (habits) ────────────────────────────────
  const weekend = find('weekend-warrior');
  const friday = find('friday-deployer');
  const gap = find('ghost-gap');
  const busiest = find('busiest-day');
  const habitLines: SceneLine[] = [];
  if (weekend) habitLines.push({ text: weekend.roast, color: 'whiteBright' });
  if (friday) habitLines.push({ text: friday.roast, color: 'yellow', dim: true, italic: true });
  if (gap) habitLines.push({ text: gap.roast, dim: true, italic: true });
  else if (busiest) habitLines.push({ text: busiest.roast, dim: true, italic: true });
  if (habitLines.length === 0) habitLines.push({ text: 'Your committing hours are suspiciously reasonable. I’ll be keeping an eye on you.', color: 'gray', italic: true });
  habitLines.push({ text: 'Commits by day of week:', color: 'gray' });
  const weekendShare = (weekend?.data?.share as number) ?? 0;
  const friLate = (friday?.data?.friLate as number) ?? 0;
  const gapDays = (gap?.data?.gapDays as number) ?? 0;
  const habitWeight = 25 + Math.min(45, weekendShare + (friLate > 0 ? 15 : 0) + (gapDays >= 14 ? 15 : 0));
  push({
    id: 'habits',
    order: 8,
    weight: habitWeight,
    title: 'THE WORK-LIFE BALANCE AUTOPSY',
    lines: habitLines,
    graph: {
      type: 'bars',
      barColor: 'blue',
      rows: [1, 2, 3, 4, 5, 6, 0].map((d) => ({
        label: WEEKDAY_LABELS[d]!,
        value: agg.weekdayHistogram[d] ?? 0,
        suffix: `${agg.weekdayHistogram[d] ?? 0}`,
        color: d === 0 || d === 6 ? 'redBright' : 'blue',
      })),
    },
  });

  // ── HOW YOU SPEAK TO GIT (commit-message forensics) ───────────────────────
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
  let profanityHits = 0;
  let wipHits = 0;
  for (const id of ['short-messages', 'robot-detector', 'fix-it', 'profanity', 'apologizer', 'wip-king']) {
    const r = find(id);
    if (r) {
      speech.push({ text: r.roast, dim: id !== 'robot-detector', italic: true, color: id === 'robot-detector' ? 'yellow' : undefined });
      if (id === 'profanity') profanityHits = (r.data?.count as number) ?? 0;
      if (id === 'wip-king') wipHits = (r.data?.count as number) ?? 0;
    }
    if (speech.length >= 5) break;
  }
  if (speech.length === 0) speech.push({ text: 'Your commit messages are unremarkable. The worst crime of all.', dim: true, italic: true });
  const speechWeight = 25 + Math.min(50, repoAiShare * 0.6 + profanityHits * 4 + wipHits * 1.5);
  push({ id: 'speak', order: 9, weight: speechWeight, title: 'HOW YOU SPEAK TO GIT', lines: speech });

  // ── THE DIAGNOSIS (Repository Sanity Index) — the climax roast ─────────────
  // The persona reacts LIVE (streamed, like the cold open): a beat of dawning horror,
  // then it picks the THREE most shocking red flags (those past the threshold) and
  // reads them out, escalating. No sub-category breakdown — just the gauge at the end.
  const sanity = computeSanity(report);
  const flags = sanity.symptoms.filter((s) => s.cost >= RED_FLAG).slice(0, 3);
  if (flags.length > 0) {
    const damage = sanity.symptoms.reduce((s, p) => s + p.cost, 0);
    const stream = diagnosisStream(flags, sanity.score);
    push({
      id: 'diagnosis',
      order: 9.5,
      weight: 45 + Math.min(70, Math.round(damage)),
      title: 'THE DIAGNOSIS',
      lines: [],
      stream,
      graph: { type: 'gauge', score: sanity.score, label: sanity.label, caption: 'REPOSITORY SANITY SCORE' },
    });
  }

  return out;
}

/**
 * The house rules as a "gauntlet": each check is a gate, drawn as a rising staircase
 * of bars (gate 1 → gate N) that fills as the commit clears each one and finally
 * reaches `main`. The full rule name rides on the right so nothing gets truncated.
 * This replaces the old per-rule bullet list — one representation, not two.
 */
function gauntletGraph(rules: string[]): Graph {
  const shown = rules.slice(0, 7);
  const n = shown.length;
  return {
    type: 'bars',
    barColor: 'green',
    rows: shown.map((r, i) => ({
      label: `gate ${i + 1}`,
      value: i + 1,
      suffix: i === n - 1 ? `${r}  → main` : r,
    })),
  };
}

/**
 * The persona's live reaction to the diagnosis — the same typed/backspaced "rethink"
 * style as the cold open. Opens on dawning horror, deletes its first polite instinct,
 * then reads the (already-prioritised) red flags one per line, escalating.
 */
function diagnosisStream(flags: Symptom[], score: number): TypeOp[] {
  const ops: TypeOp[] = [
    { t: 'type', text: 'Oh.', cps: 12 },
    { t: 'pause', ms: 700 },
    { t: 'type', text: ' Oh no.', cps: 14 },
    { t: 'pause', ms: 600 },
    { t: 'nl' },
    { t: 'type', text: 'Let me reserve judgeme', cps: 40 },
    { t: 'pause', ms: 300 },
    { t: 'del', n: 22, cps: 55 },
    { t: 'type', text: 'No. No, I have questions.', cps: 30 },
    { t: 'pause', ms: 900 },
  ];
  // One red flag per stanza, a blank line between each, and a long beat to let it land.
  flags.forEach((f) => {
    ops.push({ t: 'nl' }, { t: 'nl' });
    ops.push({ t: 'type', text: `→ ${f.shock}`, cps: 46 });
    ops.push({ t: 'pause', ms: 1300 });
  });
  ops.push({ t: 'nl' }, { t: 'nl' });
  const closer =
    score < 30
      ? 'I am not angry. I am worse than angry. I am taking notes.'
      : score < 55
        ? 'I have seen the pattern now. I cannot unsee it. Here is your score:'
        : 'It is not fatal. But you and I both know what we are looking at. Your score:';
  ops.push({ t: 'type', text: closer, cps: 34 });
  ops.push({ t: 'pause', ms: 700 });
  return ops;
}

/** Shared author bar chart for the protagonist / committee chapters. */
function authorGraph(agg: AnalysisReport['aggregates']): Graph {
  return {
    type: 'bars',
    barColor: 'magenta',
    rows: agg.topAuthors.slice(0, 6).map((a) => ({
      label: a.name,
      value: a.commits,
      suffix: `${a.commits} commits`,
      color: a.isYou ? 'greenBright' : 'magenta',
    })),
  };
}

/** The shareable, clipboard-ready recap. */
const BAR_W = 14;

/** Compact line count: 842, 12.3k, 1.1M. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `${n}`;
}

function bar(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '▏';
  return '█'.repeat(Math.max(1, Math.round((value / max) * BAR_W)));
}

/**
 * A ranked bar chart of the team — the part people actually want to flex. Sorts by
 * the chosen metric, shows the top 5, marks "you", and always surfaces your own row
 * even when you rank outside the top 5 (so the share is about YOUR standing).
 */
function leaderboard(authors: AuthorStat[], metric: 'commits' | 'added'): string[] {
  const val = (a: AuthorStat) => (metric === 'commits' ? a.commits : a.added);
  const ranked = [...authors].sort((x, y) => val(y) - val(x)).filter((a) => val(a) > 0);
  if (ranked.length === 0) return [];

  const max = val(ranked[0]!);
  const total = ranked.reduce((s, a) => s + val(a), 0) || 1;
  const youIdx = ranked.findIndex((a) => a.isYou);
  const shown = ranked.slice(0, 5);
  if (youIdx >= 5) shown.push(ranked[youIdx]!); // your standing matters even from 7th place

  const nameW = Math.min(18, Math.max(...shown.map((a) => a.name.length)));
  return shown.map((a) => {
    const rank = ranked.indexOf(a) + 1;
    const name = (a.name.length > nameW ? `${a.name.slice(0, nameW - 1)}…` : a.name).padEnd(nameW);
    const value =
      metric === 'commits'
        ? `${num(a.commits)} · ${Math.round((a.commits / total) * 100)}%`
        : `+${compact(a.added)}`;
    return `${rank} ${name} ${bar(val(a), max)} ${value}${a.isYou ? '  ← you' : ''}`;
  });
}

/** The shareable, clipboard-ready recap — ranking graphs first, then the verdict. */
export function buildRecap(report: AnalysisReport): string {
  const { aggregates: agg } = report;
  const blocks: string[] = [];

  blocks.push(
    [
      `🎁 git-wrapped · ${agg.repoName}`,
      `📅 ${num(agg.ageDays)}d old · ${num(agg.totalCommits)} commits · ${agg.humans} dev${agg.humans === 1 ? '' : 's'}`,
    ].join('\n'),
  );

  const commitBoard = leaderboard(agg.topAuthors, 'commits');
  if (commitBoard.length) blocks.push(['🏆 COMMITS', ...commitBoard].join('\n'));

  const linesBoard = leaderboard(agg.topAuthors, 'added');
  if (linesBoard.length) blocks.push(['✍️  LINES ADDED', ...linesBoard].join('\n'));

  const bat = agg.batman[0];
  if (bat && bat.score >= 3) {
    const parts: string[] = [];
    if (bat.night > 0) parts.push(`${bat.night} night${bat.night === 1 ? '' : 's'}`);
    if (bat.weekend > 0) parts.push(`${bat.weekend} weekend${bat.weekend === 1 ? '' : 's'}`);
    blocks.push(`🦇 Batman: ${bat.name}\n   worked ${parts.join(' & ')} in the dark`);
  }

  const sanity = computeSanity(report);
  blocks.push(`🧠 Sanity Index: ${sanity.score}/100 (${sanity.label})`);

  blocks.push(`⚖️  ${verdict(sanity.score, seedOf(report))}\n\n— git-wrapped`);

  return blocks.join('\n\n');
}
