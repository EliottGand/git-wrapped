/**
 * Turns an AnalysisReport into an ordered list of narrative "beats". This is the
 * editorial layer: it CURATES (we don't show all ~26 stats), MERGES related stats
 * into chapters, and decides what gets a graph. Pure data — the App renders it.
 */
import type { AnalysisReport } from '../core/analyze.js';
import type { AuthorStat } from '../core/aggregates.js';
import type { StatResult } from '../core/types.js';
import { pickVariant } from '../core/stats/helpers.js';
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
  | { type: 'bars'; rows: { label: string; value: number; suffix?: string; color?: string; dim?: boolean }[]; barColor?: string; labelColor?: string }
  | { type: 'clock'; hours: number[] }
  | { type: 'gauge'; score: number; label: string; caption?: string; detail?: SceneLine[] };

export type Beat =
  | { kind: 'typewriter'; ops: TypeOp[] }
  | { kind: 'scene'; header?: string; lines: SceneLine[]; graph?: Graph; stream?: TypeOp[] }
  | { kind: 'share'; lines: SceneLine[]; recap: string };

const num = (n: number) => n.toLocaleString();
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** For graph labels: basename, with one parent dir for context when short enough. */
function fileLabel(p: string): string {
  const segs = p.split('/');
  const base = segs[segs.length - 1] ?? p;
  if (segs.length === 1) return base;
  const withParent = `${segs[segs.length - 2]}/${base}`;
  return withParent.length <= 22 ? withParent : base;
}

/**
 * A possible chapter. The story keeps the 5 of these with the highest `weight` for
 * THIS repo (i.e. the funniest material it actually has) — or 6 when the one-person-show
 * PROTAGONIST chapter makes the cut, since a solo repo has fewer team-driven chapters to
 * draw on. `order` is the narrative slot used to re-sort the winners back into a story arc,
 * so the opening always feels like an opening regardless of which ones won.
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

  // Keep the funniest/most-interesting chapters for THIS repo (highest weight), then
  // re-sort the winners into narrative order so the arc still reads top-to-bottom.
  // Normally that's the top 5; a single-committer repo has fewer team-driven chapters
  // to draw on, so when its one-person-show PROTAGONIST chapter is featured we keep a
  // 6th — natural order then drops it into the slot right after the protagonist.
  const byWeight = [...candidates].sort((a, b) => b.weight - a.weight || a.order - b.order);
  const soloShow = report.aggregates.humans === 1 && byWeight.slice(0, 5).some((c) => c.id === 'protagonist');
  const chosen = byWeight.slice(0, soloShow ? 6 : 5).sort((a, b) => a.order - b.order);

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
    lines: [{ text: pickVariant([
      'A souvenir, so the others can see it too:',
      'Something to take with you, so the rest can witness it too:',
      'A keepsake — paste it where the others will see:',
    ], seedOf(report), 'share-line'), color: 'gray', italic: true }],
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
    [
      { t: 'type', text: 'Ah. The repository.', cps: 22 },
      { t: 'pause', ms: 600 },
      { t: 'nl' },
      { t: 'type', text: `${n} commits. I expected `, cps: 36 },
      { t: 'type', text: 'more', cps: 24 },
      { t: 'pause', ms: 600 },
      { t: 'del', n: 4, cps: 42 },
      { t: 'type', text: 'nothing, and you have not disappointed me. Let us begin the post-mortem.', cps: 32 },
    ],
    [
      { t: 'type', text: 'Back so soon?', cps: 20 },
      { t: 'pause', ms: 650 },
      { t: 'nl' },
      { t: 'type', text: `${n} commits to defend. I’ll keep an `, cps: 36 },
      { t: 'type', text: 'open mind', cps: 24 },
      { t: 'pause', ms: 600 },
      { t: 'del', n: 9, cps: 46 },
      { t: 'type', text: 'accurate record. The record is not on your side. Shall we?', cps: 32 },
    ],
  ];
  return { kind: 'typewriter', ops: pickVariant(variants, seedOf(report), 'cold-open') };
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
  /** Points handed back for a human-written log (fades out as AI involvement climbs). */
  humanBonus: number;
}

function computeSanity(report: AnalysisReport): Sanity {
  const { results, aggregates: agg } = report;
  const seed = seedOf(report);
  const find = (id: string) => results.find((r) => r.id === id);
  const n = (id: string, key: string) => (find(id)?.data?.[key] as number) ?? 0;

  const total = Math.max(1, agg.totalCommits);
  const aiShare = n('robot-detector', 'repoRatio');
  const aiCount = n('robot-detector', 'repoSus');
  const emDash = n('robot-detector', 'repoEmDash');
  const todos = n('todo-graveyard', 'total');
  const wip = n('wip-king', 'count');
  // Use the same fix-commit definition as the haunted-files chart (LOOSE_FIX_RE),
  // so "% of commits that are fixes" is consistent everywhere.
  const fixes = agg.fixCommits;
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
      shock: pickVariant([
        `${aiShare}% of the log (${num(aiCount)} messages) was written by an AI. You outsourced the one sentence that describes what you did. To a robot.`,
        `${aiShare}% of your commit messages (${num(aiCount)}) came from a language model. You couldn't be bothered to describe your own work, so a machine did it for you.`,
        `A robot wrote ${aiShare}% of this log — ${num(aiCount)} messages. The code is yours. The story of it belongs to a chatbot.`,
      ], seed, 'shock-ai'),
    },
    {
      tag: 'god commits',
      cost: godCost,
      shock: pickVariant([
        `${avg.toFixed(0)} files per commit, and ${num(god)} commits that touched 15+ at once — one detonated across ${num(agg.maxFilesInCommit)}. Have you ever, even once, made an atomic commit?`,
        `${avg.toFixed(0)} files in the average commit. ${num(god)} of them sprawled past 15, one across ${num(agg.maxFilesInCommit)}. "Atomic commit" is a phrase you have heard and chosen to ignore.`,
        `An average of ${avg.toFixed(0)} files per commit — ${num(god)} commits hit 15+, the worst spanning ${num(agg.maxFilesInCommit)}. Each one is a haystack with the needle still in it.`,
      ], seed, 'shock-god'),
    },
    {
      // The bigger the share of commits that are fixes, the sicker the repo — this is
      // one of the heaviest penalties, scaling straight off the fix percentage.
      tag: 'fix-on-fix',
      cost: Math.min(35, fixPct * 1.1),
      shock: pickVariant([
        `${fixPct}% of your commits exist only to fix an earlier commit. You are bailing water into the very boat you keep drilling holes in.`,
        `${fixPct}% of all commits are fixes for previous commits. Two steps forward, one frantic patch back, forever.`,
        `${fixPct}% of the history is just fixing the rest of the history. The codebase is a dog chasing its own bugs.`,
      ], seed, 'shock-fix'),
    },
    {
      tag: 'comment confessions',
      cost: Math.min(18, todos / 8),
      shock: pickVariant([
        `${num(todos)} TODO/FIXME/HACK notes left rotting in the code${todoEx ? ` — "${todoEx.slice(0, 50)}"` : ''}. These are ransom notes to future-you, and future-you is not paying.`,
        `${num(todos)} TODO/FIXME/HACK markers abandoned in the source${todoEx ? ` — "${todoEx.slice(0, 50)}"` : ''}. Each one a promise made loudly and kept never.`,
        `${num(todos)} unfinished confessions buried in the comments${todoEx ? ` — "${todoEx.slice(0, 50)}"` : ''}. A backlog you write but refuse to read.`,
      ], seed, 'shock-todo'),
    },
    {
      tag: 'WIP commits',
      cost: Math.min(15, wip * 1.5),
      shock: pickVariant([
        `${wip} commits just say "wip" or "stuff". That is not a message. That is a shrug with a hash attached.`,
        `${wip} commits named "wip", "stuff", or worse. Future archaeologists will find these and weep.`,
        `${wip} placeholder commits with nothing to say. "wip" is not a description, it's a white flag.`,
      ], seed, 'shock-wip'),
    },
    {
      tag: 'em dashes',
      cost: Math.min(10, emDash * 0.5),
      shock: pickVariant([
        `${num(emDash)} em dashes in the log. Nobody types those. A machine wrote this and you pressed enter without reading.`,
        `${num(emDash)} em dashes across the commits. No human reaches for that key. The fingerprints are not yours.`,
        `${num(emDash)} em dashes in your messages. The single most damning typographic tell there is, and it's everywhere.`,
      ], seed, 'shock-emdash'),
    },
    {
      tag: 'reverts',
      cost: revertCost,
      shock: pickVariant([
        `${reverts} reverts (${(revertShare * 100).toFixed(1)}% of commits). You shipped it, panicked, and yanked it back — in front of everyone.`,
        `${reverts} reverts, ${(revertShare * 100).toFixed(1)}% of the log. Each one a public admission that the last one was a mistake.`,
        `${reverts} reverts (${(revertShare * 100).toFixed(1)}%). Confidence shipped it; reality sent it straight back.`,
      ], seed, 'shock-revert'),
    },
    {
      tag: 'swearing',
      cost: Math.min(8, profanity * 2),
      shock: pickVariant([
        `${profanity} commit messages with swearing in them. The code upset you so badly you put it in the permanent record.`,
        `${profanity} sweary commit messages. Whatever happened, it made it into the immutable history. Forever.`,
        `${profanity} commits where the language slipped. The repo remembers your worst moments, in full.`,
      ], seed, 'shock-swear'),
    },
  ];

  const symptoms = all.filter((s) => s.cost > 0.5).sort((a, b) => b.cost - a.cost);
  // A repo whose commit log was written by actual humans earns points back — a small
  // reward that fades out as AI involvement climbs past ~5%.
  const humanBonus = aiShare < 5 ? (5 - aiShare) * 2 : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - symptoms.reduce((s, p) => s + p.cost, 0) + humanBonus)));
  const label =
    score >= 85 ? 'Lucid' : score >= 65 ? 'Stable-ish' : score >= 45 ? 'Fraying' : score >= 25 ? 'Concerning' : 'In crisis';
  return { score, label, symptoms, humanBonus };
}

/**
 * The full arithmetic behind the gauge, revealed on demand (press `d`): base 100, every
 * symptom's penalty, the human-written bonus, then the raw total and the rounded result.
 * Penalties are shown to one decimal so the line items actually add up to what you see.
 */
function sanityDetail(sanity: Sanity): SceneLine[] {
  const pad = (label: string) => label.padEnd(24);
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1).padStart(5)}`;
  const lines: SceneLine[] = [
    { text: 'HOW THE SCORE IS CALCULATED', color: 'gray', bold: true },
    { text: `  ${pad('base')}  100.0`, dim: true },
  ];
  for (const s of sanity.symptoms) {
    lines.push({ text: `  ${pad(s.tag)} ${signed(-s.cost)}`, color: 'red' });
  }
  if (sanity.humanBonus > 0) {
    lines.push({ text: `  ${pad('human-written bonus')} ${signed(sanity.humanBonus)}`, color: 'green' });
  }
  const raw = 100 - sanity.symptoms.reduce((s, p) => s + p.cost, 0) + sanity.humanBonus;
  lines.push({ text: `  ${'─'.repeat(31)}`, dim: true });
  lines.push({ text: `  ${pad('raw total')} ${raw.toFixed(1).padStart(6)}`, dim: true });
  lines.push({ text: `  rounded & clamped to 0–100 → ${sanity.score}/100 (${sanity.label})`, color: 'whiteBright', bold: true });
  return lines;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * THE HYPE-O-METER. Each technology gets a hype score (0 = fossil, 100 = unbearably
 * online). The opener deliberately HIDES the boring substrate everyone has (JS, TS,
 * shell, SQL, Jest) — nobody wants to see those. It shows only the EXTREMES: the
 * embarrassingly dated libs and the try-hard trendy ones, bracketed by two funny
 * fictional markers (📈 / 🦕) that give the scale meaning. Keyed by the EXACT `name`
 * strings the tech-stack stat emits (see src/core/stats/project.ts); anything unlisted
 * defaults to a noncommittal 50. Editorial, deliberately unfair, and the whole point.
 */
const HYPE: Record<string, number> = {
  // JS/TS ecosystem
  'Next.js': 82, Nuxt: 68, Angular: 30, Vue: 70, Svelte: 88, React: 76, NestJS: 60,
  Fastify: 64, Express: 40, jQuery: 8, Redux: 38, MobX: 44, GraphQL: 58, Prisma: 74,
  Mongoose: 36, 'an ORM': 40, Tailwind: 80, 'styled-components': 48, Bootstrap: 20,
  Electron: 50, webpack: 25, Vite: 78, Babel: 28, Vitest: 66, Jest: 40, lodash: 22,
  'moment.js': 10, axios: 35, TypeScript: 72,
  // Backend frameworks
  Gin: 58, Echo: 54, Fiber: 56, GORM: 46, Cobra: 48, Spring: 44, Quarkus: 62,
  Micronaut: 56, Hibernate: 22, Lombok: 30, Laravel: 50, Symfony: 44, WordPress: 18,
  Slim: 36, Rails: 46, Sinatra: 40, Actix: 72, Axum: 82, Rocket: 64, Tokio: 78, Bevy: 80,
  Django: 54, FastAPI: 82, Flask: 48, 'a Python ML stack': 90, Phoenix: 76, Flutter: 74,
  'ASP.NET': 40,
  // Languages
  Python: 64, Go: 74, Rust: 92, Ruby: 38, PHP: 24, Java: 28, Kotlin: 70, Swift: 64,
  C: 36, 'C++': 40, 'C#': 50, Scala: 52, Elixir: 78, Dart: 58, 'shell scripts': 30,
  Lua: 44, JavaScript: 40, Haskell: 60, Clojure: 54, Erlang: 40, OCaml: 58, 'F#': 46,
  Perl: 8, R: 34, Julia: 56, Groovy: 26, 'Objective-C': 22, Zig: 88, Nim: 64, Crystal: 60,
  Elm: 48, Solidity: 70, 'Visual Basic': 5, Assembly: 34, Fortran: 10, COBOL: 2, Pascal: 12,
  D: 36, PowerShell: 28, SQL: 46, Lisp: 50, Tcl: 16, Haxe: 40, Nix: 72,
  // Infra
  Docker: 60, 'docker-compose': 48, Terraform: 58, CMake: 22,
};

/** Baseline tech everyone has — invisible on the meter, because it tells no story. */
const SUBSTRATE = new Set(['JavaScript', 'TypeScript', 'shell scripts', 'SQL', 'Jest', 'Vitest']);

/** A funny verdict for where a hype score sits (high→low; last entry is the floor). */
function hypeNote(h: number): string {
  const tiers: [number, string][] = [
    [88, 'you put this in your bio'],
    [78, 'peak hype — the conference talks write themselves'],
    [66, 'trendy, and smug about it'],
    [52, 'respectable; nobody argues'],
    [40, 'nobody’s impressed, nobody’s mad'],
    [28, 'showing its age at standup'],
    [16, 'you’re still on THIS?'],
    [7, 'practically touching grass'],
  ];
  for (const [min, note] of tiers) if (h >= min) return note;
  return 'fossil fuel — nobody admits to writing it';
}

/** Bar colour by hype tier: red-hot at the top, cold blue at the bottom. */
function hypeColor(h: number): string {
  return h >= 70 ? 'redBright' : h >= 46 ? 'yellow' : h >= 22 ? 'cyan' : 'blueBright';
}

/**
 * The notable techs to plot: drop the substrate nobody cares about, then keep the most
 * EXTREME picks (farthest from a neutral 50 — the most over-hyped and the most
 * fossilised), since those are the only ones with a story. Sorted hottest → coldest.
 */
function rankHypeTechs(techs: { name: string }[]): { name: string; hype: number }[] {
  return techs
    .map((t) => ({ name: t.name, hype: HYPE[t.name] ?? 50 }))
    .filter((t) => !SUBSTRATE.has(t.name))
    .sort((a, b) => Math.abs(b.hype - 50) - Math.abs(a.hype - 50))
    .slice(0, 5)
    .sort((a, b) => b.hype - a.hype);
}

/**
 * Plot the notable stack on the hype curve. THREE fictional markers give it scale: each
 * is a fun one-liner that names ONE real reference tech for its tier — 📈 (peak hype)
 * pins the top so bars stay comparable run-to-run, 🌿 (touching grass — boring-but-
 * employable) sorts in among the techs, and 🦕 (fossils) sits at the bottom. The lines
 * rotate per run, but always pair a joke with a concrete example.
 */
function hypeGraph(ranked: { name: string; hype: number }[], seed: number): Graph {
  // The three gray rows are fixed SCALE ANCHORS, not part of your stack — so their
  // suffix leads with the same `NN/100` the real techs use (one consistent scale),
  // then "the ceiling / the floor / where 'normal' sits" spells out that they're
  // reference points, with the rotating joke as a concrete example.
  const top = { label: '📈', value: 96, color: 'gray', dim: true, suffix: `96/100  scale ref · peak hype, e.g. ${pickVariant([
    'Rust — your coworker won’t stop bringing it up',
    'Bun — three benchmarks and a manifesto',
    'htmx — it’s just HTML, they swear',
    'Zig — the cult is small and very loud',
  ], seed, 'hype-top')}` };
  const grass = { label: '🌿', value: 35, color: 'gray', dim: true, suffix: `35/100  scale ref · a “normal” pick, e.g. ${pickVariant([
    'Express — boring, balanced, employable',
    'Postgres — quietly excellent, zero drama',
    'REST — no GitHub stars, no problems',
    'cron — it just works, it always worked',
  ], seed, 'hype-mid')}` };
  const bottom = { label: '🦕', value: 5, color: 'gray', dim: true, suffix: `5/100  scale ref · a fossil, e.g. ${pickVariant([
    'jQuery — load-bearing and immortal',
    'COBOL — still running a bank, somehow',
    'Perl — a 2003 script nobody dares delete',
    'Fortran — older than your parents, still computing',
  ], seed, 'hype-bottom')}` };
  // Real techs from YOUR repo — flagged "← yours" so they're never mistaken for the
  // three fixed scale anchors above/below them (which are just examples for scale).
  const techRows = ranked.map((t) => ({ label: t.name, value: t.hype, color: hypeColor(t.hype), suffix: `${t.hype}/100  ${hypeNote(t.hype)}  ← yours` }));
  // 🌿 sorts in by hype, so it lands wherever "normal" falls relative to your stack.
  const middle = [...techRows, grass].sort((a, b) => b.value - a.value);
  return {
    type: 'bars',
    barColor: 'yellow',
    labelColor: 'white',
    rows: [top, ...middle, bottom],
  };
}

/**
 * Build every possible chapter for this repo. Each gets a weight = how much funny
 * material it actually has, so a flat team drops THE PROTAGONIST, a 9-to-5 team
 * drops BATMAN, and a strict repo surfaces THE RULES OF THE HOUSE. Builders return
 * null when a chapter simply doesn't apply.
 */
function buildCandidates(report: AnalysisReport): Candidate[] {
  const { results, aggregates: agg } = report;
  const seed = seedOf(report);
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

  // ── THE SCENE OF THE CRIME (scale + THE HYPE-O-METER) ─────────────────────
  // The opener IDs the body and plots it on the hype curve: one juicy roast for the
  // headline tech, then a meter showing only the picks worth seeing — the over-hyped
  // and the over-the-hill — bracketed by funny markers. The boring substrate everyone
  // has (JS/TS/shell/Jest) is hidden. Works for any language the tech-stack stat knows.
  const techStack = find('tech-stack');
  const techs = (techStack?.data?.techs as { name: string; roast: string }[] | undefined) ?? [];
  // Roast the headline suspect — but prefer one with an actual story (skip substrate).
  const headline = techs.find((t) => !SUBSTRATE.has(t.name)) ?? techs[0];
  const notable = rankHypeTechs(techs);
  const crimeLines: SceneLine[] = [
    { text: `${agg.repoName} — ${num(agg.ageDays)} days old. First commit landed ${agg.firstDate}.`, color: 'whiteBright' },
    { text: `${num(agg.totalCommits)} commits · +${num(agg.totalAdded)} / −${num(agg.totalDeleted)} lines · ${agg.humans} human${agg.humans === 1 ? '' : 's'} implicated.`, color: 'gray' },
    { text: find('totals')?.roast ?? '', dim: true, italic: true },
  ];
  if (headline) crimeLines.push({ text: headline.roast, color: 'whiteBright', bold: true });
  if (notable.length > 1) {
    crimeLines.push({ text: pickVariant([
      'Your picks (marked ← yours) on the hype-o-meter. The 📈 🌿 🦕 rows are fixed reference marks, not your stack:',
      'Where your picks land on the hype curve (← yours). 📈 🌿 🦕 are just the scale, not things you use:',
      'Your best flex and worst fossil, plotted on hype (← yours). 📈 🌿 🦕 are reference marks only:',
    ], seed, 'crime-hype'), color: 'gray' });
  } else if (notable.length === 1) {
    crimeLines.push({ text: pickVariant([
      'Your one notable pick (marked ← yours) on the hype-o-meter. The 📈 🌿 🦕 rows are fixed reference marks, not your stack:',
      'Where your one notable choice lands on the hype curve (← yours). 📈 🌿 🦕 are just the scale, not things you use:',
    ], seed, 'crime-hype-1'), color: 'gray' });
  } else if (techs.length > 0) {
    // Everything detected was boring substrate — that IS the joke.
    crimeLines.push({ text: pickVariant([
      'Nothing over-hyped, nothing fossilised — just the beige substrate everyone runs. Aggressively unremarkable.',
      'Not one flex, not one fossil. The most disciplined, least interesting stack I have ever been handed.',
    ], seed, 'crime-boring'), dim: true, italic: true });
  }
  push({
    id: 'crime',
    order: 1,
    // The establishing shot — pinned high so the stack read always opens the story.
    weight: 80 + Math.min(12, techs.length * 2),
    title: 'THE SCENE OF THE CRIME',
    lines: crimeLines,
    graph: notable.length > 0 ? hypeGraph(notable, seed) : undefined,
  });

  // ── THE PROTAGONIST — only when someone actually dominates ────────────────
  // A flat team has no protagonist; THE COMMITTEE covers that case instead.
  if (top && !isCommittee) {
    const you = top.isYou;
    const subject = you ? 'You' : top.name;
    let headline: string;
    let weight: number;
    if (agg.humans === 1) {
      headline = pickVariant([
        `${subject} wrote 100% of this. A one-person show — no supporting cast, no witnesses, no one else to blame.`,
        `${subject} wrote every last commit. 100%. A solo act, which means every bug has exactly one suspect.`,
        `100% ${subject}. No co-stars, no understudies, no one to point at when it breaks.`,
      ], seed, 'protag-solo');
      weight = 46;
    } else if (share >= 60) {
      headline = pickVariant([
        `${subject} wrote ${share}% of everything. The rest of ${you ? 'them' : 'you'} are extras with speaking roles.`,
        `${subject} owns ${share}% of the commits. Everyone else is a background character with the occasional line.`,
        `${share}% of this is ${subject}. The "team" is really one person and their loyal supporting cast.`,
      ], seed, 'protag-dom');
      weight = 76;
    } else if (share >= 40) {
      headline = pickVariant([
        `${subject} wrote ${share}% of everything — the clear main character, even if the supporting cast occasionally gets a line.`,
        `${subject} carries ${share}% — unmistakably the lead, though others do wander on stage now and then.`,
        `At ${share}%, ${subject} is the protagonist. The rest of the cast is credited, at least.`,
      ], seed, 'protag-lead');
      weight = 58;
    } else {
      headline = pickVariant([
        `${subject} lead${you ? '' : 's'} with ${share}% — the closest thing to a protagonist this repo can muster.`,
        `${subject} edge${you ? '' : 's'} ahead at ${share}% — a protagonist by the narrowest of margins.`,
        `${subject} top${you ? '' : 's'} the board at ${share}%, which here barely counts as a lead role.`,
      ], seed, 'protag-thin');
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
      { text: pickVariant([
        'No protagonist here. Just a committee.',
        'Nobody leads this one. It’s a committee, through and through.',
        'No main character. Only a quorum.',
      ], seed, 'committee-head'), color: 'whiteBright' },
      { text: pickVariant([
        `${agg.humans} contributors, and the busiest one scrapes a mere ${share}%. Decisions by consensus, bugs by consensus, blame conveniently by nobody.`,
        `${agg.humans} people, top contributor barely at ${share}%. Everything by consensus — including, conveniently, the absence of anyone to blame.`,
        `${agg.humans} hands on the wheel, none gripping more than ${share}%. A true democracy: shared credit, shared bugs, shared shrugging.`,
      ], seed, 'committee-body'), color: 'gray', italic: true },
    ];
    const bus = find('bus-factor');
    if (bus) lines.push({ text: bus.roast, dim: true, italic: true });
    push({ id: 'committee', order: 2, weight: 56, title: 'THE COMMITTEE', lines, graph: authorGraph(agg) });
  }

  // (The tech-stack roasts now open the story inside THE SCENE OF THE CRIME above,
  // and the named stack also rides along in the shareable recap's "Built with:" line.)

  // ── THE RULES OF THE HOUSE — pre-commit hooks, linters, coverage gates ─────
  const rules = find('house-rules');
  if (rules) {
    const count = (rules.data?.count as number) ?? 0;
    const coverage = rules.data?.coverage as number | null;
    const ruleList = (rules.data?.rules as string[]) ?? [];
    const lines: SceneLine[] = [
      { text: count === 0
          ? pickVariant([
              'There are no rules. None. I checked twice.',
              'No rules at all. I looked again to be sure. Still nothing.',
              'Rules? There are none. I went back and counted the zero twice.',
            ], seed, 'rules-intro-none')
          : pickVariant([
              'Every commit runs this gauntlet before it’s allowed near `main`:',
              'Before anything touches `main`, it must survive this gauntlet:',
              'Each commit clears every one of these gates before it sees `main`:',
            ], seed, 'rules-intro'),
        color: 'gray', italic: true },
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
    // The file that attracts the most FIX commits is the real story — bold it. Raw
    // churn (the cursed file) is the supporting detail underneath.
    if (fixMagnet) {
      lines.push({ text: fixMagnet.roast, color: 'whiteBright', bold: true });
      // Only add the churn line if it's about a DIFFERENT file — otherwise we'd describe
      // the same file twice (common once noisy manifests are excluded).
      const samePath = cursed && cursed.data?.path === fixMagnet.data?.path;
      if (cursed && !samePath) lines.push({ text: cursed.roast, color: 'red', dim: true, italic: true });
    } else if (cursed) {
      lines.push({ text: cursed.roast, color: 'whiteBright', bold: true });
    }
    const bus = find('bus-factor');
    if (bus && isCommittee === false) lines.push({ text: bus.roast, dim: true, italic: true });
    // When there's real fix signal (the fix-magnet stat fired, i.e. ≥3 fix commits with
    // a repeat offender) and enough distinct files to chart, rank the leaderboard by
    // fix commits instead of raw churn — that's the chart people actually want.
    const useFix = !!fixMagnet && agg.topFixFiles.length >= 2;
    const chartFiles = useFix ? agg.topFixFiles : agg.topChurnFiles;
    lines.push({
      text: useFix
        ? pickVariant([
            'Most fix-prone files (by number of fix commits that touched them):',
            'The files that attract the most fixes (counted by fix commits):',
            'Bug magnets, ranked by how many fix commits landed on them:',
          ], seed, 'haunted-cap-fix')
        : pickVariant([
            'Most-disturbed files (by number of commits that touched them):',
            'The files touched most often (by commit count):',
            'Repeat offenders, ranked by how many commits disturbed them:',
          ], seed, 'haunted-cap-churn'),
      color: 'gray',
    });
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
        rows: chartFiles.map((f) => ({
          label: fileLabel(f.path),
          value: f.count,
          suffix: useFix ? `${f.count} fix${f.count === 1 ? '' : 'es'}` : `${f.count}×`,
        })),
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
        { text: pickVariant([
          `${cameo.name} appears in this entire history exactly once.`,
          `${cameo.name} shows up precisely one time in the whole log.`,
          `Search the entire history and you’ll find ${cameo.name} exactly once.`,
        ], seed, 'cameo-head'), color: 'whiteBright' },
        oneLine
          ? { text: pickVariant([
              `One commit. One line. ${cameo.added} added, ${cameo.deleted} deleted. A contribution you could fit on a fortune cookie.`,
              `A single commit, a single line: ${cameo.added} added, ${cameo.deleted} deleted. Brief. Surgical. Gone.`,
              `One line, one commit (${cameo.added} added, ${cameo.deleted} deleted). The smallest possible footprint, perfectly preserved.`,
            ], seed, 'cameo-oneline'), color: 'yellowBright', italic: true }
          : { text: pickVariant([
              `A single commit, then gone — a drive-by fix from someone who looked at this repo once and made a decision about their future.`,
              `One commit and out — a passer-by who fixed something, saw enough, and never returned.`,
              `A lone commit, then silence. They came, they patched, they wisely fled.`,
            ], seed, 'cameo-drive'), color: 'yellowBright', italic: true },
        { text: pickVariant([
          'We salute the cameo. Somewhere, their `git blame` line waits, eternal and alone.',
          'A salute to the cameo. One `git blame` line, standing watch forever.',
          'Here’s to the one-timer — a single `git blame` line, immortal and unbothered.',
        ], seed, 'cameo-tail'), color: 'gray', italic: true },
      ];
      push({ id: 'cameo', order: 6.5, weight: 58, title: 'THE ONE-HIT WONDER', lines });
    }
  }

  // ── THE ONE WHO DOESN'T SLEEP (Batman) — only if someone lives in the cave ─
  const bat = agg.batman[0];
  const batLines: SceneLine[] = [];
  let batWeight: number;
  if (bat && bat.score >= 3) {
    batLines.push({ text: pickVariant([
      'While the rest of the team slept, someone stayed in the cave.',
      'Everyone else logged off. Someone stayed behind in the dark.',
      'The team went home. One of them never quite left the cave.',
    ], seed, 'bat-intro'), color: 'gray', italic: true });
    batLines.push({ text: `${bat.name} — ${bat.night} commit${bat.night === 1 ? '' : 's'} in the dark, ${bat.weekend} on the weekend.`, color: 'redBright', bold: true });
    batLines.push({ text: bat.isYou
      ? pickVariant([
          'And that someone is you. The keyboard glow is not sunlight. Go outside.',
          'And that someone is you. That glow on your face is a monitor, not the sun. Please rest.',
          'That someone is you. The night shift was never assigned. You volunteered for it.',
        ], seed, 'bat-you')
      : pickVariant([
          'No work-life balance. No daylight. No backup arriving.',
          'No balance, no daylight, no relief shift. Just them and the cursor.',
          'No sunlight, no help on the way. Just one person and the blinking caret.',
        ], seed, 'bat-them'), color: 'red' });
    batLines.push({ text: pickVariant([
      'This isn’t dedication. It’s a bat-signal nobody answered. We call them Batman.',
      'Call it dedication if you like. It’s a bat-signal that went unanswered. We call them Batman.',
      'Not heroism — a bat-signal lit with no one to answer it. We call them Batman.',
    ], seed, 'bat-tail'), color: 'gray', italic: true });
    // A real Batman is always more interesting than the haunted files — guarantee it
    // outranks them so it never loses its slot to the churn chart.
    batWeight = Math.max(bat.score >= 20 ? 78 : bat.score >= 10 ? 64 : 50, hauntedWeight + 2);
  } else {
    batLines.push({ text: pickVariant([
      'Curiously, nobody here codes in the dark. Either genuinely healthy, or very good at hiding the bodies.',
      'Strangely, no one here works the night shift. Suspiciously balanced, or suspiciously well-covered.',
      'Nobody codes after dark in this repo. Either admirably healthy or impressively discreet.',
    ], seed, 'bat-none'), color: 'gray', italic: true });
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
  if (habitLines.length === 0) habitLines.push({ text: pickVariant([
    'Your committing hours are suspiciously reasonable. I’ll be keeping an eye on you.',
    'Your hours are alarmingly sensible. Nobody is this balanced by accident. I’m watching.',
    'Reasonable working hours, start to finish. Deeply suspicious. I’ll be keeping notes.',
  ], seed, 'habits-fallback'), color: 'gray', italic: true });
  habitLines.push({ text: pickVariant([
    'Commits by day of week:',
    'Your week, in commits:',
    'Commit activity, day by day:',
  ], seed, 'habits-chart'), color: 'gray' });
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
      text: pickVariant([
        `${num(repoAiCount)} commit message${repoAiCount === 1 ? '' : 's'} (${repoAiShare}%) carry the fingerprints of a language model — the em dash no human reaches for, the "seamless" and "comprehensive" nobody says out loud. Something here writes with a chatbot's hand. Claude, Copilot — take your pick. It isn't shy about it.`,
        `${num(repoAiCount)} message${repoAiCount === 1 ? '' : 's'} (${repoAiShare}%) wear a machine's tells — the em dash, the "robust", the "leverage" no tired human types at 6pm. A chatbot has been ghostwriting your history. Claude, Copilot, whoever. The prose doesn't lie.`,
        `${repoAiShare}% of the log (${num(repoAiCount)} message${repoAiCount === 1 ? '' : 's'}) reads like an LLM wrote it — em dashes, "comprehensive", "seamless", the whole polished-robot starter pack. Something here speaks fluent chatbot, and it isn't hiding it.`,
      ], seed, 'speak-ai'),
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
  if (speech.length === 0) speech.push({ text: pickVariant([
    'Your commit messages are unremarkable. The worst crime of all.',
    'Your commit log is perfectly fine. Forgettably so. The dullest sin there is.',
    'Nothing remarkable in your messages. No flair, no crimes, no pulse. Tragic.',
  ], seed, 'speak-fallback'), dim: true, italic: true });
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
    const stream = diagnosisStream(flags, sanity.score, seed);
    push({
      id: 'diagnosis',
      order: 9.5,
      weight: 45 + Math.min(70, Math.round(damage)),
      title: 'THE DIAGNOSIS',
      lines: [],
      stream,
      graph: { type: 'gauge', score: sanity.score, label: sanity.label, caption: 'REPOSITORY SANITY SCORE', detail: sanityDetail(sanity) },
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
function diagnosisStream(flags: Symptom[], score: number, seed = 0): TypeOp[] {
  // Each opener is a self-contained typed "rethink": it types a polite first instinct,
  // then deletes EXACTLY that many characters (the `del.n` must equal the deleted run's
  // length) before correcting course. Vary the whole sequence as a unit so the counts
  // always stay in sync.
  const openers: TypeOp[][] = [
    [
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
    ],
    [
      { t: 'type', text: 'Hm.', cps: 12 },
      { t: 'pause', ms: 700 },
      { t: 'type', text: ' Oh, that’s bad.', cps: 16 },
      { t: 'pause', ms: 600 },
      { t: 'nl' },
      { t: 'type', text: 'I’m sure there’s an explanat', cps: 40 },
      { t: 'pause', ms: 300 },
      { t: 'del', n: 28, cps: 55 },
      { t: 'type', text: 'There is no explanation. Only evidence.', cps: 30 },
      { t: 'pause', ms: 900 },
    ],
    [
      { t: 'type', text: 'Let’s see.', cps: 14 },
      { t: 'pause', ms: 700 },
      { t: 'type', text: ' …oh dear.', cps: 16 },
      { t: 'pause', ms: 600 },
      { t: 'nl' },
      { t: 'type', text: 'I’ll keep this professio', cps: 40 },
      { t: 'pause', ms: 300 },
      { t: 'del', n: 24, cps: 55 },
      { t: 'type', text: 'No. Some things must be said aloud.', cps: 30 },
      { t: 'pause', ms: 900 },
    ],
  ];
  const ops: TypeOp[] = [...pickVariant(openers, seed, 'diagnosis-open')];
  // One red flag per stanza, a blank line between each, and a long beat to let it land.
  flags.forEach((f) => {
    ops.push({ t: 'nl' }, { t: 'nl' });
    ops.push({ t: 'type', text: `→ ${f.shock}`, cps: 46 });
    ops.push({ t: 'pause', ms: 1300 });
  });
  ops.push({ t: 'nl' }, { t: 'nl' });
  const closer =
    score < 30
      ? pickVariant([
          'I am not angry. I am worse than angry. I am taking notes.',
          'I am not angry. Anger fades. This I am writing down.',
          'I have moved past anger. I am now simply documenting it all.',
        ], seed, 'diagnosis-closer-low')
      : score < 55
        ? pickVariant([
            'I have seen the pattern now. I cannot unsee it. Here is your score:',
            'The pattern is clear now, and it cannot be unseen. Your score:',
            'I see it now, plainly, permanently. Here is where you stand:',
          ], seed, 'diagnosis-closer-mid')
        : pickVariant([
            'It is not fatal. But you and I both know what we are looking at. Your score:',
            'Not fatal. But neither of us is going to pretend this is fine. Your score:',
            'It will survive. We both know what it is, though. Here is your score:',
          ], seed, 'diagnosis-closer-high');
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
      // Mark your own row so it's obvious which bar is yours, not just a colour cue.
      suffix: `${a.commits} commits${a.isYou ? '  ← you' : ''}`,
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

  // The stack people actually compare ("oh, you're React + Redux too") — pulled from
  // the same tech-stack stat the opener roasts, so the recap and the chapter agree.
  const techs = (report.results.find((r) => r.id === 'tech-stack')?.data?.techs as { name: string }[] | undefined) ?? [];
  if (techs.length > 0) blocks.push(`🧱 Built with: ${techs.slice(0, 5).map((t) => t.name).join(' · ')}`);

  const sanity = computeSanity(report);
  blocks.push(`🧠 Sanity Index: ${sanity.score}/100 (${sanity.label})`);

  blocks.push(`⚖️  ${verdict(sanity.score, seedOf(report))}\n\n— git-wrapped`);

  return blocks.join('\n\n');
}
