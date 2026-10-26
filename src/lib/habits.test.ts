import { describe, expect, it } from "vitest";
import {
  createHabit,
  getDaySummary,
  getHabitStreak,
  isChecked,
  isHabitStore,
  loadStore,
  saveStore,
  toggleCheckIn,
  validateHabitName,
} from "./habits";
import type { CheckIn, Habit, HabitStore } from "../types";
import { STORAGE_KEY, STORE_VERSION } from "../types";

const habit: Habit = {
  id: "habit-water",
  name: "喝水",
  emoji: "💧",
  color: "mint",
  createdDate: "2026-10-20",
};

function checks(...dates: string[]): CheckIn[] {
  return dates.map((date) => ({ habitId: habit.id, date }));
}

describe("habit streak", () => {
  it("counts from today when today is complete", () => {
    expect(
      getHabitStreak(
        habit,
        checks("2026-10-24", "2026-10-25", "2026-10-26"),
        "2026-10-26",
      ),
    ).toBe(3);
  });

  it("uses yesterday as the anchor while today is still pending", () => {
    expect(
      getHabitStreak(
        habit,
        checks("2026-10-23", "2026-10-24", "2026-10-25"),
        "2026-10-26",
      ),
    ).toBe(3);
  });

  it("stops at the first missed day", () => {
    expect(
      getHabitStreak(
        habit,
        checks("2026-10-20", "2026-10-21", "2026-10-23", "2026-10-25"),
        "2026-10-26",
      ),
    ).toBe(1);
  });

  it("returns zero for an archived habit", () => {
    expect(
      getHabitStreak(
        { ...habit, archivedDate: "2026-10-24" },
        checks("2026-10-23", "2026-10-24"),
        "2026-10-26",
      ),
    ).toBe(0);
  });
});

describe("daily records", () => {
  it("toggles a check-in without creating duplicates", () => {
    const once = toggleCheckIn([], habit.id, "2026-10-26");
    expect(isChecked(once, habit.id, "2026-10-26")).toBe(true);

    const twice = toggleCheckIn(once, habit.id, "2026-10-26");
    expect(twice).toEqual([]);
  });

  it("keeps history after a habit is archived", () => {
    const archived = { ...habit, archivedDate: "2026-10-25" };
    const beforeArchive = getDaySummary(
      [archived],
      checks("2026-10-24"),
      "2026-10-24",
    );
    const onArchiveDay = getDaySummary([archived], [], "2026-10-25");

    expect(beforeArchive.completedCount).toBe(1);
    expect(beforeArchive.totalCount).toBe(1);
    expect(onArchiveDay.totalCount).toBe(0);
  });

  it("does not show habits before their creation date", () => {
    expect(getDaySummary([habit], [], "2026-10-19").totalCount).toBe(0);
  });
});

describe("habit validation", () => {
  it("normalizes names and rejects duplicates and empty values", () => {
    expect(validateHabitName("  每天   喝水  ", [])).toBeNull();
    expect(validateHabitName("  ", [])).toBe("给习惯起一个名字吧");
    expect(validateHabitName("喝水", [habit])).toBe("已经有同名习惯了");
    expect(validateHabitName("喝水", [habit], habit.id)).toBeNull();
  });
});

describe("storage", () => {
  it("loads a valid versioned store", () => {
    const data: HabitStore = {
      version: STORE_VERSION,
      habits: [habit],
      checkIns: checks("2026-10-26"),
    };
    const result = loadStore({
      getItem: () => JSON.stringify(data),
      setItem: () => undefined,
    });

    expect(result.store.habits).toHaveLength(1);
    expect(result.warning).toBeUndefined();
  });

  it("backs up malformed data before starting empty", () => {
    const writes: Array<[string, string]> = [];
    const result = loadStore({
      getItem: () => "{not-json",
      setItem: (key, value) => writes.push([key, value]),
    });

    expect(result.store.habits).toEqual([]);
    expect(result.warning).toContain("无法识别");
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toContain(`${STORAGE_KEY}:corrupt-`);
    expect(writes[0][1]).toBe("{not-json");
  });

  it("rejects an incompatible version", () => {
    expect(
      isHabitStore({
        version: 99,
        habits: [],
        checkIns: [],
      }),
    ).toBe(false);
  });

  it("returns a visible warning when saving fails", () => {
    expect(
      saveStore(
        {
          setItem: () => {
            throw new Error("quota exceeded");
          },
        },
        { version: STORE_VERSION, habits: [habit], checkIns: [] },
      ),
    ).toContain("保存失败");
  });

  it("uses the versioned storage key", () => {
    expect(STORAGE_KEY).toBe("habit-checkin:v1");
    const created = createHabit(
      { name: "运动", emoji: "🏃", color: "coral" },
      [],
      "2026-10-26",
    );
    expect(created.archivedDate).toBeUndefined();
  });
});
