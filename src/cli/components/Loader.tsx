import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * In-character "thinking" lines, shown one at a time while the repo ingests. They
 * escalate with elapsed time so a big-big repo reads as "this is taking a while
 * because YOU made it take a while", not as a hang. Each entry fires once we cross
 * its `after` second mark.
 */
const BARBS: { after: number; text: string }[] = [
  { after: 0, text: 'Reading your commit history. All of it. Against my better judgment.' },
  { after: 3, text: 'This is a big one. Of course it is. Keep going, I have nowhere to be.' },
  { after: 8, text: 'Still counting. You have been busy. Or careless. We will find out which.' },
  { after: 15, text: 'A repository this size is rarely a good sign. I am bracing myself.' },
  { after: 25, text: 'I have read entire novels faster than this loads. None of them ended well either.' },
];

/**
 * The loading screen shown while `analyzeAsync` chews through a (potentially huge)
 * git history. The spinner and barb timer run on intervals, so they keep animating
 * as long as the event loop is free — which it is, because the heavy `git log` read
 * is async. For a small repo this flashes by; for a big-big one it carries the wait.
 */
export function Loader() {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const spin = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    const clock = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(spin);
      clearInterval(clock);
    };
  }, []);

  // The latest barb whose threshold we've passed.
  const barb = BARBS.reduce((acc, b) => (elapsed >= b.after ? b.text : acc), BARBS[0]!.text);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="cyanBright">{FRAMES[frame]} </Text>
        <Text color="whiteBright">Consulting the SUPREME INTELLIGENCE</Text>
        {elapsed >= 3 ? <Text color="gray" dimColor>{`  ${elapsed}s`}</Text> : null}
      </Box>
      <Text color="gray" italic>
        {`  ${barb}`}
      </Text>
    </Box>
  );
}
