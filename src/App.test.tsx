import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_KEY, STORE_VERSION, type HabitStore } from "./types";

const fixedDate = new Date(2026, 9, 26, 9, 0, 0);

function seededStore(): HabitStore {
  return {
    version: STORE_VERSION,
    habits: [
      {
        id: "habit-water",
        name: "喝水",
        emoji: "💧",
        color: "mint",
        createdDate: "2026-10-20",
      },
    ],
    checkIns: [],
  };
}

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe("habit check-in page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("creates a suggested habit and updates today's total", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /喝水/ }));
    expect(
      screen.getByRole("img", { name: "今日完成 0 项，共 1 项" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "完成喝水" }));
    expect(
      screen.getByRole("img", { name: "今日完成 1 项，共 1 项" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "取消完成喝水" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("validates the add form and prevents duplicate names", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "自己添加一个" }));
    let dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("习惯名称"), "运动");
    await user.click(
      within(dialog).getByRole("button", { name: "添加习惯" }),
    );
    expect(screen.getByRole("button", { name: "完成运动" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "添加习惯" }));
    dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("习惯名称"), "运动");
    await user.click(
      within(dialog).getByRole("button", { name: "添加习惯" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "已经有同名习惯了",
    );
  });

  it("edits, archives, and restores a habit", async () => {
    const user = setupUser();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /喝水/ }));

    await user.click(screen.getByRole("button", { name: "编辑喝水" }));
    let dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByLabelText("习惯名称");
    await user.clear(nameInput);
    await user.type(nameInput, "晨间喝水");
    await user.click(
      within(dialog).getByRole("button", { name: "保存修改" }),
    );
    expect(
      screen.getByRole("button", { name: "完成晨间喝水" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "删除晨间喝水" }));
    dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "确认删除" }),
    );
    expect(
      screen.queryByRole("button", { name: "完成晨间喝水" }),
    ).not.toBeInTheDocument();

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("已从每日清单移除");
    await user.click(within(toast).getByRole("button", { name: "撤销" }));
    expect(
      screen.getByRole("button", { name: "完成晨间喝水" }),
    ).toBeInTheDocument();
  });

  it("persists habits after a remount", async () => {
    const user = setupUser();
    const firstRender = render(<App />);
    await user.click(screen.getByRole("button", { name: /喝水/ }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("喝水");

    firstRender.unmount();
    render(<App />);
    expect(screen.getByRole("button", { name: "完成喝水" })).toBeInTheDocument();
  });

  it("backfills a past date and updates that habit's streak", async () => {
    const user = setupUser();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seededStore()));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /10月25日/ }));
    const detail = screen.getByRole("region", { name: /10月25日/ });
    await user.click(within(detail).getByRole("button", { name: "完成喝水" }));

    expect(
      within(detail).getByRole("button", { name: "取消完成喝水" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("连续 1 天")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "今日完成 0 项，共 1 项" }),
    ).toBeInTheDocument();
  });

  it("navigates months while keeping future dates disabled", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "下个月" }));
    expect(
      screen.getByRole("heading", { name: /2026年 11月/ }),
    ).toBeInTheDocument();

    const futureDays = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-label")?.startsWith("12月"));
    expect(futureDays.length).toBeGreaterThan(0);
    expect(futureDays.every((button) => button.hasAttribute("disabled"))).toBe(
      true,
    );
  });

  it("switches the today view when the local date changes", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...seededStore(),
        checkIns: [{ habitId: "habit-water", date: "2026-10-26" }],
      }),
    );
    render(<App />);
    expect(
      screen.getByRole("img", { name: "今日完成 1 项，共 1 项" }),
    ).toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 9, 27, 0, 1, 0));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(screen.getByText(/10月27日/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "今日完成 0 项，共 1 项" }),
    ).toBeInTheDocument();
  });
});
