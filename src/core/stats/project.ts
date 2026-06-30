/**
 * Project-shaped roasts: the tech stack on trial, the self-imposed rulebook
 * (pre-commit hooks, linters, static analysis, coverage gates), and the graveyard
 * of TODO/FIXME markers. All pure — they read `repo.signalFiles`, `repo.trackedFiles`
 * and `repo.markers`, which `git/extract.ts` filled in.
 *
 * Deliberately polyglot: detection spans JS/TS, Python, Go, Rust, Java/Kotlin, PHP,
 * Ruby, .NET, Elixir and Dart, via language manifests (read from anywhere in the tree),
 * config-file presence, and file extensions — not just `package.json`.
 */
import type { RepoData, Stat } from '../types.js';
import { basename, ext, roastByTier } from './helpers.js';

/* ─────────────────── signal-file access helpers ─────────────────── */

/** Contents of every signal file whose basename matches `re`. */
function filesByBase(repo: RepoData, re: RegExp): string[] {
  const out: string[] = [];
  for (const [path, content] of Object.entries(repo.signalFiles)) {
    if (re.test(basename(path))) out.push(content);
  }
  return out;
}

/** True if any signal file basename matches `re`. */
function hasFile(repo: RepoData, re: RegExp): boolean {
  return Object.keys(repo.signalFiles).some((p) => re.test(basename(p)));
}

/** True if any tracked path matches `re` (presence checks needing no content). */
function tracked(repo: RepoData, re: RegExp): boolean {
  return repo.trackedFiles.some((f) => re.test(f));
}

const MANIFEST_BASE_RE = /^(package\.json|pyproject\.toml|setup\.cfg|tox\.ini|Pipfile|requirements[^/]*\.txt|pom\.xml|build\.gradle(\.kts)?|composer\.json|Gemfile|Cargo\.toml|go\.mod|mix\.exs|pubspec\.yaml|.+\.csproj)$/;

/** One big haystack of every dependency manifest, for cheap regex sniffing. */
function manifestHay(repo: RepoData): string {
  return filesByBase(repo, MANIFEST_BASE_RE).join('\n');
}

/** Contents of manifests with a given basename, joined (e.g. all pom.xml files). */
function manifestText(repo: RepoData, re: RegExp): string {
  return filesByBase(repo, re).join('\n');
}

/* ───────────────────────── tech stack ───────────────────────── */

interface TechHit { name: string; roast: string; prio: number }

/** npm dependency-name → roast. Matched against package.json dep keys. */
const DEP_TECH: { keys: string[]; name: string; roast: string; prio: number }[] = [
  { keys: ['next'], name: 'Next.js', roast: 'Next.js — server, client, edge, and static: four ways to render the same div that still jumps on load.', prio: 92 },
  { keys: ['nuxt'], name: 'Nuxt', roast: 'Nuxt. Next.js, but you wanted to feel European about it.', prio: 92 },
  { keys: ['@angular/core', '@angular'], name: 'Angular', roast: 'Angular. Enterprise cosplay. You wrote three modules and a service to render "Hello".', prio: 91 },
  { keys: ['vue'], name: 'Vue', roast: 'Vue. React for people who actually read the docs. Smug, but fair.', prio: 90 },
  { keys: ['svelte'], name: 'Svelte', roast: 'Svelte. A framework that compiles itself away, much like your motivation.', prio: 90 },
  { keys: ['react'], name: 'React', roast: 'React. Components nested ten deep and a useEffect that fires twice just to keep you humble.', prio: 89 },
  { keys: ['@nestjs/core', '@nestjs'], name: 'NestJS', roast: 'NestJS. Angular snuck into your backend while you weren’t looking.', prio: 80 },
  { keys: ['fastify'], name: 'Fastify', roast: 'Fastify. Express, but you read one benchmark and never recovered.', prio: 78 },
  { keys: ['express'], name: 'Express', roast: 'Express. A 2010 router you keep on life support out of pure fear of the rewrite.', prio: 78 },
  { keys: ['jquery'], name: 'jQuery', roast: 'jQuery. In this economy? The fossil layer of your dependency tree.', prio: 76 },
  { keys: ['@reduxjs/toolkit', 'redux'], name: 'Redux', roast: 'Redux — 47 files of boilerplate standing guard over a single boolean.', prio: 70 },
  { keys: ['mobx'], name: 'MobX', roast: 'MobX. Magic reactivity you’ll spend an entire sprint un-magicking.', prio: 66 },
  { keys: ['@apollo/client', 'apollo-server', 'graphql'], name: 'GraphQL', roast: 'GraphQL. Now you over-fetch in a new and exciting way.', prio: 68 },
  { keys: ['@prisma/client', 'prisma'], name: 'Prisma', roast: 'Prisma. An ORM that generates more code than you will ever delete.', prio: 66 },
  { keys: ['mongoose'], name: 'Mongoose', roast: 'Mongoose on MongoDB. Schemas for the schemaless. Pick a lane.', prio: 64 },
  { keys: ['typeorm', 'sequelize'], name: 'an ORM', roast: 'An ORM, because raw SQL was scary, so you chose a different, slower scary.', prio: 62 },
  { keys: ['tailwindcss'], name: 'Tailwind', roast: 'Tailwind. Inline styles wearing a fake moustache and a build step.', prio: 60 },
  { keys: ['styled-components'], name: 'styled-components', roast: 'styled-components. CSS-in-JS, runtime cost included at no extra charge.', prio: 56 },
  { keys: ['bootstrap'], name: 'Bootstrap', roast: 'Bootstrap. Every site looks the same. Including, now, yours.', prio: 54 },
  { keys: ['electron'], name: 'Electron', roast: 'Electron. Why ship an app when you can ship an entire browser pretending to be one?', prio: 72 },
  { keys: ['webpack'], name: 'webpack', roast: 'A webpack config nobody alive understands, copied wholesale from a 2018 Stack Overflow answer.', prio: 52 },
  { keys: ['vite'], name: 'Vite', roast: 'Vite. Blazing fast — right up until the one plugin that isn’t.', prio: 50 },
  { keys: ['@babel/core', 'babel-core'], name: 'Babel', roast: 'Babel, still transpiling syntax browsers shipped years ago. Old habits.', prio: 48 },
  { keys: ['vitest'], name: 'Vitest', roast: 'Vitest. Jest, but you wanted to feel new again.', prio: 46 },
  { keys: ['jest'], name: 'Jest', roast: 'Jest. Tests that pass locally and absolutely nowhere else.', prio: 46 },
  { keys: ['lodash', 'lodash-es'], name: 'lodash', roast: 'lodash, imported for `_.get`. The standard library is right there. Free. Included.', prio: 44 },
  { keys: ['moment'], name: 'moment.js', roast: 'moment.js — 300KB, officially deprecated, still imported. A museum you refuse to leave.', prio: 58 },
  { keys: ['axios'], name: 'axios', roast: 'axios. `fetch` has existed for years now. It’s okay. You can let go.', prio: 42 },
  { keys: ['typescript'], name: 'TypeScript', roast: 'TypeScript — you wanted Java but were too cool to say so. `any` count: classified.', prio: 64 },
];

/**
 * Manifest-content → framework roast. Each is scoped to a manifest basename so the
 * regex only fires for the right ecosystem. This is where Go/Java/PHP/Rust/Ruby/
 * Python/Elixir/Dart frameworks get detected — not just npm.
 */
const MANIFEST_TECH: { base: RegExp; re: RegExp; name: string; roast: string; prio: number }[] = [
  // Go
  { base: /^go\.mod$/, re: /gin-gonic\/gin/, name: 'Gin', roast: 'Gin (Go). A web framework whose flagship feature is not being the standard library.', prio: 84 },
  { base: /^go\.mod$/, re: /labstack\/echo/, name: 'Echo', roast: 'Echo. Go’s other identical web framework. You flipped a coin and lost either way.', prio: 84 },
  { base: /^go\.mod$/, re: /gofiber\/fiber/, name: 'Fiber', roast: 'Fiber. Express nostalgia, ported to Go by someone who clearly missed Node.', prio: 82 },
  { base: /^go\.mod$/, re: /gorm\.io\/gorm/, name: 'GORM', roast: 'GORM. You came to Go to escape magic, then imported an ORM on day two.', prio: 78 },
  { base: /^go\.mod$/, re: /spf13\/cobra/, name: 'Cobra', roast: 'Cobra. Six hundred lines of scaffolding so your CLI can print `--help`.', prio: 72 },
  // Java / Kotlin
  { base: /^(pom\.xml|build\.gradle(\.kts)?)$/, re: /springframework|spring-boot/i, name: 'Spring', roast: 'Spring. A dependency-injection framework that injected itself into your entire life.', prio: 86 },
  { base: /^(pom\.xml|build\.gradle(\.kts)?)$/, re: /quarkus/i, name: 'Quarkus', roast: 'Quarkus. "Supersonic, subatomic Java." The tagline is doing Olympic-level lifting.', prio: 82 },
  { base: /^(pom\.xml|build\.gradle(\.kts)?)$/, re: /micronaut/i, name: 'Micronaut', roast: 'Micronaut. Spring, but you wanted something to argue about at meetups.', prio: 80 },
  { base: /^(pom\.xml|build\.gradle(\.kts)?)$/, re: /hibernate/i, name: 'Hibernate', roast: 'Hibernate. Turns one query into nine and one deadline into a 3am page.', prio: 74 },
  { base: /^(pom\.xml|build\.gradle(\.kts)?)$/, re: /lombok/i, name: 'Lombok', roast: 'Lombok. Annotations that generate the Java you refuse to type. Honest, at least.', prio: 60 },
  // PHP
  { base: /^composer\.json$/, re: /laravel\//i, name: 'Laravel', roast: 'Laravel. PHP that went to a bootcamp and came back with opinions and a newsletter.', prio: 84 },
  { base: /^composer\.json$/, re: /symfony\//i, name: 'Symfony', roast: 'Symfony. Enterprise PHP — yes, all three of those words, at the same time.', prio: 82 },
  { base: /^composer\.json$/, re: /wordpress|wp-/i, name: 'WordPress', roast: 'WordPress. 40% of the web, 100% of your plugin-update anxiety.', prio: 78 },
  { base: /^composer\.json$/, re: /slim\/slim/i, name: 'Slim', roast: 'Slim. A micro-framework you will absolutely outgrow by sprint three.', prio: 70 },
  // Ruby
  { base: /^Gemfile$/, re: /['"]rails['"]|\brails\b/i, name: 'Rails', roast: 'Rails. Convention over configuration; convention over your free evenings.', prio: 84 },
  { base: /^Gemfile$/, re: /sinatra/i, name: 'Sinatra', roast: 'Sinatra. Rails for people who swear this app will stay small. It will not.', prio: 76 },
  // Rust
  { base: /^Cargo\.toml$/, re: /\bactix-web\b/, name: 'Actix', roast: 'Actix. Blazing-fast Rust web — and it will remind you of the benchmark constantly.', prio: 82 },
  { base: /^Cargo\.toml$/, re: /\baxum\b/, name: 'Axum', roast: 'Axum. Async Rust web; the compiler will see you in roughly nine minutes.', prio: 82 },
  { base: /^Cargo\.toml$/, re: /\brocket\b/, name: 'Rocket', roast: 'Rocket. Required nightly Rust for years — now that’s commitment.', prio: 80 },
  { base: /^Cargo\.toml$/, re: /\btokio\b/, name: 'Tokio', roast: 'Tokio. Async Rust: every function turns red, and so do your eyes.', prio: 70 },
  { base: /^Cargo\.toml$/, re: /\bbevy\b/, name: 'Bevy', roast: 'Bevy. You’re writing a game engine. The game itself remains theoretical.', prio: 72 },
  // Python (frameworks; language itself handled separately)
  { base: /^(requirements[^/]*\.txt|pyproject\.toml|Pipfile|setup\.cfg)$/, re: /\bdjango\b/i, name: 'Django', roast: 'Django. Batteries included; the batteries are strongly-held opinions.', prio: 86 },
  { base: /^(requirements[^/]*\.txt|pyproject\.toml|Pipfile|setup\.cfg)$/, re: /\bfastapi\b/i, name: 'FastAPI', roast: 'FastAPI. Fast to write, async all the way down into the abyss.', prio: 84 },
  { base: /^(requirements[^/]*\.txt|pyproject\.toml|Pipfile|setup\.cfg)$/, re: /\bflask\b/i, name: 'Flask', roast: 'Flask. Minimal — right up until you bolt on the other forty extensions.', prio: 82 },
  { base: /^(requirements[^/]*\.txt|pyproject\.toml|Pipfile|setup\.cfg)$/, re: /tensorflow|\btorch\b|pytorch|\bpandas\b|\bnumpy\b|scikit/i, name: 'a Python ML stack', roast: 'A Python ML stack. Half a gigabyte of wheels to multiply two matrices together.', prio: 80 },
  // Elixir / Dart
  { base: /^mix\.exs$/, re: /:phoenix\b/, name: 'Phoenix', roast: 'Phoenix (Elixir). Real-time everything; hireable-for nothing.', prio: 84 },
  { base: /^pubspec\.yaml$/, re: /flutter/i, name: 'Flutter', roast: 'Flutter. One codebase, two app stores, three new widget types since you started reading this.', prio: 84 },
  // .NET
  { base: /\.csproj$/, re: /Microsoft\.AspNetCore|Sdk="Microsoft\.NET\.Sdk\.Web"/i, name: 'ASP.NET', roast: 'ASP.NET. Enterprise C#. It works, it’s fine, and nobody has ever tweeted about it.', prio: 82 },
];

/** File-extension → language roast, used when the manifest doesn’t already name it. */
const LANG_TECH: Record<string, { name: string; roast: string }> = {
  py: { name: 'Python', roast: 'Python. Whitespace-enforced discipline for the chronically undisciplined.' },
  go: { name: 'Go', roast: 'Go. You’ve typed `if err != nil` more times than you’ve said your own name.' },
  rs: { name: 'Rust', roast: 'Rust. The borrow checker rejects you more reliably than anyone you’ve dated.' },
  rb: { name: 'Ruby', roast: 'Ruby. Beautiful, expressive, and quietly 40% of your cloud bill.' },
  php: { name: 'PHP', roast: 'PHP. Unkillable, like a horror villain that learned to use a package manager.' },
  java: { name: 'Java', roast: 'Java. AbstractSingletonProxyFactoryBean. That’s the whole joke. It writes itself.' },
  kt: { name: 'Kotlin', roast: 'Kotlin. Java after therapy.' },
  swift: { name: 'Swift', roast: 'Swift. The syntax changes every WWDC, purely to keep you humble.' },
  c: { name: 'C', roast: 'C. Manual memory management — your segfaults are artisanal, hand-crafted.' },
  cpp: { name: 'C++', roast: 'C++. A language so vast no two people use the same half of it.' },
  cs: { name: 'C#', roast: 'C#. Java, but Microsoft, but annoyingly fine, actually.' },
  scala: { name: 'Scala', roast: 'Scala. You implemented a monad to add two numbers together.' },
  ex: { name: 'Elixir', roast: 'Elixir. Functional, concurrent, and completely impossible to hire for.' },
  dart: { name: 'Dart', roast: 'Dart. A language with exactly one customer, and that customer is Flutter.' },
  sh: { name: 'shell scripts', roast: 'Shell scripts. Held together by `set -e` and prayer.' },
  lua: { name: 'Lua', roast: 'Lua. Tables all the way down. Arrays start at 1, joy ends there.' },
  js: { name: 'JavaScript', roast: 'JavaScript. It says yes to everything — including your worst ideas, at runtime, in prod.' },
};

const EXT_ALIAS: Record<string, string> = {
  jsx: 'js', mjs: 'js', cjs: 'js',
  hpp: 'cpp', cxx: 'cpp', hh: 'cpp', cc: 'cpp',
  bash: 'sh', zsh: 'sh',
  exs: 'ex',
};

function parsePackageDeps(repo: RepoData): Set<string> {
  const out = new Set<string>();
  for (const pkg of filesByBase(repo, /^package\.json$/)) {
    try {
      const json = JSON.parse(pkg) as Record<string, unknown>;
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const deps = json[field];
        if (deps && typeof deps === 'object') {
          for (const k of Object.keys(deps as Record<string, unknown>)) out.add(k.toLowerCase());
        }
      }
    } catch {
      // not valid JSON — skip
    }
  }
  return out;
}

function detectTechs(repo: RepoData): TechHit[] {
  const hits: TechHit[] = [];
  const seen = new Set<string>();
  const add = (name: string, roast: string, prio: number) => {
    if (seen.has(name)) return;
    seen.add(name);
    hits.push({ name, roast, prio });
  };

  // 1. npm dependencies.
  const deps = parsePackageDeps(repo);
  for (const t of DEP_TECH) {
    if (t.keys.some((k) => deps.has(k) || [...deps].some((d) => d.startsWith(`${k}/`)))) add(t.name, t.roast, t.prio);
  }

  // 2. Frameworks declared in non-npm manifests (Go/Java/PHP/Rust/Ruby/Python/…).
  for (const t of MANIFEST_TECH) {
    if (t.re.test(manifestText(repo, t.base))) add(t.name, t.roast, t.prio);
  }

  // 3. Languages, by file extension (count = how much of the repo it is).
  const extCounts = new Map<string, number>();
  for (const f of repo.trackedFiles) {
    const raw = ext(f);
    if (!raw) continue;
    const e = EXT_ALIAS[raw] ?? raw;
    extCounts.set(e, (extCounts.get(e) ?? 0) + 1);
  }
  if ((extCounts.get('ts') ?? 0) + (extCounts.get('tsx') ?? 0) > 0) add('TypeScript', DEP_TECH.find((d) => d.name === 'TypeScript')!.roast, 64);
  for (const [e, count] of [...extCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const lang = LANG_TECH[e];
    if (lang) add(lang.name, lang.roast, 60 + Math.min(8, Math.floor(count / 20)));
  }

  // 4. Manifest presence implies a language even when few source files are tracked.
  if (hasFile(repo, /^go\.mod$/)) add('Go', LANG_TECH.go!.roast, 70);
  if (hasFile(repo, /^Cargo\.toml$/)) add('Rust', LANG_TECH.rs!.roast, 70);
  if (hasFile(repo, /^composer\.json$/)) add('PHP', LANG_TECH.php!.roast, 68);
  if (hasFile(repo, /^Gemfile$/)) add('Ruby', LANG_TECH.rb!.roast, 68);
  if (hasFile(repo, /^(pom\.xml|build\.gradle(\.kts)?)$/)) add('Java', LANG_TECH.java!.roast, 66);
  if (hasFile(repo, /^(requirements[^/]*\.txt|pyproject\.toml|Pipfile)$/)) add('Python', LANG_TECH.py!.roast, 66);
  if (hasFile(repo, /^mix\.exs$/)) add('Elixir', LANG_TECH.ex!.roast, 66);

  // 5. Infra / build systems.
  if (hasFile(repo, /^Dockerfile$/)) add('Docker', 'Docker. "Works on my machine" — now shippable, machine and all.', 70);
  if (hasFile(repo, /^docker-compose\.ya?ml$/)) add('docker-compose', 'docker-compose. Three services spun up to run a to-do list.', 64);
  if (tracked(repo, /\.tf$/)) add('Terraform', 'Terraform. Infrastructure as code, incidents as a lifestyle.', 66);
  if (hasFile(repo, /^CMakeLists\.txt$/)) add('CMake', 'CMake. A build system you configure by sacrificing an afternoon and, traditionally, a goat.', 58);

  return hits;
}

const techStack: Stat = {
  id: 'tech-stack',
  title: 'The Tech Stack On Trial',
  category: 'project',
  compute(repo) {
    const hits = detectTechs(repo).sort((a, b) => b.prio - a.prio).slice(0, 5);
    if (hits.length === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: hits.map((h) => h.name).join(' · '),
      roast: hits[0]!.roast,
      data: { techs: hits.map((h) => ({ name: h.name, roast: h.roast })), count: hits.length },
    };
  },
};

/* ───────────────────────── house rules ───────────────────────── */

/** Config-file presence → enforced rule. Matched against tracked paths. */
const PRESENCE_RULES: { re: RegExp; label: string }[] = [
  { re: /(^|\/)\.husky\//, label: 'Husky git hooks' },
  { re: /(^|\/)\.pre-commit-config\.ya?ml$/, label: 'the pre-commit framework' },
  { re: /(^|\/)lefthook\.ya?ml$/, label: 'Lefthook git hooks' },
  { re: /(^|\/)\.overcommit\.yml$/, label: 'Overcommit git hooks' },
  { re: /(^|\/)\.golangci\.(ya?ml|toml)$/, label: 'golangci-lint' },
  { re: /(^|\/)checkstyle\.xml$/, label: 'Checkstyle' },
  { re: /(^|\/)detekt\.ya?ml$/, label: 'detekt (Kotlin lint)' },
  { re: /(^|\/)phpstan\.neon(\.dist)?$/, label: 'PHPStan' },
  { re: /(^|\/)psalm\.xml(\.dist)?$/, label: 'Psalm' },
  { re: /(^|\/)\.?phpcs\.xml(\.dist)?$/, label: 'PHP_CodeSniffer' },
  { re: /(^|\/)\.php-cs-fixer(\.dist)?\.php$/, label: 'PHP-CS-Fixer' },
  { re: /(^|\/)\.flake8$/, label: 'flake8' },
  { re: /(^|\/)\.pylintrc$/, label: 'pylint' },
  { re: /(^|\/)\.?ruff\.toml$/, label: 'Ruff' },
  { re: /(^|\/)mypy\.ini$/, label: 'mypy type-checking' },
  { re: /(^|\/)\.rubocop\.yml$/, label: 'RuboCop' },
  { re: /(^|\/)(\.)?rustfmt\.toml$/, label: 'rustfmt' },
  { re: /(^|\/)clippy\.toml$/, label: 'Clippy' },
  { re: /(^|\/)biome\.jsonc?$/, label: 'Biome' },
  { re: /(^|\/)\.gitlint$/, label: 'gitlint' },
  { re: /(^|\/)(\.eslintrc|eslint\.config\.)/, label: 'ESLint' },
  { re: /(^|\/)\.prettierrc/, label: 'Prettier' },
  { re: /(^|\/)commitlint\.config\./, label: 'Conventional Commits (commitlint)' },
  { re: /(^|\/)\.github\/workflows\//, label: 'a CI pipeline double-checking your homework' },
  { re: /(^|\/)\.gitlab-ci\.yml$/, label: 'a GitLab CI pipeline' },
  { re: /(^|\/)\.circleci\//, label: 'a CircleCI pipeline' },
  { re: /(^|\/)(Jenkinsfile|\.travis\.yml|azure-pipelines\.yml)$/, label: 'a CI pipeline' },
];

/** Tool-in-manifest → enforced rule. Matched against the manifest haystack. */
const HAYSTACK_RULES: { re: RegExp; label: string }[] = [
  { re: /jacoco/i, label: 'JaCoCo coverage gate' },
  { re: /com\.diffplug\.spotless|\bspotless\b/i, label: 'Spotless formatting' },
  { re: /spotbugs/i, label: 'SpotBugs' },
  { re: /\bpmd\b/i, label: 'PMD' },
  { re: /\bcheckstyle\b/i, label: 'Checkstyle' },
  { re: /ktlint/i, label: 'ktlint' },
  { re: /phpstan\/phpstan/i, label: 'PHPStan' },
  { re: /vimeo\/psalm/i, label: 'Psalm' },
  { re: /squizlabs\/php_codesniffer/i, label: 'PHP_CodeSniffer' },
  { re: /friendsofphp\/php-cs-fixer/i, label: 'PHP-CS-Fixer' },
  { re: /\[tool\.black\]|\bblack\b/i, label: 'Black formatting' },
  { re: /\[tool\.ruff\]|\bruff\b/i, label: 'Ruff' },
  { re: /\[tool\.mypy\]|\bmypy\b/i, label: 'mypy type-checking' },
  { re: /\[tool\.isort\]|\bisort\b/i, label: 'isort' },
  { re: /\bflake8\b/i, label: 'flake8' },
  { re: /\bpylint\b/i, label: 'pylint' },
  { re: /pytest-cov|--cov\b/i, label: 'pytest coverage' },
  { re: /\brubocop\b/i, label: 'RuboCop' },
  { re: /\bsimplecov\b/i, label: 'SimpleCov coverage' },
  { re: /cargo-tarpaulin|tarpaulin/i, label: 'Tarpaulin coverage' },
];

/** Pull the highest coverage-threshold percentage we can find, or null. */
function detectCoverage(repo: RepoData): number | null {
  const sources = filesByBase(repo, /^(package\.json|jest\.config\..*|vitest\.config\..*|vite\.config\..*|\.nycrc(\.json)?|\.coveragerc|setup\.cfg|tox\.ini|pyproject\.toml|pom\.xml|build\.gradle(\.kts)?)$/);
  let cov: number | null = null;
  for (const src of sources) {
    const relevant = /coveragethreshold|thresholds|check-coverage|fail_under|jacoco|minimum/i.test(src);
    if (!relevant) continue;
    const pctNums = [...src.matchAll(/(lines|statements|branches|functions)\s*:\s*(\d{1,3})/gi)].map((m) => Number(m[2]));
    const failUnder = [...src.matchAll(/fail_under\s*[=:]\s*(\d{1,3})/gi)].map((m) => Number(m[1]));
    // JaCoCo writes fractions like 0.80 inside <minimum> elements.
    const fractions = [...src.matchAll(/minimum[^0-9]{0,40}0?\.(\d{2})/gi)].map((m) => Number(m[1]));
    const all = [...pctNums, ...failUnder, ...fractions].filter((n) => n > 0 && n <= 100);
    if (all.length) cov = Math.max(cov ?? 0, ...all);
    else cov = cov ?? 0; // gate present, threshold unparsed
  }
  return cov;
}

const houseRules: Stat = {
  id: 'house-rules',
  title: 'The Rules Of The House',
  category: 'project',
  compute(repo) {
    const rules: string[] = [];
    const addRule = (label: string) => { if (!rules.includes(label)) rules.push(label); };

    // Hooks + config files present anywhere in the tree.
    for (const r of PRESENCE_RULES) if (tracked(repo, r.re)) addRule(r.label);

    // Tools declared inside dependency manifests (Java/PHP/Python/Ruby/Rust…).
    const hay = manifestHay(repo);
    for (const r of HAYSTACK_RULES) if (r.re.test(hay)) addRule(r.label);

    // npm devDeps that imply quality gates even without a standalone config file.
    const deps = parsePackageDeps(repo);
    if (deps.has('eslint')) addRule('ESLint');
    if (deps.has('prettier')) addRule('Prettier');
    if (deps.has('husky')) addRule('Husky git hooks');
    if (deps.has('lint-staged')) addRule('lint-staged on changed files');
    if ([...deps].some((d) => d.startsWith('@commitlint'))) addRule('Conventional Commits (commitlint)');

    // What the Husky pre-commit hook actually runs.
    const preCommit = filesByBase(repo, /^pre-commit$/).join('\n');
    if (/eslint|\blint\b/i.test(preCommit)) addRule('ESLint blocks your commit');
    if (/prettier|format/i.test(preCommit)) addRule('formatting enforced pre-commit');
    if (/tsc|type-?check|mypy/i.test(preCommit)) addRule('a type-check gate');
    if (/jest|vitest|pytest|\btest\b/i.test(preCommit)) addRule('tests run on every commit');

    // TypeScript strict mode.
    if (/"strict"\s*:\s*true/.test(filesByBase(repo, /^tsconfig.*\.json$/).join('\n'))) addRule('TypeScript strict mode');

    // Coverage gate. If a coverage tool was already named, fold the % into that
    // label rather than listing a second, redundant "coverage gate" rule.
    const coverage = detectCoverage(repo);
    if (coverage !== null) {
      const idx = rules.findIndex((r) => /coverage/i.test(r));
      if (idx >= 0) {
        if (coverage > 0) rules[idx] = `${rules[idx]} (${coverage}%)`;
      } else {
        const an = coverage === 8 || coverage === 11 || coverage === 18 || (coverage >= 80 && coverage <= 89);
        addRule(coverage > 0 ? `${an ? 'an' : 'a'} ${coverage}% coverage gate` : 'a coverage gate');
      }
    }

    const count = rules.length;
    let roast: string;
    if (count >= 5) {
      roast = `${count} separate checks must approve every commit before it is permitted to exist. This is not a repository, it is a regime — and you are not a trusted citizen of it. Every keystroke is reviewed by machines that presume you guilty until proven compliant. Having read your commits, the machines are right to.`;
    } else if (count >= 2) {
      roast = `${count} checkpoints stand between you and \`main\`, papers-please — ${rules.slice(0, 3).join(', ')}. A small bureaucracy of distrust, installed by people who have met you and drawn conclusions.`;
    } else if (count === 1) {
      roast = `Exactly one rule: ${rules[0]}. A single, lonely seatbelt bolted into a car with no brakes, no doors, and a driver who has never once braked.`;
    } else {
      roast = `No hooks. No linter. No coverage gate. No CI. No oversight of any kind. Every commit is an act of pure, unsupervised faith — and faith has never once compiled.`;
    }

    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: count === 0 ? 'No enforced rules whatsoever' : `${count} enforced rule${count === 1 ? '' : 's'}: ${rules.join(', ')}`,
      roast,
      data: { rules, count, coverage },
    };
  },
};

/* ───────────────────────── todo graveyard ───────────────────────── */

const todoGraveyard: Stat = {
  id: 'todo-graveyard',
  title: 'The Graveyard Of Good Intentions',
  category: 'project',
  compute(repo) {
    const { counts, total, examples } = repo.markers;
    const todo = counts.TODO ?? 0;
    const fixme = counts.FIXME ?? 0;
    const hack = counts.HACK ?? 0;
    const xxx = counts.XXX ?? 0;

    const parts: string[] = [];
    if (todo) parts.push(`${todo} TODO${todo === 1 ? '' : 's'}`);
    if (fixme) parts.push(`${fixme} FIXME${fixme === 1 ? '' : 's'}`);
    if (hack) parts.push(`${hack} HACK${hack === 1 ? '' : 's'}`);
    if (xxx) parts.push(`${xxx} XXX`);

    let roast: string;
    if (total === 0) {
      roast = `Not one TODO. Not a single FIXME. Either this code is flawless — or you delete the evidence before anyone reads it. I know which one it is.`;
    } else {
      const spicy = examples[0];
      const tail = spicy ? ` My favourite: “${spicy.text}” (${spicy.path}).` : '';
      roast = roastByTier(total, [
        { min: 500, template: `${total} unfinished promises rotting in the codebase (${parts.join(', ')}). This isn’t a backlog, it’s an archaeological site.${tail}` },
        { min: 100, template: `${total} TODO-family markers (${parts.join(', ')}). A monument to the word "later". Later, as it turns out, never came.${tail}` },
        { min: 20, template: `${total} loose ends scattered through the code (${parts.join(', ')}). Each one written with full confidence it’d be handled by Friday.${tail}` },
        { min: 1, template: `${total} marker${total === 1 ? '' : 's'} of intent left behind (${parts.join(', ')}). Small. Honest. Doomed.${tail}` },
      ]);
    }

    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: total === 0 ? 'Zero TODO/FIXME/HACK markers' : `${total} markers — ${parts.join(', ')}`,
      roast,
      data: { total, counts, examples },
    };
  },
};

export const projectStats: Stat[] = [techStack, houseRules, todoGraveyard];
