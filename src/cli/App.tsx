import { useEffect, useMemo, useState } from 'react';
import { Box, Static, Text, useApp, useInput } from 'ink';
import type { AnalysisReport } from '../core/analyze.js';
import { BANNER } from './persona.js';
import { buildStory, type Beat, type Graph, type SceneLine } from './story.js';
import { Typewriter } from './components/Typewriter.js';
import { BarChart } from './components/BarChart.js';
import { Clock } from './components/Clock.js';
import { copyToClipboard } from './clipboard.js';

export function App({ report }: { report: AnalysisReport }) {
  const { exit } = useApp();
  const beats = useMemo(() => buildStory(report), [report]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'anim' | 'ready'>('anim');
  const [skip, setSkip] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const current = beats[idx];
  const detail = current?.kind === 'scene' && current.graph?.type === 'gauge' ? current.graph.detail : undefined;
  const hasDetail = !!(detail && detail.length);

  useInput((input) => {
    if (idx >= beats.length) return exit();
    if (phase === 'anim') {
      setSkip(true); // fast-forward the current animation
      return;
    }
    // phase === 'ready' → 'd' toggles the calculation breakdown without advancing
    if (input === 'd' && hasDetail) {
      setShowDetail((s) => !s);
      return;
    }
    // any other key → advance, or leave if this was the last beat
    if (idx + 1 >= beats.length) return exit();
    setIdx((i) => i + 1);
    setPhase('anim');
    setSkip(false);
    setShowDetail(false);
  });

  // The banner is committed first, then each completed beat, so everything scrolls
  // naturally in the terminal's own scrollback.
  const committed = useMemo(
    () => [{ tag: 'banner' as const }, ...beats.slice(0, idx).map((beat) => ({ tag: 'beat' as const, beat }))],
    [idx, beats],
  );

  return (
    <Box flexDirection="column">
      <Static items={committed}>
        {(item, i) =>
          item.tag === 'banner' ? (
            <Banner key="banner" />
          ) : (
            <Box key={i} flexDirection="column" marginTop={1}>
              <BeatView beat={item.beat} frozen onDone={() => {}} />
            </Box>
          )
        }
      </Static>

      {current ? (
        <Box flexDirection="column" marginTop={1}>
          {/* key={idx} forces a fresh mount each beat, so mount-only effects
              (anim→ready transition, graph animation) re-run for every chapter —
              otherwise consecutive scenes reuse one instance and never become "ready". */}
          <BeatView key={idx} beat={current} skip={skip} onDone={() => setPhase('ready')} />
          {phase === 'ready' && showDetail && detail ? (
            <Box marginTop={1} flexDirection="column">
              {detail.map((l, i) => (
                <Line key={i} l={l} />
              ))}
            </Box>
          ) : null}
          <GateHint
            phase={phase}
            kind={current.kind}
            last={idx + 1 >= beats.length}
            hasDetail={hasDetail}
            showDetail={showDetail}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function Banner() {
  return (
    <Box flexDirection="column">
      <Text color="cyanBright">{BANNER}</Text>
      <Text color="gray" dimColor>
        {'  '}presented, reluctantly, by your SUPREME INTELLIGENCE
      </Text>
    </Box>
  );
}

function GateHint({
  phase,
  kind,
  last,
  hasDetail,
  showDetail,
}: {
  phase: 'anim' | 'ready';
  kind: Beat['kind'];
  last: boolean;
  hasDetail?: boolean;
  showDetail?: boolean;
}) {
  let text: string;
  if (phase === 'anim') text = kind === 'typewriter' ? '   …  (press any key to skip)' : '   …';
  else {
    text = last ? '   ↵  leave' : '   ↵  continue';
    if (hasDetail) text += showDetail ? '   ·   d  hide detail' : '   ·   d  show calculation';
  }
  return (
    <Box marginTop={1}>
      <Text color="whiteBright" bold>
        {text}
      </Text>
    </Box>
  );
}

function BeatView({ beat, frozen, skip, onDone }: { beat: Beat; frozen?: boolean; skip?: boolean; onDone: () => void }) {
  switch (beat.kind) {
    case 'typewriter':
      return <Typewriter ops={beat.ops} skip={frozen || skip} onDone={onDone} color="cyanBright" />;
    case 'scene':
      return <SceneView beat={beat} frozen={frozen} skip={skip} onDone={onDone} />;
    case 'share':
      return <ShareView beat={beat} frozen={frozen} onDone={onDone} />;
  }
}

function Line({ l }: { l: SceneLine }) {
  return (
    <Text color={l.color} dimColor={l.dim} bold={l.bold} italic={l.italic}>
      {l.text}
    </Text>
  );
}

function SceneView({ beat, frozen, skip, onDone }: { beat: Beat & { kind: 'scene' }; frozen?: boolean; skip?: boolean; onDone: () => void }) {
  // A streamed scene (e.g. THE DIAGNOSIS) types its reveal first, then shows the graph
  // once the typing settles. Non-streamed scenes keep the original timed reveal.
  const hasStream = !!(beat.stream && beat.stream.length);
  const [streamDone, setStreamDone] = useState(!hasStream || !!frozen);
  useEffect(() => {
    if (hasStream) return; // the Typewriter's onDone drives the transition instead
    const t = setTimeout(onDone, frozen ? 0 : 480);
    return () => clearTimeout(t);
  }, []);
  return (
    <Box flexDirection="column">
      {beat.header ? (
        <Text color="gray" bold>
          {beat.header}
        </Text>
      ) : null}
      {hasStream ? (
        <Typewriter
          ops={beat.stream!}
          skip={frozen || skip}
          color="redBright"
          onDone={() => {
            setStreamDone(true);
            onDone();
          }}
        />
      ) : (
        beat.lines.filter((l) => l.text).map((l, i) => <Line key={i} l={l} />)
      )}
      {beat.graph && streamDone ? (
        <Box marginTop={1} flexDirection="column">
          <GraphView graph={beat.graph} animate={!frozen} />
        </Box>
      ) : null}
    </Box>
  );
}

function GraphView({ graph, animate }: { graph: Graph; animate: boolean }) {
  if (graph.type === 'clock') return <Clock hours={graph.hours} />;
  if (graph.type === 'gauge') return <Gauge score={graph.score} label={graph.label} caption={graph.caption} />;
  return <BarChart rows={graph.rows} animate={animate} barColor={graph.barColor} />;
}

/** A red→yellow→green sanity gauge. Filled length AND colour both signal how bad it is. */
function Gauge({ score, label, caption }: { score: number; label: string; caption?: string }) {
  const W = 30;
  const filled = Math.max(1, Math.round((score / 100) * W));
  const zoneColor = (i: number) => (i / W < 0.34 ? 'red' : i / W < 0.67 ? 'yellow' : 'green');
  const scoreColor = score < 34 ? 'redBright' : score < 67 ? 'yellow' : 'greenBright';
  return (
    <Box flexDirection="column">
      {caption ? (
        <Text color="gray" bold>
          {caption}
        </Text>
      ) : null}
      <Text>
        {Array.from({ length: W }, (_, i) => (
          <Text key={i} color={i < filled ? zoneColor(i) : 'gray'} dimColor={i >= filled}>
            {i < filled ? '█' : '░'}
          </Text>
        ))}
      </Text>
      <Text color={scoreColor} bold>
        {`  ${score}/100 — ${label}`}
      </Text>
    </Box>
  );
}

function ShareView({ beat, frozen, onDone }: { beat: Beat & { kind: 'share' }; frozen?: boolean; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!frozen) setCopied(copyToClipboard(beat.recap));
    const t = setTimeout(onDone, 0);
    return () => clearTimeout(t);
  }, []);
  const divider = '─'.repeat(46);
  return (
    <Box flexDirection="column">
      {beat.lines.map((l, i) => (
        <Line key={i} l={l} />
      ))}
      <Text color="gray" dimColor>
        {divider}
      </Text>
      {beat.recap.split('\n').map((line, i) => (
        // Ink gives an empty <Text> zero height, collapsing the blank lines that
        // separate sections — render a space so the gaps actually show.
        <Text key={i} color="greenBright">
          {line === '' ? ' ' : line}
        </Text>
      ))}
      <Text color="gray" dimColor>
        {divider}
      </Text>
      {!frozen ? (
        <Text color={copied ? 'green' : 'yellow'}>
          {copied ? '✓ copied to your clipboard. go on, post it.' : '(couldn’t reach your clipboard — copy the lines above)'}
        </Text>
      ) : null}
    </Box>
  );
}
