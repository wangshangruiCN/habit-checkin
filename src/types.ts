export const STORAGE_KEY = "habit-checkin:v1";
export const STORE_VERSION = 1 as const;

export const HABIT_COLORS = [
  "mint",
  "coral",
  "sun",
  "sky",
  "lilac",
] as const;

export type HabitColor = (typeof HABIT_COLORS)[number];

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: HabitColor;
  createdDate: string;
  archivedDate?: string;
}

export interface CheckIn {
  habitId: string;
  date: string;
}

export interface HabitStore {
  version: typeof STORE_VERSION;
  habits: Habit[];
  checkIns: CheckIn[];
}

export interface DaySummary {
  date: string;
  habits: Habit[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}
