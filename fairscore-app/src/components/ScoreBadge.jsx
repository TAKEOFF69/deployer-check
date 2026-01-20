import { getTierColor, getTierGlowClass } from '../services/fairscale';

export default function ScoreBadge({ score, tier, size = 'default' }) {
  const color = getTierColor(tier);
  const glowClass = getTierGlowClass(tier);

  const sizeClasses = {
    small: 'text-sm px-2 py-0.5',
    default: 'text-base px-3 py-1',
    large: 'text-lg px-4 py-2'
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`
      }}
    >
      <span className={glowClass}>{tier}</span>
      {score !== undefined && (
        <span className="ml-2 font-mono">{score}</span>
      )}
    </span>
  );
}

export function ScoreNumber({ score, tier, animated = true }) {
  const color = getTierColor(tier);
  const glowClass = getTierGlowClass(tier);

  return (
    <div className={`text-center ${animated ? 'animate-score-reveal' : ''}`}>
      <div
        className={`text-7xl font-bold font-mono ${glowClass}`}
        style={{ color }}
      >
        {score}
      </div>
      <div className="mt-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${(score / 1000) * 100}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
}
