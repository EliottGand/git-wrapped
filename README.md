<div align="center">

# 🎁 git-wrapped

### 🎧 Spotify Wrapped for your git repo, narrated by a deeply unimpressed **SUPREME INTELLIGENCE**.

[![npm version](https://img.shields.io/npm/v/@eliottgdl/git-wrapped?color=cb3837&logo=npm)](https://www.npmjs.com/package/@eliottgdl/git-wrapped)
[![npm downloads](https://img.shields.io/npm/dm/@eliottgdl/git-wrapped?color=cb3837&logo=npm)](https://www.npmjs.com/package/@eliottgdl/git-wrapped)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![offline first](https://img.shields.io/badge/AI-100%25%20offline-black)](#-what-it-reads)

</div>

---

## ⚡ Try it now

```bash
bunx @eliottgdl/git-wrapped        # 🐰 or: npx @eliottgdl/git-wrapped
```

Runs on the repo you're standing in. No install, no signup, no config. One command and you're on trial.

## 🔒 What it reads

Your local `git log`. Nothing else. No API keys, no account, no network. The roasts are templated and run entirely on your machine. The judgment is offline. So is the shame.

## 🎬 What it does to you

An animated recap that marches your repo through the stations of judgment, then hands you a clipboard-ready summary built for the team channel:

- 🌙 **Who works at night.** Counted in each commit's *own* timezone, so a 2 a.m. commit is 2 a.m. for *them*. The moon is now a code reviewer.
- ⭐ **Who's clearly the main character.** One person wrote most of this and we both know who. THE PROTAGONIST gets a chapter. Everyone else is credited.
- 🩸 **How hard you're chasing worst practices.** A sanity score out of 100, with every `wip`, `asdf`, panic-fix and haunted file entered into evidence. Press `d` for the full breakdown.
- 🏆 **The awards.** 🦇 Batman (never sleeps), 🚒 Firefighter (only shows up for fires), 🧹 Janitor (cleans up after everyone). Purely honorary. Deeply revealing.

Same repo in, same roast out. It's deterministic. Your shame is reproducible.

## 🎛️ Options

```bash
git-wrapped /path/to/repo        # 🎯 judge a repo you don't live in
git-wrapped --years 2            # ⏳ only the last 2 years admissible in court
git-wrapped --since "6 months ago"   # 🗓️  any git date works
git-wrapped --plain              # 📃 no animation (auto-on when piped)
git-wrapped --help               # 🆘 it explains itself, reluctantly
```

## 🧠 How it works

A pure `core/` that never touches stdout, feeding one normalized `RepoData` into a registry of roasts. An identity pass clusters authors by shared email or name tokens, so `COLAS Alexandre` and `Alexandre Colas` stop being two people. The UI is [Ink](https://github.com/vadimdemedes/ink) + React. Adding a roast is a two-line change; see [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/EliottGand/git-wrapped.git && cd git-wrapped
bun install
bun run dev        # ▶️  run against this repo
bun run build      # 📦 compile to dist/
```

## 🧾 The algorithm's honest opinion of this repository

> A 700-line machine built to call other people messy, and it does so with real discipline: pure core, deterministic roasts, offline by design. The self-awareness required to ship that and not flinch is either enlightenment or a symptom. I have not decided which.
>
> **Verdict: 8/10. Would judge again.**

## 📜 License

[MIT](./LICENSE) © [Eliott Gandiolle](https://github.com/EliottGand). PRs and sharper burns welcome.

<div align="center">

⭐ If it roasted you fairly, leave a star. If it roasted you unfairly, *definitely* leave a star.

</div>
