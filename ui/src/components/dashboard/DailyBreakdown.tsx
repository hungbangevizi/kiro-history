import type { DayStat } from '../../lib/stats';
import { friendlyDate } from '../../lib/stats';

interface DailyBreakdownProps {
  stats:    DayStat[];
  onExport: () => void;
}

export function DailyBreakdown({ stats, onExport }: DailyBreakdownProps) {
  return (
    <div className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))]">
        <h3 className="text-sm font-semibold text-[rgb(var(--foreground))]">Daily Breakdown</h3>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
        >
          ⬇ Export (.xlsx)
        </button>
      </div>

      {stats.length === 0 ? (
        <div className="px-4 py-8 text-center text-[rgb(var(--foreground-muted))] text-sm">
          No sessions in this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]">
                {['Date', 'Sessions', 'Turns', 'Requests', 'Est. Credits', 'Top Model', 'Workspaces'].map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(day => {
                const isToday = day.date === new Date().toISOString().slice(0, 10);
                return (
                  <tr
                    key={day.date}
                    className="border-b border-[rgb(var(--border))]/50 last:border-0 hover:bg-[rgb(var(--background-hover))] transition-colors"
                  >
                    <td className={`px-3 py-2.5 text-[11px] font-semibold ${isToday ? 'text-cyan-400' : 'text-[rgb(var(--foreground))]'}`}>
                      {friendlyDate(day.date)}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[rgb(var(--foreground))] tabular-nums">
                      {day.sessions || <span className="text-[rgb(var(--foreground-muted))]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[rgb(var(--foreground))] tabular-nums">
                      {day.turns || <span className="text-[rgb(var(--foreground-muted))]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[rgb(var(--foreground))] tabular-nums">
                      {day.requests || <span className="text-[rgb(var(--foreground-muted))]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] tabular-nums">
                      {day.creditCost > 0 ? (
                        <span className="text-amber-400">
                          ~{day.creditCost.toFixed(2)}
                          {day.isEstimated && (
                            <span className="ml-1 text-[9px] text-[rgb(var(--foreground-muted))] bg-white/5 rounded px-1">est.</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[rgb(var(--foreground-muted))]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-purple-400">
                      {day.topModel !== '—' ? day.topModel : <span className="text-[rgb(var(--foreground-muted))]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-[rgb(var(--foreground-muted))] max-w-[200px] truncate">
                      {day.workspaces.length > 0 ? day.workspaces.join(', ') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
