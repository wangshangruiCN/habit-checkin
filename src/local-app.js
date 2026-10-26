(function () {
  "use strict";

  const STORAGE_KEY = "habit-checkin:v1";
  const STORE_VERSION = 1;
  const COLORS = ["mint", "coral", "sun", "sky", "lilac"];
  const COLOR_LABELS = {
    mint: "薄荷绿",
    coral: "珊瑚橙",
    sun: "暖阳黄",
    sky: "天空蓝",
    lilac: "丁香紫",
  };
  const EMOJIS = [
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
  ];
  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
  const SUGGESTIONS = [
    { name: "喝水", emoji: "💧" },
    { name: "运动", emoji: "🏃" },
    { name: "读书", emoji: "📖" },
  ];

  const ICONS = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    sparkle:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.25 4.25L17.5 8.5l-4.25 1.25L12 14l-1.25-4.25L6.5 8.5l4.25-1.25Z"/><path d="m19 14 .75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75Z"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
  };

  let store = emptyStore();
  let warning = null;
  let today = getDateKey(new Date());
  let now = new Date();
  let selectedDate = today;
  let visibleMonth = firstOfMonth(now);
  let dialogState = null;
  let undoTimer = null;
  let undoState = null;
  let lastFocused = null;
  let lastClockHour = now.getHours();

  const root = document.getElementById("root");

  function emptyStore() {
    return { version: STORE_VERSION, habits: [], checkIns: [] };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function getDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromDateKey(key) {
    const parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  function firstOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
  }

  function shiftDateKey(key, amount) {
    const date = fromDateKey(key);
    date.setDate(date.getDate() + amount);
    return getDateKey(date);
  }

  function formatLongDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAY_NAMES[date.getDay()]}`;
  }

  function formatMonth(date) {
    return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
  }

  function formatShortDate(key) {
    const date = fromDateKey(key);
    return `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAY_NAMES[date.getDay()]}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[character];
    });
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isDateKey(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function normalizeStore(value) {
    if (
      !value ||
      typeof value !== "object" ||
      value.version !== STORE_VERSION ||
      !Array.isArray(value.habits) ||
      !Array.isArray(value.checkIns)
    ) {
      return null;
    }

    const habits = value.habits.filter(function (habit) {
      return (
        habit &&
        typeof habit.id === "string" &&
        typeof habit.name === "string" &&
        typeof habit.emoji === "string" &&
        COLORS.includes(habit.color) &&
        isDateKey(habit.createdDate) &&
        (!habit.archivedDate || isDateKey(habit.archivedDate))
      );
    });
    const habitIds = new Set(
      habits.map(function (habit) {
        return habit.id;
      }),
    );
    const checkIns = value.checkIns.filter(function (checkIn) {
      return (
        checkIn &&
        typeof checkIn.habitId === "string" &&
        habitIds.has(checkIn.habitId) &&
        isDateKey(checkIn.date)
      );
    });

    return { version: STORE_VERSION, habits: habits, checkIns: checkIns };
  }

  function loadStore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyStore();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        window.localStorage.setItem(
          `${STORAGE_KEY}:corrupt-${Date.now()}`,
          raw,
        );
        warning = "原数据格式无法识别，已保留备份并启用空白记录。";
        return emptyStore();
      }

      const normalized = normalizeStore(parsed);
      if (!normalized) {
        window.localStorage.setItem(
          `${STORAGE_KEY}:corrupt-${Date.now()}`,
          raw,
        );
        warning = "原数据版本无法识别，已保留备份并启用空白记录。";
        return emptyStore();
      }
      return normalized;
    } catch {
      warning = "浏览器禁止访问本地存储，当前记录可能无法长期保存。";
      return emptyStore();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch {
      warning = "保存失败，请检查浏览器是否允许本地存储。";
      return false;
    }
  }

  function isActiveToday(habit) {
    return !habit.archivedDate && habit.createdDate <= today;
  }

  function isActiveOn(habit, key) {
    return (
      habit.createdDate <= key &&
      (!habit.archivedDate || key < habit.archivedDate)
    );
  }

  function activeHabits() {
    return store.habits.filter(isActiveToday);
  }

  function isChecked(habitId, key) {
    return store.checkIns.some(function (checkIn) {
      return checkIn.habitId === habitId && checkIn.date === key;
    });
  }

  function getSummary(key) {
    const habits = store.habits.filter(function (habit) {
      return isActiveOn(habit, key);
    });
    const completedCount = habits.filter(function (habit) {
      return isChecked(habit.id, key);
    }).length;
    return {
      habits: habits,
      totalCount: habits.length,
      completedCount: completedCount,
      isComplete: habits.length > 0 && completedCount === habits.length,
    };
  }

  function getStreak(habit) {
    let cursor = isChecked(habit.id, today)
      ? today
      : shiftDateKey(today, -1);
    let streak = 0;
    while (
      cursor >= habit.createdDate &&
      isChecked(habit.id, cursor)
    ) {
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
    }
    return streak;
  }

  function getGreeting(date) {
    const hour = date.getHours();
    if (hour < 5) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }

  function getEncouragement(summary) {
    if (summary.totalCount === 0) return "添加第一件想坚持的小事吧";
    if (summary.completedCount === summary.totalCount) {
      return "今天全部完成，给自己一点掌声";
    }
    if (summary.completedCount === 0) return "不用着急，从一个勾开始";
    if (summary.completedCount / summary.totalCount >= 0.5) {
      return "已经走过一半，保持这个节奏";
    }
    return "每一次完成，都算数";
  }

  function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ");
  }

  function validateName(name, editingId) {
    const normalized = normalizeName(name);
    if (!normalized) return "给习惯起一个名字吧";
    if (normalized.length > 20) return "习惯名称最多 20 个字符";
    const duplicate = activeHabits().some(function (habit) {
      return (
        habit.id !== editingId &&
        habit.name.toLocaleLowerCase() === normalized.toLocaleLowerCase()
      );
    });
    return duplicate ? "已经有同名习惯了" : null;
  }

  function addHabit(name, emoji, color) {
    clearUndo();
    const activeCount = activeHabits().length;
    store.habits.push({
      id: makeId(),
      name: normalizeName(name),
      emoji: emoji,
      color: color || COLORS[activeCount % COLORS.length],
      createdDate: today,
    });
    persist();
    renderApp();
  }

  function toggleCheckIn(habitId, key) {
    if (isChecked(habitId, key)) {
      store.checkIns = store.checkIns.filter(function (checkIn) {
        return !(checkIn.habitId === habitId && checkIn.date === key);
      });
    } else {
      store.checkIns.push({ habitId: habitId, date: key });
    }
    persist();
    renderApp();
  }

  function clearUndo() {
    if (undoTimer) {
      window.clearTimeout(undoTimer);
      undoTimer = null;
    }
    undoState = null;
  }

  function showUndo(habitId, name) {
    clearUndo();
    undoState = { habitId: habitId, name: name };
    undoTimer = window.setTimeout(function () {
      undoState = null;
      undoTimer = null;
      if (dialogState) {
        const toast = root.querySelector(".undo-toast");
        if (toast) toast.remove();
      } else {
        renderApp();
      }
    }, 5000);
  }

  function undoDelete() {
    if (!undoState) return;
    const habit = store.habits.find(function (item) {
      return item.id === undoState.habitId;
    });
    if (habit) {
      delete habit.archivedDate;
      persist();
    }
    clearUndo();
    renderApp();
  }

  function renderHabitRow(habit) {
    const checked = isChecked(habit.id, today);
    const streak = getStreak(habit);
    return `
      <article class="habit-row${checked ? " is-complete" : ""}">
        <div class="habit-emoji habit-emoji--${habit.color}" aria-hidden="true">${escapeHtml(habit.emoji)}</div>
        <div class="habit-copy">
          <h3>${escapeHtml(habit.name)}</h3>
          <p>${ICONS.sparkle}${streak > 0 ? `连续 ${streak} 天` : "今天，是新的开始"}</p>
        </div>
        <div class="habit-row__actions">
          <button class="icon-button" type="button" data-action="edit-habit" data-id="${escapeHtml(habit.id)}" aria-label="编辑${escapeHtml(habit.name)}" title="编辑习惯">${ICONS.edit}</button>
          <button class="icon-button icon-button--danger" type="button" data-action="delete-habit" data-id="${escapeHtml(habit.id)}" aria-label="删除${escapeHtml(habit.name)}" title="删除习惯">${ICONS.trash}</button>
        </div>
        <button class="habit-check" type="button" data-action="toggle-today" data-id="${escapeHtml(habit.id)}" aria-label="${checked ? "取消完成" : "完成"}${escapeHtml(habit.name)}" aria-pressed="${checked}">${ICONS.check}</button>
      </article>`;
  }

  function renderEmptyHabits() {
    return `
      <div class="empty-habits">
        <div class="empty-habits__art" aria-hidden="true"><span>🌱</span></div>
        <h3>从一个小习惯开始</h3>
        <p>不必一下子改变很多，选择今天最想做到的一件事。</p>
        <div class="suggestion-list" aria-label="快捷添加建议">
          ${SUGGESTIONS.map(function (item) {
            return `<button class="suggestion-chip" type="button" data-action="quick-add" data-name="${item.name}" data-emoji="${item.emoji}"><span>${item.emoji}</span>${item.name}${ICONS.plus}</button>`;
          }).join("")}
        </div>
        <button class="text-button" type="button" data-action="add-habit">自己添加一个${ICONS.right}</button>
      </div>`;
  }

  function calendarCells(month) {
    const first = firstOfMonth(month);
    const mondayOffset = (first.getDay() + 6) % 7;
    const lastDate = new Date(
      first.getFullYear(),
      first.getMonth() + 1,
      0,
    ).getDate();
    const totalCells = Math.ceil((mondayOffset + lastDate) / 7) * 7;
    const start = new Date(first);
    start.setDate(1 - mondayOffset);

    return Array.from({ length: totalCells }, function (_, index) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date: date,
        key: getDateKey(date),
        day: date.getDate(),
        outside: date.getMonth() !== month.getMonth(),
      };
    });
  }

  function renderCalendar() {
    return calendarCells(visibleMonth)
      .map(function (cell) {
        const summary = getSummary(cell.key);
        const isFuture = cell.key > today;
        const isSelected = cell.key === selectedDate;
        const isToday = cell.key === today;
        let state = "none";
        if (summary.totalCount > 0) {
          state = summary.isComplete
            ? "complete"
            : summary.completedCount > 0
              ? "partial"
              : "missed";
        }
        const label =
          summary.totalCount > 0
            ? `${formatShortDate(cell.key)}，完成 ${summary.completedCount} 项，共 ${summary.totalCount} 项`
            : `${formatShortDate(cell.key)}，没有习惯`;
        return `<button class="calendar-day calendar-day--${state}${cell.outside ? " is-outside" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${isFuture ? " is-future" : ""}" type="button" data-action="select-date" data-date="${cell.key}" ${isFuture ? "disabled" : ""} aria-label="${label}${isToday ? "，今天" : ""}" aria-pressed="${isSelected}"><span>${cell.day}</span>${summary.totalCount > 0 ? "<i></i>" : ""}</button>`;
      })
      .join("");
  }

  function renderDetail() {
    const summary = getSummary(selectedDate);
    const heading =
      selectedDate === today ? "今天" : formatShortDate(selectedDate);
    const rows = summary.habits
      .map(function (habit) {
        const checked = isChecked(habit.id, selectedDate);
        const archived = Boolean(habit.archivedDate);
        return `<button class="detail-check${checked ? " is-complete" : ""}" type="button" data-action="toggle-selected" data-id="${escapeHtml(habit.id)}" ${archived ? "disabled" : ""} aria-pressed="${checked}" aria-label="${archived ? "已归档，仅查看" : checked ? "取消完成" : "完成"}${escapeHtml(habit.name)}"><span class="mini-emoji habit-emoji--${habit.color}">${escapeHtml(habit.emoji)}</span><span class="detail-check__name">${escapeHtml(habit.name)}</span>${archived ? '<span class="archived-tag">已归档</span>' : ""}<span class="mini-check">${ICONS.check}</span></button>`;
      })
      .join("");
    const canBackfill = summary.habits.some(function (habit) {
      return !habit.archivedDate;
    });

    return `
      <section class="day-detail" role="region" aria-labelledby="day-detail-title">
        <div class="day-detail__heading">
          <div>
            <p class="section-kicker">${selectedDate === today ? "TODAY'S LOG" : "DAILY LOG"}</p>
            <h2 id="day-detail-title">${heading}</h2>
          </div>
          ${summary.totalCount > 0 ? `<span class="day-count"><strong>${summary.completedCount}</strong><span>/ ${summary.totalCount} 完成</span></span>` : ""}
        </div>
        ${
          summary.habits.length === 0
            ? `<div class="day-detail__empty"><span>☁️</span><p>${selectedDate === today ? "今天还没有习惯，先在左边添加一个吧。" : "这一天还没有可记录的习惯。"}</p></div>`
            : `<div class="detail-list">${rows}</div>`
        }
        ${
          selectedDate !== today && canBackfill
            ? `<p class="backfill-note">${ICONS.sparkle}想起来某天完成了？点击即可补记。</p>`
            : ""
        }
      </section>`;
  }

  function renderDialog() {
    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot || !dialogState) return;

    let content = "";
    if (dialogState.type === "habit") {
      const habit = dialogState.habitId
        ? store.habits.find(function (item) {
            return item.id === dialogState.habitId;
          })
        : null;
      const selectedEmoji = habit ? habit.emoji : EMOJIS[0];
      const selectedColor =
        habit?.color ||
        COLORS[activeHabits().length % COLORS.length];
      content = `
        <div class="modal-backdrop" data-action="close-backdrop">
          <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="habit-dialog-title">
            <button class="icon-button modal-close" type="button" data-action="close-dialog" aria-label="关闭">${ICONS.close}</button>
            <div class="modal-heading">
              <p class="eyebrow">${habit ? "调整一下" : "从小事开始"}</p>
              <h2 id="habit-dialog-title">${habit ? "编辑习惯" : "添加新习惯"}</h2>
              <p>每天一点点，慢慢长成喜欢的样子。</p>
            </div>
            <form class="habit-form" id="habit-form" data-mode="${habit ? "edit" : "add"}" data-habit-id="${habit ? escapeHtml(habit.id) : ""}">
              <label class="field-label" for="habit-name">习惯名称</label>
              <input class="text-input" id="habit-name" name="habit-name" value="${habit ? escapeHtml(habit.name) : ""}" maxlength="20" placeholder="比如：喝八杯水" autocomplete="off" aria-describedby="habit-name-error" />
              <div class="field-meta"><span class="field-error" id="habit-name-error" role="alert"></span><span>${habit ? escapeHtml(habit.name).length : 0}/20</span></div>
              <fieldset class="choice-group">
                <legend class="field-label">选一个图标</legend>
                <div class="emoji-grid">
                  ${EMOJIS.map(function (emoji) {
                    return `<button class="emoji-option${emoji === selectedEmoji ? " is-selected" : ""}" type="button" data-action="pick-emoji" data-value="${emoji}" aria-label="选择 ${emoji}" aria-pressed="${emoji === selectedEmoji}">${emoji}</button>`;
                  }).join("")}
                </div>
              </fieldset>
              <input type="hidden" name="habit-emoji" value="${escapeHtml(selectedEmoji)}" />
              <fieldset class="choice-group">
                <legend class="field-label">主题颜色</legend>
                <div class="color-options">
                  ${COLORS.map(function (color) {
                    return `<button class="color-option color-option--${color}${color === selectedColor ? " is-selected" : ""}" type="button" data-action="pick-color" data-value="${color}" aria-label="选择${COLOR_LABELS[color]}" aria-pressed="${color === selectedColor}"><span></span></button>`;
                  }).join("")}
                </div>
              </fieldset>
              <input type="hidden" name="habit-color" value="${selectedColor}" />
              <div class="modal-actions">
                <button class="button button--ghost" type="button" data-action="close-dialog">取消</button>
                <button class="button button--primary" type="submit">${habit ? "保存修改" : "添加习惯"}</button>
              </div>
            </form>
          </div>
        </div>`;
    } else {
      const habit = store.habits.find(function (item) {
        return item.id === dialogState.habitId;
      });
      content = `
        <div class="modal-backdrop" data-action="close-backdrop">
          <div class="modal-card modal-card--compact" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
            <button class="icon-button modal-close" type="button" data-action="close-dialog" aria-label="关闭">${ICONS.close}</button>
            <div class="modal-heading">
              <p class="eyebrow">要放下这个习惯吗？</p>
              <h2 id="delete-dialog-title">删除“${escapeHtml(habit ? habit.name : "")}”</h2>
              <p>它会从每日清单中移除，过去的打卡记录仍会保留。</p>
            </div>
            <div class="modal-actions">
              <button class="button button--ghost" type="button" data-action="close-dialog">再想想</button>
              <button class="button button--danger" type="button" data-action="confirm-delete">确认删除</button>
            </div>
          </div>
        </div>`;
    }

    modalRoot.innerHTML = content;
    document.body.style.overflow = "hidden";
    const focusTarget = modalRoot.querySelector(
      dialogState.type === "habit" ? "#habit-name" : "[data-action='close-dialog']",
    );
    if (focusTarget) focusTarget.focus();
  }

  function openHabitDialog(habitId) {
    lastFocused = document.activeElement;
    dialogState = { type: "habit", habitId: habitId || null };
    renderDialog();
  }

  function openDeleteDialog(habitId) {
    lastFocused = document.activeElement;
    dialogState = { type: "delete", habitId: habitId };
    renderDialog();
  }

  function closeDialog(shouldRender) {
    const focusTarget = lastFocused;
    dialogState = null;
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot) modalRoot.innerHTML = "";
    document.body.style.overflow = "";
    if (shouldRender !== false) {
      renderApp();
    }
    if (
      shouldRender === false &&
      focusTarget &&
      typeof focusTarget.focus === "function"
    ) {
      focusTarget.focus();
    }
    lastFocused = null;
  }

  function renderApp() {
    const summary = getSummary(today);
    const active = activeHabits();
    const circumference = 2 * Math.PI * 48;
    const progress =
      summary.totalCount === 0
        ? 0
        : summary.completedCount / summary.totalCount;
    const rows = active.map(renderHabitRow).join("");
    const warningMarkup = warning
      ? `<div class="storage-warning" role="alert"><span>${escapeHtml(warning)}</span><button type="button" data-action="dismiss-warning">知道了</button></div>`
      : "";
    const undoMarkup = undoState
      ? `<div class="undo-toast" role="status"><span>“${escapeHtml(undoState.name)}”已从每日清单移除</span><button type="button" data-action="undo-delete">撤销</button><button class="undo-toast__close" type="button" data-action="clear-undo" aria-label="关闭提示">×</button></div>`
      : "";

    root.innerHTML = `
      <div class="app-shell">
        <div class="ambient-shape ambient-shape--one" aria-hidden="true"></div>
        <div class="ambient-shape ambient-shape--two" aria-hidden="true"></div>
        <header class="site-header">
          <div class="brand">
            <span class="brand-mark">${ICONS.leaf}</span>
            <div><strong>微光习惯</strong><span>把日子过成喜欢的样子</span></div>
          </div>
          <div class="date-chip"><span>${getGreeting(now)}</span><strong>${formatLongDate(now)}</strong></div>
        </header>
        ${warningMarkup}
        <main>
          <section class="hero" aria-labelledby="hero-title">
            <div class="hero-copy">
              <p class="eyebrow"><span></span>今日的小小坚持</p>
              <h1 id="hero-title">把简单的重复，<br />变成<span>看得见的光。</span></h1>
              <p class="hero-description">${getEncouragement(summary)}</p>
            </div>
            <div class="today-progress">
              <div class="progress-ring" role="img" aria-label="今日完成 ${summary.completedCount} 项，共 ${summary.totalCount} 项">
                <svg viewBox="0 0 116 116" aria-hidden="true">
                  <circle class="progress-ring__track" cx="58" cy="58" r="48"></circle>
                  <circle class="progress-ring__value" cx="58" cy="58" r="48" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - progress)}"></circle>
                </svg>
                <div class="progress-ring__label"><strong>${summary.completedCount}</strong><span>/ ${summary.totalCount}</span></div>
              </div>
              <div class="today-progress__copy">
                <span>今日完成</span>
                <strong aria-live="polite">${summary.completedCount}<small> / ${summary.totalCount} 项</small></strong>
                <p>${summary.totalCount === 0 ? "等待种下第一个习惯" : summary.isComplete ? "满格的一天，很棒" : `还有 ${summary.totalCount - summary.completedCount} 项可以做`}</p>
              </div>
            </div>
          </section>
          <div class="dashboard-grid">
            <section class="panel habits-panel" aria-labelledby="habits-title">
              <div class="panel-heading">
                <div><p class="section-kicker">DAILY RHYTHM</p><h2 id="habits-title">今日习惯</h2></div>
                ${active.length > 0 ? `<button class="button button--primary button--small" type="button" data-action="add-habit">${ICONS.plus}添加习惯</button>` : ""}
              </div>
              ${active.length === 0 ? renderEmptyHabits() : `<div class="habit-list">${rows}</div>`}
              ${active.length > 0 ? `<div class="habits-footer"><span>${ICONS.leaf}不追求完美，只记录真实</span><span>${active.length} 个习惯正在生长</span></div>` : ""}
            </section>
            <section class="panel calendar-panel" aria-labelledby="calendar-title">
              <div class="calendar-heading">
                <div><p class="section-kicker">YOUR JOURNEY</p><h2 id="calendar-title">${formatMonth(visibleMonth)}</h2></div>
                <div class="calendar-nav">
                  <button class="icon-button" type="button" data-action="prev-month" aria-label="上个月">${ICONS.left}</button>
                  <button class="icon-button" type="button" data-action="next-month" aria-label="下个月">${ICONS.right}</button>
                </div>
              </div>
              <div class="calendar-grid calendar-grid--labels" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div>
              <div class="calendar-grid" aria-label="打卡月历">${renderCalendar()}</div>
              <div class="calendar-legend" aria-label="日历图例">
                <span><i class="legend-dot legend-dot--complete"></i>全部完成</span>
                <span><i class="legend-dot legend-dot--partial"></i>完成一部分</span>
                <span><i class="legend-dot legend-dot--missed"></i>未完成</span>
              </div>
              <button class="today-link" type="button" data-action="go-today">${selectedDate === today ? "正在查看今天" : "回到今天"}${ICONS.right}</button>
            </section>
          </div>
          ${renderDetail()}
        </main>
        <footer class="site-footer"><span>${ICONS.leaf}微光习惯</span><p>所有记录只保存在当前浏览器中</p></footer>
        <div id="modal-root"></div>
        ${undoMarkup}
      </div>`;
  }

  function syncClock() {
    now = new Date();
    const freshToday = getDateKey(now);
    const previousToday = today;
    const hourChanged = now.getHours() !== lastClockHour;
    lastClockHour = now.getHours();

    if (freshToday !== previousToday) {
      if (selectedDate === previousToday) {
        selectedDate = freshToday;
        visibleMonth = firstOfMonth(now);
      }
      today = freshToday;
    }

    if (!dialogState && (freshToday !== previousToday || hourChanged)) {
      renderApp();
    }
  }

  function selectDate(key) {
    selectedDate = key;
    const date = fromDateKey(key);
    if (
      date.getFullYear() !== visibleMonth.getFullYear() ||
      date.getMonth() !== visibleMonth.getMonth()
    ) {
      visibleMonth = firstOfMonth(date);
    }
    renderApp();
  }

  function dismissWarning() {
    warning = null;
    renderApp();
  }

  function pickEmoji(button) {
    const form = button.closest("#habit-form");
    if (!form) return;
    form.querySelectorAll("[data-action='pick-emoji']").forEach(function (item) {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    form.elements["habit-emoji"].value = button.dataset.value;
  }

  function pickColor(button) {
    const form = button.closest("#habit-form");
    if (!form) return;
    form.querySelectorAll("[data-action='pick-color']").forEach(function (item) {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    form.elements["habit-color"].value = button.dataset.value;
  }

  document.addEventListener("input", function (event) {
    if (event.target.id !== "habit-name") return;
    const form = event.target.closest("#habit-form");
    const counter = form.querySelector(".field-meta span:last-child");
    const error = form.querySelector("#habit-name-error");
    counter.textContent = `${event.target.value.length}/20`;
    error.textContent = "";
    event.target.classList.remove("text-input--error");
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id !== "habit-form") return;
    event.preventDefault();
    const form = event.target;
    const name = form.elements["habit-name"].value;
    const editingId = form.dataset.habitId || null;
    const error = validateName(name, editingId);
    const errorElement = form.querySelector("#habit-name-error");
    const input = form.elements["habit-name"];
    if (error) {
      errorElement.textContent = error;
      input.classList.add("text-input--error");
      input.focus();
      return;
    }

    const emoji = form.elements["habit-emoji"].value;
    const color = form.elements["habit-color"].value;
    if (editingId) {
      const habit = store.habits.find(function (item) {
        return item.id === editingId;
      });
      if (habit) Object.assign(habit, { name: normalizeName(name), emoji, color });
      persist();
      closeDialog(false);
      renderApp();
    } else {
      closeDialog(false);
      addHabit(name, emoji, color);
    }
  });

  document.addEventListener("click", function (event) {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action;

    if (action === "close-backdrop" && event.target !== actionElement) return;
    if (action === "quick-add") {
      addHabit(actionElement.dataset.name, actionElement.dataset.emoji);
    } else if (action === "add-habit") {
      openHabitDialog();
    } else if (action === "edit-habit") {
      openHabitDialog(actionElement.dataset.id);
    } else if (action === "delete-habit") {
      openDeleteDialog(actionElement.dataset.id);
    } else if (action === "toggle-today") {
      toggleCheckIn(actionElement.dataset.id, today);
    } else if (action === "toggle-selected") {
      toggleCheckIn(actionElement.dataset.id, selectedDate);
    } else if (action === "select-date") {
      selectDate(actionElement.dataset.date);
    } else if (action === "prev-month") {
      visibleMonth = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() - 1,
        1,
        12,
      );
      renderApp();
    } else if (action === "next-month") {
      visibleMonth = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + 1,
        1,
        12,
      );
      renderApp();
    } else if (action === "go-today") {
      selectedDate = today;
      visibleMonth = firstOfMonth(fromDateKey(today));
      renderApp();
    } else if (action === "dismiss-warning") {
      dismissWarning();
    } else if (action === "close-dialog") {
      closeDialog();
    } else if (action === "confirm-delete") {
      const habit = store.habits.find(function (item) {
        return item.id === dialogState.habitId;
      });
      if (habit) {
        habit.archivedDate = today;
        persist();
        closeDialog(false);
        showUndo(habit.id, habit.name);
        renderApp();
      }
    } else if (action === "undo-delete") {
      undoDelete();
    } else if (action === "clear-undo") {
      clearUndo();
      renderApp();
    } else if (action === "pick-emoji") {
      pickEmoji(actionElement);
    } else if (action === "pick-color") {
      pickColor(actionElement);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (!dialogState) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;

    const modal = document.querySelector(".modal-card");
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const nextStore = normalizeStore(JSON.parse(event.newValue));
      if (!nextStore) return;
      store = nextStore;
      if (!dialogState) renderApp();
    } catch {
      warning = "同步其他页面中的更改失败，请刷新后重试。";
      if (!dialogState) renderApp();
    }
  });

  window.addEventListener("focus", syncClock);
  document.addEventListener("visibilitychange", syncClock);

  store = loadStore();
  renderApp();
  window.setInterval(syncClock, 30000);
})();
