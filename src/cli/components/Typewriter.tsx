import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from 'ink';

/** A scripted typing sequence. The persona types, pauses, and backspaces to "rethink". */
export type TypeOp =
  | { t: 'type'; text: string; cps?: number } // characters per second
  | { t: 'del'; n: number; cps?: number } // backspace n chars
  | { t: 'pause'; ms: number }
  | { t: 'nl' };

interface Micro {
  apply: (s: string) => string;
  delay: number;
}

function flatten(ops: TypeOp[]): Micro[] {
  const micros: Micro[] = [];
  for (const op of ops) {
    if (op.t === 'type') {
      const d = 1000 / (op.cps ?? 42);
      for (const ch of op.text) micros.push({ apply: (s) => s + ch, delay: d });
    } else if (op.t === 'del') {
      const d = 1000 / (op.cps ?? 55);
      for (let i = 0; i < op.n; i++) micros.push({ apply: (s) => s.slice(0, -1), delay: d });
    } else if (op.t === 'pause') {
      micros.push({ apply: (s) => s, delay: op.ms });
    } else {
      micros.push({ apply: (s) => s + '\n', delay: 110 });
    }
  }
  return micros;
}

/** The final settled text of a sequence — used for frozen re-render and plain output. */
export function typewriterFinal(ops: TypeOp[]): string {
  return flatten(ops).reduce((s, m) => m.apply(s), '');
}

export function Typewriter({
  ops,
  skip,
  onDone,
  color,
}: {
  ops: TypeOp[];
  skip?: boolean;
  onDone?: () => void;
  color?: string;
}) {
  const micros = useMemo(() => flatten(ops), [ops]);
  const final = useMemo(() => micros.reduce((s, m) => m.apply(s), ''), [micros]);
  const [display, setDisplay] = useState(skip ? final : '');
  const [i, setI] = useState(skip ? micros.length : 0);
  const done = useRef(false);

  // Jump to the end if a skip is requested mid-type.
  useEffect(() => {
    if (skip && i < micros.length) {
      setDisplay(final);
      setI(micros.length);
    }
  }, [skip]);

  useEffect(() => {
    if (i >= micros.length) {
      if (!done.current) {
        done.current = true;
        onDone?.();
      }
      return;
    }
    const m = micros[i]!;
    const t = setTimeout(() => {
      setDisplay((d) => m.apply(d));
      setI((x) => x + 1);
    }, m.delay);
    return () => clearTimeout(t);
  }, [i, micros]);

  const typing = i < micros.length;
  return (
    <Text color={color}>
      {display}
      {typing ? <Text color="gray">▌</Text> : null}
    </Text>
  );
}
