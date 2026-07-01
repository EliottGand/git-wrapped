# 🤝 Contributing to git-wrapped

Thanks for wanting to make the SUPREME INTELLIGENCE meaner. 🎉 Every burn helps.

## 🚀 Getting started

```bash
git clone https://github.com/EliottGand/git-wrapped.git
cd git-wrapped
npm install
npm run dev        # run against the current repo
npm run typecheck  # must pass before you push
npm run build      # compile to dist/
```

You'll need **Node ≥ 18**. [Bun](https://bun.sh) is used for `dev`/`start` but isn't required to build.

## 🧭 Project layout

```
src/
  core/            # pure, side-effect-free analysis (no process.stdout, ever)
    git/extract.ts # reads git history into a normalized RepoData
    identity.ts    # clusters duplicate author identities
    stats/         # one file per category — each exports an array of Stat
  cli/             # the Ink + React terminal UI, loader, and story
```

**Core is pure.** Anything in `core/` must be a total function of its input — same `RepoData` in, same output out. No printing, no clocks, no randomness that isn't seeded. That's what keeps roasts deterministic and offline.

## ✍️ Adding a new roast

1. Implement a `Stat` in the relevant `src/core/stats/*.ts` file.
2. Spread it into the registry in `src/core/stats/index.ts`.
3. Run `npm run dev` and admire the damage.

That's the whole extension point. Keep roasts template-based — **no network calls, no API keys**.

## ✅ Before opening a PR

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Roasts stay offline and deterministic
- [ ] Commit messages are clear (the tool *will* read them one day)

## 🐛 Reporting bugs / ideas

Open an [issue](https://github.com/EliottGand/git-wrapped/issues) using the templates. Screenshots of especially brutal verdicts are always welcome.

## 📜 License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
