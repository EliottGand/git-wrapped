/** The stat registry. To add a stat: implement it, import its array, spread it here. */
import type { Stat } from '../types.js';
import { overviewStats } from './overview.js';
import { peopleStats } from './people.js';
import { habitsStats } from './habits.js';
import { messageStats } from './messages.js';
import { smellStats } from './smells.js';
import { projectStats } from './project.js';

export const ALL_STATS: Stat[] = [
  ...overviewStats,
  ...peopleStats,
  ...habitsStats,
  ...messageStats,
  ...smellStats,
  ...projectStats,
];

export const CATEGORY_ORDER = ['overview', 'people', 'habits', 'messages', 'smells', 'code', 'project'] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  overview: 'THE SCOREBOARD',
  people: 'POWER & PEOPLE',
  habits: 'YOUR HABITS (CONCERNING)',
  messages: 'COMMIT MESSAGE FORENSICS',
  smells: 'EVIDENCE OF GUILT',
  code: 'CRIME SCENES',
  project: 'THE PROJECT ITSELF',
};
