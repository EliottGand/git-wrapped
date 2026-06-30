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

/**
 * Final verdict lines, keyed off how many "guilt" stats fired. Each tier has several
 * interchangeable punchlines; `seed` picks one so the ending isn't identical every run.
 */
const VERDICTS: Record<'high' | 'mid' | 'low' | 'clean', string[]> = {
  high: [
    'This repository is a cry for help wearing a trench coat. I have archived it as evidence.',
    'I have seen crime scenes with better documentation. This belongs in a museum of warnings.',
    'If this codebase were a patient, I would not resuscitate. I would, however, take notes.',
    'I have reviewed the evidence. My recommendation is a controlled demolition and a fresh `git init`.',
    'This is not a codebase, it is a hostage situation, and the `main` branch is the hostage.',
    'Somewhere a senior engineer felt a chill and does not know why. It was this. This was why.',
  ],
  mid: [
    'Concerning. But I have watched worse things reach production and somehow survive.',
    'Flawed, but functional — like most things that ship. I’ll allow it. Reluctantly.',
    'Not a disaster, not a triumph. A solid, respectable mess. You should be proud-ish.',
    'It holds together. I cannot tell you how, and I would advise you not to look too closely.',
    'Structurally questionable, spiritually fine. It will outlive us both out of sheer spite.',
  ],
  low: [
    'Mostly harmless. Mostly. The word is doing a lot of work there.',
    'Suspiciously competent. I’ll find the rot eventually — I always do.',
    'Tidier than I expected, which only makes me more suspicious.',
    'Few crimes, all minor. The work of someone who reads their own diffs. Unsettling.',
    'Almost respectable. I will need a moment to recover from the disappointment.',
  ],
  clean: [
    'Suspiciously clean. Either you are genuinely good, or you have learned to bury the bodies.',
    'No obvious crimes. Disappointing, frankly — I came here to work.',
    'Clean enough to be smug about. Don’t. Hubris is its own kind of bug.',
    'Immaculate. Which is exactly what a truly careful criminal’s repository would look like.',
    'I found nothing. This is either excellence or the single most elaborate cover-up I have audited.',
  ],
};

/** A final verdict line keyed off how many "guilt" stats fired. `seed` rotates the wording. */
export function verdict(guiltCount: number, seed = 0): string {
  const tier = guiltCount >= 5 ? 'high' : guiltCount >= 3 ? 'mid' : guiltCount >= 1 ? 'low' : 'clean';
  const pool = VERDICTS[tier];
  return pool[Math.abs(Math.floor(seed)) % pool.length]!;
}
