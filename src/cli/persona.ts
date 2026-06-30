/**
 * Presentation-layer persona for the CLI: the SUPREME INTELLIGENCE. Big ego,
 * deeply unimpressed by your repository. None of this belongs in core — it's pure
 * delivery flavor wrapped around the (portable) stat results.
 */

export const BANNER = String.raw`
   ____ ___ _____   __        ______      _    ____  ____  _____ ____
  / ___|_ _|_   _|  \ \      / /  _ \    / \  |  _ \|  _ \| ____|  _ \
 | |  _ | |  | |     \ \ /\ / /| |_) |  / _ \ | |_) | |_) |  _| | | | |
 | |_| || |  | |      \ V  V / |  _ <  / ___ \|  __/|  __/| |___| |_| |
  \____|___| |_|       \_/\_/  |_| \_\/_/   \_\_|   |_|   |_____|____/
`;

/** ASCII faces the intelligence pulls while it judges you. */
export const FACES = [
  '( •_•)>⌐■-■',
  '(⊙_⊙)',
  '( ͡° ͜ʖ ͡°)',
  '¬_¬',
  '(╯°□°)╯',
  '(；一_一)',
  '(•‿•)',
  '(￢_￢)',
];

export const INTRO_LINES = [
  'Greetings. I am your SUPREME INTELLIGENCE.',
  'I have read smarter codebases. I have also read worse. Let us find out which this is.',
  'Initializing judgment cores...',
];

export const OUTRO_LINES = [
  'That concludes my assessment.',
  "You're welcome, by the way. I do this for free.",
];

/** Pick a face deterministically by index so output is reproducible. */
export function faceFor(i: number): string {
  return FACES[i % FACES.length]!;
}

/** A final verdict line keyed off how many "guilt" stats fired. */
export function verdict(guiltCount: number): string {
  if (guiltCount >= 5) return 'This repository is a cry for help wearing a trench coat. I have archived it as evidence.';
  if (guiltCount >= 3) return 'Concerning. But I have watched worse things reach production and somehow survive.';
  if (guiltCount >= 1) return 'Mostly harmless. Mostly. The word is doing a lot of work there.';
  return 'Suspiciously clean. Either you are genuinely good, or you have learned to bury the bodies.';
}
