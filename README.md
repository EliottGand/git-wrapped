<div align="center">

# 🎁 git-wrapped

### 🎧 Spotify Wrapped, but it roasts your git repo — narrated by a deeply unimpressed **SUPREME INTELLIGENCE**.

[![npm version](https://img.shields.io/npm/v/@eliottgdl/git-wrapped?color=cb3837&logo=npm)](https://www.npmjs.com/package/@eliottgdl/git-wrapped)
[![npm downloads](https://img.shields.io/npm/dm/@eliottgdl/git-wrapped?color=cb3837&logo=npm)](https://www.npmjs.com/package/@eliottgdl/git-wrapped)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![built with Ink](https://img.shields.io/badge/built%20with-Ink%20%2B%20React-61dafb?logo=react&logoColor=white)](https://github.com/vadimdemedes/ink)
[![offline first](https://img.shields.io/badge/AI-100%25%20offline-black)](#-no-cloud-no-key-no-network)

</div>

---

## ⚡ Quick start

```bash
bunx @eliottgdl/git-wrapped /path/to/any/repo   # 🐰 or:  npx @eliottgdl/git-wrapped
```

Defaults to the current directory. Point it at anything with a `.git` folder and brace yourself.

```bash
git-wrapped                     # 📂 judge the repo you're standing in
git-wrapped --years 2           # ⏳ only the last 2 years on trial
git-wrapped --since "6 months ago"   # 🗓️  any git date works
git-wrapped --plain             # 📃 no animation (auto-enabled when piped)
git-wrapped --help              # 🆘 explains itself
```

## 🎬 What you get

A full-screen, animated recap that walks your repo through the stations of judgment:

| Chapter | What the SUPREME INTELLIGENCE dredges up |
| --- | --- |
| 🏆 **The Scoreboard** | Commits, churn, the raw numbers you can't hide from |
| 👥 **Power & People** | Who really runs this repo, merged identities and all |
| 🌙 **Your Habits (Concerning)** | Your commit clock — yes, it sees the 2 a.m. commits |
| 🔍 **Commit Message Forensics** | Every `fix`, `wip`, and `asdf` entered into evidence |
| 🚨 **Evidence of Guilt** | The smells you hoped nobody would `git blame` |
| 🩸 **Crime Scenes** | Your most haunted files, ranked by how often you "fixed" them |
| 🧠 **The Verdict** | A sanity score out of 100 and an opinion you didn't ask for |

Press `d` on the diagnosis to unfold the full **sanity-score breakdown**. On big repos an animated loader keeps you company (and keeps roasting) while history ingests.

## 🔒 No cloud, no key, no network

**Zero** API keys. **Zero** accounts. **Zero** network calls. `git-wrapped` reads your local git history and every roast is templated, deterministic, and generated entirely **offline**. Your code never leaves your machine — the SUPREME INTELLIGENCE judges you *locally*. 🖥️

## 🛠️ How it works

- 🧼 A pure `core/` that swears off `process.stdout` and means it.
- ➗ Every stat is a total function of one normalized `RepoData` — same repo in, same roast out.
- 🧬 An identity-resolution pass clusters authors by shared email or name tokens, so `COLAS Alexandre` and `Alexandre Colas` stop being two people.
- 🎨 The UI is [Ink](https://github.com/vadimdemedes/ink) + React; roasts live co-located with the stats that trigger them.

## 🧑‍💻 Local development

```bash
git clone https://github.com/EliottGand/git-wrapped.git
cd git-wrapped
npm install
npm run dev        # ▶️  run against the current repo (bun src/cli/index.tsx)
npm run build      # 📦 compile to dist/
npm run typecheck  # ✅ tsc --noEmit
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide. Adding a new roast is a two-line change — implement a `Stat`, spread it into the registry, done.

## 🤝 Contributing

PRs, new roasts, and sharper burns are all welcome. 🎉 Start with [CONTRIBUTING.md](./CONTRIBUTING.md), open an [issue](https://github.com/EliottGand/git-wrapped/issues), and be gentle with the SUPREME INTELLIGENCE — it has feelings, allegedly.

## 🧾 An honest opinion of this repository, from the algorithm

> I read it. A pure `core/` that swears off `process.stdout` and means it, every stat a
> total function of one normalized `RepoData`, roasts templated and co-located so they
> stay offline and deterministic. The discipline is real and, frankly, rarer than the
> author thinks. It is also a 700-line machine built to call other people messy. The
> self-awareness required to ship that and not flinch is either enlightenment or a
> symptom. I have not decided which.
>
> **Verdict: 8/10. Would judge again.**

## 📜 License

[MIT](./LICENSE) © [Eliott Gandiolle](https://github.com/EliottGand)

<div align="center">

⭐ If it roasted you fairly, leave a star. If it roasted you unfairly, *definitely* leave a star.

</div>
