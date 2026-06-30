# git-roast

> Spotify Wrapped, but it roasts your git repo — narrated by a deeply unimpressed SUPREME INTELLIGENCE.

`git-roast` reads everything your git history accidentally confesses — who hoards
the commits, which file keeps breaking, who codes at 3am, whose commit messages were
*clearly* written by an AI — and serves it back as ~20+ stat cards wrapped in
condescending commentary.

```bash
# run it on any repo, no install:
bunx @eliottgdl/git-roast /path/to/any/repo   # or npx @eliottgdl/git-roast

# or hack on it locally:
npm install
npm run build
node dist/cli/index.js /path/to/any/repo       # or just `git-roast` once linked
```

Flags:

- `git-roast [path]` — analyze a repo (defaults to the current directory)
- `git-roast --plain` — skip the animated persona (also auto-used when piped)
- `git-roast --help`

## Architecture: the portability boundary

The whole point of the layout is that **the logic is portable** and only the
presentation is TypeScript-specific. A future Go/Rust/Python port re-implements the
CLI layer against the same stat contracts.

```
src/
├── core/                 # PURE. No ink, no chalk, no process.stdout.
│   ├── types.ts          # Commit / RepoData / Stat / StatResult contracts
│   ├── git/extract.ts    # the ONLY impure file — shells out to git → RepoData
│   ├── stats/            # each stat is a pure (RepoData) => StatResult | null
│   │   ├── index.ts      # the registry (add new stats here)
│   │   ├── helpers.ts    # shared pure helpers + templated-roast picker
│   │   ├── overview.ts   ├── people.ts   ├── habits.ts
│   │   ├── messages.ts   └── smells.ts
│   └── analyze.ts        # extract → run all stats → results + persona commentary
└── cli/                  # presentation ONLY — imports core, renders with ink
    ├── index.tsx         # entry, arg parsing, --plain fallback
    ├── App.tsx           # phased reveal (drip commentary → cascading cards)
    ├── persona.ts        # the SUPREME INTELLIGENCE's voice + ASCII faces
    └── components/StatCard.tsx
```

**The contract:** stats are pure functions of a normalized `RepoData`. The only code
that touches `git` is `core/git/extract.ts`. Roasts are templated (offline,
deterministic) and co-located with the stat that produces them.

## Adding a stat

1. Write a `Stat` in the appropriate `core/stats/*.ts` file:

```ts
const myStat: Stat = {
  id: 'my-stat',
  title: 'The Thing',
  category: 'habits',
  compute(repo) {
    // pure: read repo.commits / repo.trackedFiles / repo.currentUser
    if (/* not applicable */ false) return null;   // null = skip cleanly
    return {
      id: this.id, title: this.title, category: this.category,
      headline: 'the factual number',
      roast: roastByTier(value, [
        { min: 100, template: 'savage tier ({n})' },
        { min: 0,   template: 'mild tier ({n})' },
      ]),
    };
  },
};
```

2. Export it from that file's array and make sure the array is spread into
   `core/stats/index.ts → ALL_STATS`. Done — it shows up in the CLI automatically.

## The stats (so far)

**Scoreboard:** Repo Birthday · The Scoreboard (commits/lines/humans) · Polyglot Report · The Ghosts (one-commit-and-vanished)
**Power & people:** The Workhorse · Your Kingdom (the dir *you* rule) · The Config Whisperer · The Destroyer (most deletions) · The Self-Merger
**Habits:** The Night Owl · Weekend Warrior · Friday Afternoon Cowboy · The Day It All Happened · The Great Silence (longest gap)
**Message forensics:** Minimalist Poet · Mr. Fix-It · WIP King · The Sailor (profanity) · The Apologizer · The Reverter · Typo Hunter · Emoji Enthusiast · The Monologue
**Evidence / crime scenes:** The Robot Detector (AI tells) · The Cursed File (most churn) · The Fix Magnet (most fixes) · The Big Bang Commit · The final_v2_FINAL Award · The Bus Factor

## Roadmap

- Content-scan tier (needs reading working-tree files): `console.log`/`print` shame,
  `TODO`/`FIXME` counts per author via blame, commented-out-code detector.
- Per-author blame attribution for Kingdom / Bus Factor (currently commit-touch based).
- `--html` shareable scrollytelling page (The Pudding style).
- `--json` output for piping into other tools.
