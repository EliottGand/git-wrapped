#!/usr/bin/env node
import { render } from 'ink';
import { createElement } from 'react';
import { analyze } from '../core/analyze.js';
import { App } from './App.js';
import { buildStory, type Graph } from './story.js';
import { typewriterFinal } from './components/Typewriter.js';
import { copyToClipboard } from './clipboard.js';

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let dir = process.cwd();
  let plain = false;
  let help = false;
  for (const a of args) {
    if (a === '--plain') plain = true;
    else if (a === '--help' || a === '-h') help = true;
    else if (!a.startsWith('-')) dir = a;
  }
  return { dir, plain, help };
}

const HELP = `
git-roast — Spotify Wrapped, but it roasts your repo.

Usage:
  git-roast [path]          Analyze a repo (defaults to current directory)
  git-roast --plain         Print the story without animation (also used when piped)
  git-roast --help          Show this help

Your SUPREME INTELLIGENCE will judge you accordingly.
`;

const TICKS = '▁▂▃▄▅▆▇█';

function graphLines(graph: Graph): string[] {
  if (graph.type === 'clock') {
    const max = Math.max(1, ...graph.hours);
    const spark = graph.hours.map((h) => (h === 0 ? TICKS[0] : TICKS[Math.max(1, Math.round((h / max) * 7))])).join('');
    return [spark, '00h····06h····12h····18h··23h  (red hours are night, if your terminal had color)'];
  }
  const max = Math.max(1, ...graph.rows.map((r) => r.value));
  const labelW = Math.min(20, Math.max(...graph.rows.map((r) => r.label.length)));
  return graph.rows.map((r) => {
    const filled = Math.max(r.value > 0 ? 1 : 0, Math.round((r.value / max) * 24));
    const label = r.label.length > labelW ? r.label.slice(0, labelW - 1) + '…' : r.label.padEnd(labelW);
    return `${label} ${'█'.repeat(filled)} ${r.suffix ?? r.value}`;
  });
}

function renderPlain(report: ReturnType<typeof analyze>) {
  const out: string[] = [];
  for (const beat of buildStory(report)) {
    if (beat.kind === 'typewriter') {
      out.push('', typewriterFinal(beat.ops));
    } else if (beat.kind === 'scene') {
      out.push('');
      if (beat.header) out.push(beat.header);
      for (const l of beat.lines) if (l.text) out.push(l.text);
      if (beat.graph) out.push('', ...graphLines(beat.graph));
    } else {
      out.push('', ...beat.lines.map((l) => l.text), '─'.repeat(46), beat.recap, '─'.repeat(46));
      if (copyToClipboard(beat.recap)) out.push('(copied to your clipboard)');
    }
  }
  // eslint-disable-next-line no-console
  console.log(out.join('\n'));
}

function main() {
  const { dir, plain, help } = parseArgs(process.argv);
  if (help) {
    process.stdout.write(HELP);
    return;
  }

  let report: ReturnType<typeof analyze>;
  try {
    report = analyze(dir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n(╯°□°)╯  The SUPREME INTELLIGENCE cannot work under these conditions:\n  ${msg}\n\n`);
    process.exitCode = 1;
    return;
  }

  if (report.results.length === 0) {
    process.stdout.write(`\n¬_¬  Not a single commit worth judging. Come back when you've done something.\n\n`);
    return;
  }

  if (plain || !process.stdout.isTTY) {
    renderPlain(report);
    return;
  }

  render(createElement(App, { report }));
}

main();
