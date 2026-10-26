import { useState, type FormEvent } from "react";
import {
  EMOJI_OPTIONS,
  normalizeHabitName,
  validateHabitName,
} from "../lib/habits";
import {
  HABIT_COLORS,
  type Habit,
  type HabitColor,
} from "../types";
import { ModalShell } from "./ModalShell";

interface HabitDialogProps {
  habit?: Habit;
  habits: Habit[];
  suggestedColor: HabitColor;
  onClose: () => void;
  onSave: (draft: {
    name: string;
    emoji: string;
    color: HabitColor;
  }) => void;
}

const COLOR_LABELS: Record<HabitColor, string> = {
  mint: "薄荷绿",
  coral: "珊瑚橙",
  sun: "暖阳黄",
  sky: "天空蓝",
  lilac: "丁香紫",
};

export function HabitDialog({
  habit,
  habits,
  suggestedColor,
  onClose,
  onSave,
}: HabitDialogProps) {
  const titleId = "habit-dialog-title";
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? EMOJI_OPTIONS[0]);
  const [color, setColor] = useState(habit?.color ?? suggestedColor);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateHabitName(name, habits, habit?.id);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSave({
      name: normalizeHabitName(name),
      emoji,
      color,
    });
  }

  return (
    <ModalShell
      titleId={titleId}
      onClose={onClose}
      initialFocusSelector="#habit-name"
    >
      <div className="modal-heading">
        <p className="eyebrow">{habit ? "调整一下" : "从小事开始"}</p>
        <h2 id={titleId}>{habit ? "编辑习惯" : "添加新习惯"}</h2>
        <p>每天一点点，慢慢长成喜欢的样子。</p>
      </div>

      <form className="habit-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="habit-name">
          习惯名称
        </label>
        <input
          id="habit-name"
          className={`text-input${error ? " text-input--error" : ""}`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          maxLength={20}
          placeholder="比如：喝八杯水"
          autoComplete="off"
          aria-describedby={error ? "habit-name-error" : undefined}
        />
        <div className="field-meta">
          <span
            id="habit-name-error"
            className="field-error"
            role={error ? "alert" : undefined}
          >
            {error}
          </span>
          <span>{name.length}/20</span>
        </div>

        <fieldset className="choice-group">
          <legend className="field-label">选一个图标</legend>
          <div className="emoji-grid">
            {EMOJI_OPTIONS.map((option) => (
              <button
                className={`emoji-option${emoji === option ? " is-selected" : ""}`}
                type="button"
                key={option}
                onClick={() => setEmoji(option)}
                aria-label={`选择 ${option}`}
                aria-pressed={emoji === option}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice-group">
          <legend className="field-label">主题颜色</legend>
          <div className="color-options">
            {HABIT_COLORS.map((option) => (
              <button
                className={`color-option color-option--${option}${
                  color === option ? " is-selected" : ""
                }`}
                type="button"
                key={option}
                onClick={() => setColor(option)}
                aria-label={`选择${COLOR_LABELS[option]}`}
                aria-pressed={color === option}
              >
                <span />
              </button>
            ))}
          </div>
        </fieldset>

        <div className="modal-actions">
          <button className="button button--ghost" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button button--primary" type="submit">
            {habit ? "保存修改" : "添加习惯"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
