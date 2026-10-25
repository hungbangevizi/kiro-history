interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'cyan' | 'amber' | 'emerald' | 'purple' | 'red' | 'default';
}

const COLOR_MAP: Record<NonNullable<StatsCardProps['color']>, string> = {
  cyan:    'text-cyan-400',
  amber:   'text-amber-400',
  emerald: 'text-emerald-400',
  purple:  'text-purple-400',
  red:     'text-red-400',
  default: 'text-[rgb(var(--foreground))]',
};

export function StatsCard({ label, value, sub, color = 'default' }: StatsCardProps) {
  return (
    <div className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg p-4">
      <div className="text-[10px] text-[rgb(var(--foreground-muted))] uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`text-2xl font-bold leading-none ${COLOR_MAP[color]}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-[rgb(var(--foreground-muted))] mt-2">
          {sub}
        </div>
      )}
    </div>
  );
}
