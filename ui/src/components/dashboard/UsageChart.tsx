import { useState } from 'react';
import type { ChartPoint } from '../../lib/stats';

type Metric = 'credits' | 'requests' | 'sessions';

const METRIC_LABELS: Record<Metric, string> = {
  credits:  'Credits',
  requests: 'Requests',
  sessions: 'Sessions',
};

interface UsageChartProps {
  data: ChartPoint[];
}

export function UsageChart({ data }: UsageChartProps) {
  const [metric, setMetric] = useState<Metric>('credits');

  const values  = data.map(d => d[metric] as number);
  const maxVal  = Math.max(...values, 0.001);

  return (
    <div className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg p-4">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[rgb(var(--foreground))]">Daily Usage</h3>
        <div className="flex gap-0.5 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-md p-0.5">
          {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                metric === m
                  ? 'bg-cyan-500/15 text-cyan-400'
                  : 'text-[rgb(var(--foreground-muted))] hover:text-[rgb(var(--foreground))]'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* bars */}
      <div className="flex items-end gap-1 px-1" style={{ height: '140px' }}>
        {data.map(point => {
          const val  = point[metric] as number;
          const pct  = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const show = val > 0;

          return (
            <div
              key={point.date}
              className="flex-1 flex flex-col items-center gap-0.5 group relative min-w-0"
            >
              {/* hover tooltip */}
              {show && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[10px] text-[rgb(var(--foreground))] whitespace-nowrap shadow-lg">
                    {metric === 'credits'
                      ? `~${val.toFixed(2)} cr`
                      : `${val} ${metric}`}
                  </div>
                </div>
              )}

              {/* bar column */}
              <div className="w-full flex items-end" style={{ height: '110px' }}>
                {show ? (
                  <div
                    className={`w-full rounded-t-sm transition-all duration-200 ${
                      point.isToday
                        ? 'bg-cyan-400/65 border-t-2 border-cyan-400'
                        : 'bg-cyan-400/20 border-t border-cyan-400/40 group-hover:bg-cyan-400/35'
                    }`}
                    style={{ height: `${Math.max(pct, 3)}%` }}
                  />
                ) : (
                  <div className="w-full" style={{ height: '2px' }} />
                )}
              </div>

              {/* x-axis label */}
              {point.label && (
                <div
                  className={`text-[9px] truncate max-w-full leading-none ${
                    point.isToday
                      ? 'text-cyan-400 font-medium'
                      : 'text-[rgb(var(--foreground-muted))]'
                  }`}
                >
                  {point.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
