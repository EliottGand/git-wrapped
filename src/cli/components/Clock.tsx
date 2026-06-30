import { Box, Text } from 'ink';

const TICKS = '▁▂▃▄▅▆▇█';
const isNight = (h: number) => h >= 22 || h <= 5;

/** A 24-hour sparkline of commit activity. Night hours (22:00–05:59) glow red. */
export function Clock({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <Box flexDirection="column">
      <Text>
        {hours.map((h, i) => {
          const lvl = h === 0 ? 0 : Math.max(1, Math.round((h / max) * (TICKS.length - 1)));
          return (
            <Text key={i} color={isNight(i) ? 'redBright' : 'cyanBright'}>
              {TICKS[lvl]}
            </Text>
          );
        })}
      </Text>
      <Text color="gray" dimColor>
        00h····06h····12h····18h··23h
      </Text>
      <Text color="gray" dimColor>
        <Text color="redBright">█</Text> = the small hours (10pm–6am) · <Text color="cyanBright">█</Text> = daylight, like a normal person
      </Text>
    </Box>
  );
}
