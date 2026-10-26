interface ProgressRingProps {
  completed: number;
  total: number;
}

export function ProgressRing({ completed, total }: ProgressRingProps) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : completed / total;

  return (
    <div
      className="progress-ring"
      role="img"
      aria-label={`今日完成 ${completed} 项，共 ${total} 项`}
    >
      <svg viewBox="0 0 116 116" aria-hidden="true">
        <circle className="progress-ring__track" cx="58" cy="58" r={radius} />
        <circle
          className="progress-ring__value"
          cx="58"
          cy="58"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="progress-ring__label">
        <strong>{completed}</strong>
        <span>/ {total}</span>
      </div>
    </div>
  );
}
