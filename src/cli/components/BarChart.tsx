import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export interface BarRow {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
  /** Fade the whole row (label + bar + text) so foreground rows stand out against it. */
  dim?: boolean;
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
        return (
          // Reserve a fixed-width column for the label so bars start on the same
          // column across rows. Using an ink Box (not manual .padEnd) means the
          // width is measured in terminal cells, so double-width glyphs like the
          // hype-meter emoji (📈 🌿 🦕) don't knock the bars out of alignment.
          <Box key={i}>
            <Box width={labelW} flexShrink={0} flexGrow={0}>
              <Text color={r.dim ? 'gray' : labelColor} dimColor={r.dim} wrap="truncate">
                {r.label}
              </Text>
            </Box>
            <Text>
              <Text color={r.color ?? barColor} dimColor={r.dim}> {'█'.repeat(filled)}</Text>
              <Text color="gray" dimColor>
                {'░'.repeat(Math.max(0, width - filled))}
              </Text>
              <Text color={r.dim ? 'gray' : 'white'} dimColor={r.dim}> {r.suffix ?? String(r.value)}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
