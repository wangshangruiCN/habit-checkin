import { compareDateKeys, shiftDate, todayKey } from "./dates";
import type {
  CheckIn,
  DaySummary,
  Habit,
  HabitColor,
  HabitStore,
} from "../types";
import {
  HABIT_COLORS,
  STORAGE_KEY,
  STORE_VERSION,
} from "../types";

export const EMOJI_OPTIONS = [
  "💧",
  "🏃",
  "📖",
  "🧘",
  "🥗",
  "🌿",
  "✍️",
  "🎨",
  "🎵",
  "☀️",
  "🌙",
  "💊",
  "🧹",
  "💻",
  "🚶",
  "🫶",
] as const;

export const EMPTY_STORE: HabitStore = {
  version: STORE_VERSION,
  habits: [],
  checkIns: [],
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createHabit(
  input: Pick<Habit, "name" | "emoji"> & { color?: HabitColor },
  habits: Habit[],
  date = todayKey(),
): Habit {
  const colorIndex = habits.filter((habit) => !habit.archivedDate).length;
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    emoji: input.emoji,
    color:
      input.color ??
      (HABIT_COLORS[colorIndex % HABIT_COLORS.length] as HabitColor),
    createdDate: date,
  };
}

export function isHabitActiveOn(habit: Habit, dateKey: string): boolean {
  if (compareDateKeys(dateKey, habit.createdDate) < 0) {
    return false;
  }

  return !habit.archivedDate || compareDateKeys(dateKey, habit.archivedDate) < 0;
}

export function getHabitsForDate(habits: Habit[], dateKey: string): Habit[] {
  return habits.filter((habit) => isHabitActiveOn(habit, dateKey));
}

export function getActiveHabits(habits: Habit[], dateKey: string): Habit[] {
  return habits.filter(
    (habit) =>
      !habit.archivedDate &&
      compareDateKeys(dateKey, habit.createdDate) >= 0,
  );
}

export function isChecked(
  checkIns: CheckIn[],
  habitId: string,
  dateKey: string,
): boolean {
  return checkIns.some(
    (checkIn) => checkIn.habitId === habitId && checkIn.date === dateKey,
  );
}

export function getDaySummary(
  habits: Habit[],
  checkIns: CheckIn[],
  dateKey: string,
): DaySummary {
  const dayHabits = getHabitsForDate(habits, dateKey);
  const completedCount = dayHabits.filter((habit) =>
    isChecked(checkIns, habit.id, dateKey),
  ).length;

  return {
    date: dateKey,
    habits: dayHabits,
    completedCount,
    totalCount: dayHabits.length,
    isComplete: dayHabits.length > 0 && completedCount === dayHabits.length,
  };
}

export function getHabitStreak(
  habit: Habit,
  checkIns: CheckIn[],
  currentDate = todayKey(),
): number {
  if (!isHabitActiveOn(habit, currentDate)) {
    return 0;
  }

  let cursor = isChecked(checkIns, habit.id, currentDate)
    ? currentDate
    : shiftDate(currentDate, -1);
  let streak = 0;

  while (
    compareDateKeys(cursor, habit.createdDate) >= 0 &&
    isChecked(checkIns, habit.id, cursor)
  ) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

export function toggleCheckIn(
  checkIns: CheckIn[],
  habitId: string,
  dateKey: string,
): CheckIn[] {
  const exists = isChecked(checkIns, habitId, dateKey);
  return exists
    ? checkIns.filter(
        (checkIn) => !(checkIn.habitId === habitId && checkIn.date === dateKey),
      )
    : [...checkIns, { habitId, date: dateKey }];
}

export function normalizeHabitName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateHabitName(
  name: string,
  habits: Habit[],
  editingId?: string,
): string | null {
  const normalized = normalizeHabitName(name);
  if (!normalized) {
    return "给习惯起一个名字吧";
  }
  if (normalized.length > 20) {
    return "习惯名称最多 20 个字符";
  }
  if (
    habits.some(
      (habit) =>
        !habit.archivedDate &&
        habit.id !== editingId &&
        habit.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    )
  ) {
    return "已经有同名习惯了";
  }
  return null;
}

export function isHabitStore(value: unknown): value is HabitStore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== STORE_VERSION ||
    !Array.isArray(candidate.habits) ||
    !Array.isArray(candidate.checkIns)
  ) {
    return false;
  }

  const validHabits = candidate.habits.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const habit = item as Record<string, unknown>;
    return (
      typeof habit.id === "string" &&
      typeof habit.name === "string" &&
      typeof habit.emoji === "string" &&
      typeof habit.color === "string" &&
      (HABIT_COLORS as readonly string[]).includes(habit.color) &&
      typeof habit.createdDate === "string" &&
      DATE_KEY_PATTERN.test(habit.createdDate) &&
      (habit.archivedDate === undefined ||
        (typeof habit.archivedDate === "string" &&
          DATE_KEY_PATTERN.test(habit.archivedDate)))
    );
  });

  return (
    validHabits &&
    candidate.checkIns.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const checkIn = item as Record<string, unknown>;
      return (
        typeof checkIn.habitId === "string" &&
        typeof checkIn.date === "string" &&
        DATE_KEY_PATTERN.test(checkIn.date)
      );
    })
  );
}

export interface LoadResult {
  store: HabitStore;
  warning?: string;
}

export function loadStore(storage: Pick<Storage, "getItem" | "setItem">): LoadResult {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { store: EMPTY_STORE };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      storage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
      return {
        store: EMPTY_STORE,
        warning: "原数据格式无法识别，已为你保留备份并启用空白记录。",
      };
    }

    if (!isHabitStore(parsed)) {
      storage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
      return {
        store: EMPTY_STORE,
        warning: "原数据格式无法识别，已为你保留备份并启用空白记录。",
      };
    }

    const habitIds = new Set(parsed.habits.map((habit) => habit.id));
    return {
      store: {
        ...parsed,
        checkIns: parsed.checkIns.filter((checkIn) =>
          habitIds.has(checkIn.habitId),
        ),
      },
    };
  } catch {
    return {
      store: EMPTY_STORE,
      warning: "读取本机记录失败，当前更改可能无法长期保存。",
    };
  }
}

export function saveStore(
  storage: Pick<Storage, "setItem">,
  store: HabitStore,
): string | null {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return null;
  } catch {
    return "保存失败，请检查浏览器是否允许本地存储。";
  }
}

export function getCalendarSummary(
  habits: Habit[],
  checkIns: CheckIn[],
  dateKey: string,
): DaySummary {
  return getDaySummary(habits, checkIns, dateKey);
}

