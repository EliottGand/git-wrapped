#!/usr/bin/env node
import { render, useApp } from 'ink';
import { createElement, useEffect, useState } from 'react';
import { analyze, analyzeAsync, type AnalysisReport } from '../core/analyze.js';
import { App } from './App.js';
import { buildStory, type Graph } from './story.js';
import { typewriterFinal } from './components/Typewriter.js';
import { Loader } from './components/Loader.js';
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
git-wrapped — Spotify Wrapped, but it roasts your repo.

Usage:
  git-wrapped [path]          Analyze a repo (defaults to current directory)
  git-wrapped --plain         Print the story without animation (also used when piped)
  git-wrapped --help          Show this help

Your SUPREME INTELLIGENCE will judge you accordingly.
`;

const TICKS = '▁▂▃▄▅▆▇█';

function graphLines(graph: Graph): string[] {
  if (graph.type === 'clock') {
    const max = Math.max(1, ...graph.hours);
    const spark = graph.hours.map((h) => (h === 0 ? TICKS[0] : TICKS[Math.max(1, Math.round((h / max) * 7))])).join('');
    return [spark, '00h····06h····12h····18h··23h  (red hours are night, if your terminal had color)'];
  }
  if (graph.type === 'gauge') {
    const W = 30;
    const filled = Math.max(1, Math.round((graph.score / 100) * W));
    const bar = `${'█'.repeat(filled)}${'░'.repeat(W - filled)}  ${graph.score}/100 — ${graph.label}`;
    return graph.caption ? [graph.caption, bar] : [bar];
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
      if (beat.stream) out.push(typewriterFinal(beat.stream));
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

const ERROR_PREFIX = '\n(╯°□°)╯  The SUPREME INTELLIGENCE cannot work under these conditions:\n  ';
const EMPTY_MSG = `\n¬_¬  Not a single commit worth judging. Come back when you've done something.\n\n`;

/**
 * The interactive (TTY) root: shows the Loader while `analyzeAsync` ingests the repo,
 * then hands off to App. Analysis runs async so the spinner keeps animating through a
 * big-big repo's `git log`. Error / empty cases print and exit, matching the plain path.
 */
function Root({ dir }: { dir: string }) {
  const { exit } = useApp();
  const [report, setReport] = useState<AnalysisReport | null>(null);

  useEffect(() => {
    let live = true;
    analyzeAsync(dir)
      .then((r) => {
        if (!live) return;
        if (r.results.length === 0) {
          process.stdout.write(EMPTY_MSG);
          exit();
          return;
        }
        setReport(r);
      })
      .catch((err) => {
        if (!live) return;
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${ERROR_PREFIX}${msg}\n\n`);
        process.exitCode = 1;
        exit();
      });
    return () => {
      live = false;
    };
  }, [dir]);

  return report ? createElement(App, { report }) : createElement(Loader);
}

function main() {
  const { dir, plain, help } = parseArgs(process.argv);
  if (help) {
    process.stdout.write(HELP);
    return;
  }

  // Non-interactive (piped or --plain): analyze synchronously and print, no spinner.
  if (plain || !process.stdout.isTTY) {
    let report: ReturnType<typeof analyze>;
    try {
      report = analyze(dir);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${ERROR_PREFIX}${msg}\n\n`);
      process.exitCode = 1;
      return;
    }
    if (report.results.length === 0) {
      process.stdout.write(EMPTY_MSG);
      return;
    }
    renderPlain(report);
    return;
  }

  render(createElement(Root, { dir }));
}

main();
