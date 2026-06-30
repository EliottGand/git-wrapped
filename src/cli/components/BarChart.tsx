import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export interface BarRow {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
}

/** Horizontal bar chart. Bars grow from 0 → full on mount unless `animate` is false. */
export function BarChart({
  rows,
  width = 26,
  animate = true,
  barColor = 'cyan',
  labelColor = 'gray',
}: {
  rows: BarRow[];
  width?: number;
  animate?: boolean;
  barColor?: string;
  /** Colour of the row labels. Defaults to gray; the hype meter uses white. */
  labelColor?: string;
}) {
  const [frac, setFrac] = useState(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    let f = 0;
    const id = setInterval(() => {
      f += 0.14;
      if (f >= 1) {
        f = 1;
        clearInterval(id);
      }
      setFrac(f);
    }, 22);
    return () => clearInterval(id);
  }, []);

  const max = Math.max(1, ...rows.map((r) => r.value));
  const labelW = Math.min(20, Math.max(...rows.map((r) => r.label.length)));

  return (
    <Box flexDirection="column">
      {rows.map((r, i) => {
        const full = Math.round((r.value / max) * width);
        const filled = Math.max(r.value > 0 ? 1 : 0, Math.round(full * frac));
        const label = r.label.length > labelW ? r.label.slice(0, labelW - 1) + '…' : r.label.padEnd(labelW);
        return (
          <Text key={i}>
            <Text color={labelColor}>{label} </Text>
            <Text color={r.color ?? barColor}>{'█'.repeat(filled)}</Text>
            <Text color="gray" dimColor>
              {'░'.repeat(Math.max(0, width - filled))}
            </Text>
            <Text color="white"> {r.suffix ?? String(r.value)}</Text>
          </Text>
        );
      })}
    </Box>
  );
}
