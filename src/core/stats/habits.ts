/** Time & habits — when do you commit, and should you be asleep instead. */
import type { Stat } from '../types.js';
import { maxBy, pct, roastByTier } from './helpers.js';

const DAY = 86400;

const nightOwl: Stat = {
  id: 'night-owl',
  title: 'The Night Owl',
  category: 'habits',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    if (commits.length === 0) return null;
    // 0-5am inclusive = the danger zone
    const witching = commits.filter((c) => c.authorHourLocal >= 0 && c.authorHourLocal <= 5);
    if (witching.length === 0) {
      return {
        id: this.id,
        title: this.title,
        category: this.category,
        headline: `0 commits between midnight and 6am`,
        roast: `Not a single commit between midnight and 6am. Suspiciously well-adjusted. I don't trust it.`,
        data: { witching: 0 },
      };
    }
    const share = pct(witching.length, commits.length);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${witching.length} commits between midnight and 6am (${share}%)`,
      roast: roastByTier(witching.length, [
        { min: 50, template: `{n} commits in the witching hours. Sleep is a feature you never shipped.` },
        { min: 10, template: `{n} commits between midnight and 6am. The bugs you wrote at 3am are someone's morning problem.` },
        { min: 1, template: `{n} late-night ${witching.length === 1 ? 'commit' : 'commits'}. Were you okay? Be honest.` },
      ]),
      data: { witching: witching.length, share },
    };
  },
};

const weekendWarrior: Stat = {
  id: 'weekend-warrior',
  title: 'The Weekend Warrior',
  category: 'habits',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    if (commits.length === 0) return null;
    const weekend = commits.filter((c) => c.authorWeekdayLocal === 0 || c.authorWeekdayLocal === 6);
    const share = pct(weekend.length, commits.length);
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${weekend.length} weekend commits (${share}%)`,
      roast: roastByTier(share, [
        { min: 30, template: `${share}% of commits on weekends. Work-life balance is a rumor you've heard but never confirmed.` },
        { min: 10, template: `${weekend.length} weekend commits. Saturday is just Monday with worse lighting.` },
        { min: 0, template: `Only ${share}% weekend commits. You actually log off. Disgustingly healthy.` },
      ]),
      data: { weekend: weekend.length, share },
    };
  },
};

const fridayDeployer: Stat = {
  id: 'friday-deployer',
  title: 'The Friday Afternoon Cowboy',
  category: 'habits',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    const friLate = commits.filter((c) => c.authorWeekdayLocal === 5 && c.authorHourLocal >= 16 && c.authorHourLocal <= 20);
    if (friLate.length === 0) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${friLate.length} commits on Friday between 4pm and 9pm`,
      roast: roastByTier(friLate.length, [
        { min: 20, template: `{n} Friday-evening commits. Shipping to prod at 5:47pm on a Friday is not a schedule, it's a cry for help.` },
        { min: 1, template: `{n} Friday-late ${friLate.length === 1 ? 'commit' : 'commits'}. Future-you, on call this weekend, sends regards.` },
      ]),
      data: { friLate: friLate.length },
    };
  },
};

const busiestDay: Stat = {
  id: 'busiest-day',
  title: 'The Day It All Happened',
  category: 'habits',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    if (commits.length === 0) return null;
    const perDay = new Map<string, number>();
    for (const c of commits) {
      const day = new Date(c.authorDate * 1000).toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const top = maxBy([...perDay.entries()], ([, n]) => n)!;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `${top[1]} commits on ${top[0]}`,
      roast: roastByTier(top[1], [
        { min: 20, template: `${top[1]} commits in a single day (${top[0]}). That much output and yet, somehow, no progress.` },
        { min: 1, template: `Peak day: ${top[1]} commits on ${top[0]}. A flurry of activity. Caffeine, presumably.` },
      ]),
      data: { day: top[0], count: top[1] },
    };
  },
};

const ghostGap: Stat = {
  id: 'ghost-gap',
  title: 'The Great Silence',
  category: 'habits',
  compute(repo) {
    const commits = repo.commits.filter((c) => !c.isMerge);
    if (commits.length < 2) return null;
    const times = commits.map((c) => c.authorDate).sort((a, b) => a - b);
    let maxGap = 0;
    let gapStart = times[0]!;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i]! - times[i - 1]!;
      if (gap > maxGap) {
        maxGap = gap;
        gapStart = times[i - 1]!;
      }
    }
    const gapDays = Math.floor(maxGap / DAY);
    if (gapDays < 1) return null;
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      headline: `Longest gap: ${gapDays} days (from ${new Date(gapStart * 1000).toISOString().slice(0, 10)})`,
      roast: roastByTier(gapDays, [
        { min: 90, template: `You ghosted this repo for {n} days. It saw the read receipt. It waited. It understood.` },
        { min: 14, template: `{n} days of radio silence at one point. The repo assumed the worst. The repo was right.` },
        { min: 1, template: `Longest quiet stretch: {n} days. Practically attentive, by your standards.` },
      ]),
      data: { gapDays },
    };
  },
};

export const habitsStats: Stat[] = [nightOwl, weekendWarrior, fridayDeployer, busiestDay, ghostGap];
