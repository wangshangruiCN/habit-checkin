import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  addMonths,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { useHabitStore } from "./hooks/useHabitStore";
import {
  createHabit,
  getActiveHabits,
  getDaySummary,
  getHabitStreak,
  isChecked,
} from "./lib/habits";
import {
  formatLongDate,
  formatMonth,
  formatShortDate,
  fromDateKey,
  getCalendarCells as getDatesForCalendar,
  isDateAfter,
  todayKey,
} from "./lib/dates";
import {
  HABIT_COLORS,
  type Habit,
  type HabitColor,
  type HabitStore,
} from "./types";
import { HabitDialog } from "./components/HabitDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ProgressRing } from "./components/ProgressRing";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  LeafIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "./components/Icons";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const SUGGESTIONS = [
  { name: "喝水", emoji: "💧" },
  { name: "运动", emoji: "🏃" },
  { name: "读书", emoji: "📖" },
] as const;

type DialogState =
  | { mode: "add" }
  | { mode: "edit"; habitId: string }
  | null;

interface UndoState {
  habitId: string;
  name: string;
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getEncouragement(completed: number, total: number): string {
  if (total === 0) return "添加第一件想坚持的小事吧";
  if (completed === total) return "今天全部完成，给自己一点掌声";
  if (completed === 0) return "不用着急，从一个勾开始";
  if (completed / total >= 0.5) return "已经走过一半，保持这个节奏";
  return "每一次完成，都算数";
}

function HabitRow({
  habit,
  checked,
  streak,
  onToggle,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  checked: boolean;
  streak: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`habit-row${checked ? " is-complete" : ""}`}>
      <div className={`habit-emoji habit-emoji--${habit.color}`} aria-hidden="true">
        {habit.emoji}
      </div>
      <div className="habit-copy">
        <h3>{habit.name}</h3>
        <p>
          <SparkleIcon />
          {streak > 0 ? `连续 ${streak} 天` : "今天，是新的开始"}
        </p>
      </div>
      <div className="habit-row__actions">
        <button
          className="icon-button"
          type="button"
          aria-label={`编辑${habit.name}`}
          title="编辑习惯"
          onClick={onEdit}
        >
          <EditIcon />
        </button>
        <button
          className="icon-button icon-button--danger"
          type="button"
          aria-label={`删除${habit.name}`}
          title="删除习惯"
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
      </div>
      <button
        className="habit-check"
        type="button"
        aria-label={`${checked ? "取消完成" : "完成"}${habit.name}`}
        aria-pressed={checked}
        onClick={onToggle}
      >
        <CheckIcon />
      </button>
    </article>
  );
}

function EmptyHabits({
  habits,
  onAdd,
  onQuickAdd,
}: {
  habits: Habit[];
  onAdd: () => void;
  onQuickAdd: (name: string, emoji: string) => void;
}) {
  return (
    <div className="empty-habits">
      <div className="empty-habits__art" aria-hidden="true">
        <span>🌱</span>
      </div>
      <h3>从一个小习惯开始</h3>
      <p>不必一下子改变很多，选择今天最想做到的一件事。</p>
      <div className="suggestion-list" aria-label="快捷添加建议">
        {SUGGESTIONS.map((suggestion) => {
          const alreadyExists = habits.some(
            (habit) =>
              !habit.archivedDate && habit.name === suggestion.name,
          );
          return (
            <button
              className="suggestion-chip"
              type="button"
              key={suggestion.name}
              disabled={alreadyExists}
              onClick={() => onQuickAdd(suggestion.name, suggestion.emoji)}
            >
              <span>{suggestion.emoji}</span>
              {suggestion.name}
              <PlusIcon />
            </button>
          );
        })}
      </div>
      <button className="text-button" type="button" onClick={onAdd}>
        自己添加一个
        <ChevronRightIcon />
      </button>
    </div>
  );
}

function App() {
  const {
    store,
    setStore,
    updateCheckIn,
    storageWarning,
    dismissStorageWarning,
  } = useHabitStore();
  const [now, setNow] = useState(() => new Date());
  const today = todayKey(now);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(fromDateKey(today)),
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const todayRef = useRef(today);
  const selectedDateRef = useRef(selectedDate);
  const undoTimerRef = useRef<number | null>(null);

  const activeHabits = getActiveHabits(store.habits, today);
  const todaySummary = getDaySummary(store.habits, store.checkIns, today);
  const selectedSummary = getDaySummary(
    store.habits,
    store.checkIns,
    selectedDate,
  );
  const calendarCells = getDatesForCalendar(visibleMonth);
  const editingHabit =
    dialog?.mode === "edit"
      ? store.habits.find((habit) => habit.id === dialog.habitId)
      : undefined;
  const deletingHabit = store.habits.find(
    (habit) => habit.id === deleteHabitId,
  );
  const suggestedColor = HABIT_COLORS[
    activeHabits.length % HABIT_COLORS.length
  ] as HabitColor;

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    function syncClock() {
      const freshNow = new Date();
      const freshToday = todayKey(freshNow);
      const previousToday = todayRef.current;

      setNow(freshNow);
      if (freshToday === previousToday) {
        return;
      }

      todayRef.current = freshToday;
      if (selectedDateRef.current === previousToday) {
        selectedDateRef.current = freshToday;
        setSelectedDate(freshToday);
        setVisibleMonth(startOfMonth(fromDateKey(freshToday)));
      }
    }

    const interval = window.setInterval(syncClock, 30_000);
    window.addEventListener("focus", syncClock);
    document.addEventListener("visibilitychange", syncClock);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncClock);
      document.removeEventListener("visibilitychange", syncClock);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  function clearUndo() {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoState(null);
  }

  function showUndo(habitId: string, name: string) {
    clearUndo();
    setUndoState({ habitId, name });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, 5_000);
  }

  function saveHabit(draft: {
    name: string;
    emoji: string;
    color: HabitColor;
  }) {
    if (dialog?.mode === "edit") {
      setStore((current: HabitStore) => ({
        ...current,
        habits: current.habits.map((habit) =>
          habit.id === dialog.habitId ? { ...habit, ...draft } : habit,
        ),
      }));
    } else {
      clearUndo();
      setStore((current: HabitStore) => {
        const habit = createHabit(draft, current.habits, today);
        return {
          ...current,
          habits: [...current.habits, habit],
        };
      });
    }
    setDialog(null);
  }

  function quickAddHabit(name: string, emoji: string) {
    clearUndo();
    setStore((current: HabitStore) => {
      const habit = createHabit({ name, emoji }, current.habits, today);
      return { ...current, habits: [...current.habits, habit] };
    });
  }

  function archiveHabit() {
    if (!deletingHabit) {
      return;
    }

    const { id, name } = deletingHabit;
    setStore((current) => ({
      ...current,
      habits: current.habits.map((habit) =>
        habit.id === id ? { ...habit, archivedDate: today } : habit,
      ),
    }));
    setDeleteHabitId(null);
    showUndo(id, name);
  }

  function undoArchive() {
    if (!undoState) {
      return;
    }

    setStore((current) => ({
      ...current,
      habits: current.habits.map((habit) =>
        habit.id === undoState.habitId
          ? { ...habit, archivedDate: undefined }
          : habit,
      ),
    }));
    clearUndo();
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    const date = fromDateKey(dateKey);
    if (!isSameMonth(date, visibleMonth)) {
      setVisibleMonth(startOfMonth(date));
    }
  }

  function goToToday() {
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(fromDateKey(today)));
  }

  function shiftMonth(amount: number) {
    setVisibleMonth((current) => addMonths(current, amount));
  }

  return (
    <div className="app-shell">
      <div className="ambient-shape ambient-shape--one" aria-hidden="true" />
      <div className="ambient-shape ambient-shape--two" aria-hidden="true" />

      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">
            <LeafIcon />
          </span>
          <div>
            <strong>微光习惯</strong>
            <span>把日子过成喜欢的样子</span>
          </div>
        </div>
        <div className="date-chip">
          <span>{getGreeting(now)}</span>
          <strong>{formatLongDate(now)}</strong>
        </div>
      </header>

      {storageWarning && (
        <div className="storage-warning" role="alert">
          <span>{storageWarning}</span>
          <button type="button" onClick={dismissStorageWarning}>
            知道了
          </button>
        </div>
      )}

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              今日的小小坚持
            </p>
            <h1 id="hero-title">
              把简单的重复，
              <br />
              变成<span>看得见的光。</span>
            </h1>
            <p className="hero-description">
              {getEncouragement(
                todaySummary.completedCount,
                todaySummary.totalCount,
              )}
            </p>
          </div>

          <div className="today-progress">
            <ProgressRing
              completed={todaySummary.completedCount}
              total={todaySummary.totalCount}
            />
            <div className="today-progress__copy">
              <span>今日完成</span>
              <strong aria-live="polite">
                {todaySummary.completedCount}
                <small> / {todaySummary.totalCount} 项</small>
              </strong>
              <p>
                {todaySummary.totalCount === 0
                  ? "等待种下第一个习惯"
                  : todaySummary.isComplete
                    ? "满格的一天，很棒"
                    : `还有 ${todaySummary.totalCount - todaySummary.completedCount} 项可以做`}
              </p>
            </div>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel habits-panel" aria-labelledby="habits-title">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">DAILY RHYTHM</p>
                <h2 id="habits-title">今日习惯</h2>
              </div>
              {activeHabits.length > 0 && (
                <button
                  className="button button--primary button--small"
                  type="button"
                  onClick={() => setDialog({ mode: "add" })}
                >
                  <PlusIcon />
                  添加习惯
                </button>
              )}
            </div>

            {activeHabits.length === 0 ? (
              <EmptyHabits
                habits={store.habits}
                onAdd={() => setDialog({ mode: "add" })}
                onQuickAdd={quickAddHabit}
              />
            ) : (
              <div className="habit-list">
                {activeHabits.map((habit, index) => (
                  <div
                    className="habit-row-wrap"
                    style={{ "--row-index": index } as CSSProperties}
                    key={habit.id}
                  >
                    <HabitRow
                      habit={habit}
                      checked={isChecked(store.checkIns, habit.id, today)}
                      streak={getHabitStreak(
                        habit,
                        store.checkIns,
                        today,
                      )}
                      onToggle={() => updateCheckIn(habit.id, today)}
                      onEdit={() =>
                        setDialog({ mode: "edit", habitId: habit.id })
                      }
                      onDelete={() => setDeleteHabitId(habit.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeHabits.length > 0 && (
              <div className="habits-footer">
                <span>
                  <LeafIcon />
                  不追求完美，只记录真实
                </span>
                <span>{activeHabits.length} 个习惯正在生长</span>
              </div>
            )}
          </section>

          <section className="panel calendar-panel" aria-labelledby="calendar-title">
            <div className="calendar-heading">
              <div>
                <p className="section-kicker">YOUR JOURNEY</p>
                <h2 id="calendar-title">{formatMonth(visibleMonth)}</h2>
              </div>
              <div className="calendar-nav">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="上个月"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="下个月"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>

            <div className="calendar-grid calendar-grid--labels" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="calendar-grid" aria-label="打卡月历">
              {calendarCells.map((cell) => {
                const summary = getDaySummary(
                  store.habits,
                  store.checkIns,
                  cell.dateKey,
                );
                const isFuture = isDateAfter(cell.dateKey, today);
                const isSelected = cell.dateKey === selectedDate;
                const isToday = cell.dateKey === today;
                let state = "empty";
                if (summary.totalCount === 0) {
                  state = "none";
                } else if (summary.isComplete) {
                  state = "complete";
                } else if (summary.completedCount > 0) {
                  state = "partial";
                } else {
                  state = "missed";
                }

                return (
                  <button
                    className={[
                      "calendar-day",
                      `calendar-day--${state}`,
                      !cell.inCurrentMonth ? "is-outside" : "",
                      isSelected ? "is-selected" : "",
                      isToday ? "is-today" : "",
                      isFuture ? "is-future" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    key={cell.dateKey}
                    disabled={isFuture}
                    aria-label={`${formatShortDate(cell.dateKey)}${
                      summary.totalCount > 0
                        ? `，完成 ${summary.completedCount} 项，共 ${summary.totalCount} 项`
                        : "，没有习惯"
                    }${isToday ? "，今天" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => selectDate(cell.dateKey)}
                  >
                    <span>{cell.dayNumber}</span>
                    {summary.totalCount > 0 && <i />}
                  </button>
                );
              })}
            </div>

            <div className="calendar-legend" aria-label="日历图例">
              <span>
                <i className="legend-dot legend-dot--complete" />
                全部完成
              </span>
              <span>
                <i className="legend-dot legend-dot--partial" />
                完成一部分
              </span>
              <span>
                <i className="legend-dot legend-dot--missed" />
                未完成
              </span>
            </div>

            <button className="today-link" type="button" onClick={goToToday}>
              {selectedDate === today ? "正在查看今天" : "回到今天"}
              <ChevronRightIcon />
            </button>
          </section>
        </div>

        <section
          className="day-detail"
          role="region"
          aria-labelledby="day-detail-title"
        >
          <div className="day-detail__heading">
            <div>
              <p className="section-kicker">
                {selectedDate === today ? "TODAY'S LOG" : "DAILY LOG"}
              </p>
              <h2 id="day-detail-title">
                {selectedDate === today ? "今天" : formatShortDate(selectedDate)}
              </h2>
            </div>
            {selectedSummary.totalCount > 0 && (
              <span className="day-count">
                <strong>{selectedSummary.completedCount}</strong>
                <span>/ {selectedSummary.totalCount} 完成</span>
              </span>
            )}
          </div>

          {selectedSummary.habits.length === 0 ? (
            <div className="day-detail__empty">
              <span>☁️</span>
              <p>
                {selectedDate === today
                  ? "今天还没有习惯，先在左边添加一个吧。"
                  : "这一天还没有可记录的习惯。"}
              </p>
            </div>
          ) : (
            <div className="detail-list">
              {selectedSummary.habits.map((habit) => {
                const checked = isChecked(
                  store.checkIns,
                  habit.id,
                  selectedDate,
                );
                const archived = Boolean(habit.archivedDate);
                return (
                  <button
                    className={`detail-check${checked ? " is-complete" : ""}`}
                    type="button"
                    key={habit.id}
                    disabled={archived}
                    aria-pressed={checked}
                    aria-label={`${archived ? "已归档，仅查看" : checked ? "取消完成" : "完成"}${habit.name}`}
                    onClick={() =>
                      !archived && updateCheckIn(habit.id, selectedDate)
                    }
                  >
                    <span className={`mini-emoji habit-emoji--${habit.color}`}>
                      {habit.emoji}
                    </span>
                    <span className="detail-check__name">{habit.name}</span>
                    {archived && <span className="archived-tag">已归档</span>}
                    <span className="mini-check">
                      <CheckIcon />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedDate !== today && selectedSummary.habits.some(
            (habit) => !habit.archivedDate,
          ) && (
            <p className="backfill-note">
              <SparkleIcon />
              想起来某天完成了？点击即可补记。
            </p>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <span>
          <LeafIcon />
          微光习惯
        </span>
        <p>所有记录只保存在当前浏览器中</p>
      </footer>

      {dialog && (
        <HabitDialog
          habit={editingHabit}
          habits={store.habits}
          suggestedColor={suggestedColor}
          onClose={() => setDialog(null)}
          onSave={saveHabit}
        />
      )}

      {deletingHabit && (
        <ConfirmDialog
          habitName={deletingHabit.name}
          onClose={() => setDeleteHabitId(null)}
          onConfirm={archiveHabit}
        />
      )}

      {undoState && (
        <div className="undo-toast" role="status">
          <span>
            “{undoState.name}”已从每日清单移除
          </span>
          <button type="button" onClick={undoArchive}>
            撤销
          </button>
          <button
            className="undo-toast__close"
            type="button"
            aria-label="关闭提示"
            onClick={clearUndo}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
