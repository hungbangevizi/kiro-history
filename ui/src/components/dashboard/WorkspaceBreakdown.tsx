import type { WorkspaceStat, ModelStat } from '../../lib/stats';

const MODEL_COLORS: Record<string, string> = {
  sonnet: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  opus:   'bg-purple-500/15 text-purple-300 border-purple-400/40',
  haiku:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

function modelChipClass(model: string): string {
  const m = model.toLowerCase();
  for (const [key, cls] of Object.entries(MODEL_COLORS)) {
    if (m.includes(key)) return cls;
  }
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'; // Auto or unknown
}

function shortModelName(model: string): string {
  // "claude-sonnet-4-6" → "Sonnet 4.6", "auto" → "Auto"
  if (model === 'unknown') return 'Unknown';
  return model
    .replace(/^claude-/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/(\d+) (\d+)/g, '$1.$2'); // "4 6" → "4.6"
}

interface WorkspaceBreakdownProps {
  wsStats:    WorkspaceStat[];
  modelStats: ModelStat[];
}

export function WorkspaceBreakdown({ wsStats, modelStats }: WorkspaceBreakdownProps) {
  return (
    <div className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg p-4">
      {/* Workspace bars */}
      <h3 className="text-sm font-semibold text-[rgb(var(--foreground))] mb-3">
        Top Workspaces
        <span className="ml-2 text-[10px] font-normal text-[rgb(var(--foreground-muted))]">
          by est. credits
        </span>
      </h3>

      {wsStats.length === 0 ? (
        <p className="text-[11px] text-[rgb(var(--foreground-muted))]">No data for this period.</p>
      ) : (
        <div className="space-y-2.5">
          {wsStats.map(ws => (
            <div key={ws.name} className="flex items-center gap-2">
              <div
                className="text-[11px] text-[rgb(var(--foreground-muted))] w-32 truncate shrink-0"
                title={ws.name}
              >
                {ws.name}
              </div>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-400/40 transition-all"
                  style={{ width: `${ws.pct}%` }}
                />
              </div>
              <div className="text-[10px] text-amber-400 w-14 text-right shrink-0 font-medium tabular-nums">
                ~{ws.credits.toFixed(1)} cr
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model breakdown */}
      <div className="mt-4 pt-3 border-t border-[rgb(var(--border))]">
        <h4 className="text-[11px] font-semibold text-[rgb(var(--foreground))] mb-2">
          Model Breakdown
        </h4>
        {modelStats.length === 0 ? (
          <p className="text-[11px] text-[rgb(var(--foreground-muted))]">No model data available.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {modelStats.map(m => (
              <div
                key={m.model}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium ${modelChipClass(m.model)}`}
                title={`${m.turns} turn${m.turns !== 1 ? 's' : ''}`}
              >
                {shortModelName(m.model)}
                <span className="opacity-60">{m.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
