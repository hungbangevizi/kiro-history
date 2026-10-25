import { useState, useMemo, useEffect } from 'react';
import type { PromptRecord } from '../../lib/stats';

// ── Types ──────────────────────────────────────────────────────────────

type SortOption = 'credits-desc' | 'credits-asc' | 'requests-desc' | 'date-desc' | 'date-asc';
type CostTier   = 'all' | 'high' | 'mid' | 'low';

const PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────

function creditColorClass(cost: number): string {
  if (cost > 2)   return 'text-red-400';
  if (cost >= 0.5) return 'text-amber-400';
  return 'text-emerald-400';
}

function modelChipClass(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('opus'))   return 'bg-purple-500/15 text-purple-300 border-purple-400/40';
  if (m.includes('sonnet')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  if (m.includes('haiku'))  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
}

function shortModel(model: string): string {
  if (model === 'unknown') return 'Unknown';
  return model
    .replace(/^claude-/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/(\d+) (\d+)/g, '$1.$2');
}

// ── Component ──────────────────────────────────────────────────────────

interface PromptTrackerProps {
  records:  PromptRecord[];
  onExport: (filtered: PromptRecord[]) => void;
}

export function PromptTracker({ records, onExport }: PromptTrackerProps) {
  const [search,      setSearch]      = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [costTier,    setCostTier]    = useState<CostTier>('all');
  const [sortBy,      setSortBy]      = useState<SortOption>('credits-desc');
  const [page,        setPage]        = useState(0);

  // Unique models in the dataset
  const models = useMemo(() => {
    const s = new Set(records.map(r => r.model).filter(m => m !== 'unknown'));
    return Array.from(s).sort();
  }, [records]);

  // Filter + sort
  const filtered = useMemo(() => {
    let r = records;

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p => p.promptPreview.toLowerCase().includes(q) || p.workspace.toLowerCase().includes(q));
    }

    if (modelFilter !== 'all') r = r.filter(p => p.model === modelFilter);

    if (costTier === 'high') r = r.filter(p => p.creditCost > 2);
    if (costTier === 'mid')  r = r.filter(p => p.creditCost >= 0.5 && p.creditCost <= 2);
    if (costTier === 'low')  r = r.filter(p => p.creditCost < 0.5);

    return [...r].sort((a, b) => {
      switch (sortBy) {
        case 'credits-desc':  return b.creditCost   - a.creditCost;
        case 'credits-asc':   return a.creditCost   - b.creditCost;
        case 'requests-desc': return b.requestCount - a.requestCount;
        case 'date-desc':     return b.date.localeCompare(a.date);
        case 'date-asc':      return a.date.localeCompare(b.date);
        default:              return 0;
      }
    });
  }, [records, search, modelFilter, costTier, sortBy]);

  // Reset to page 0 whenever filters change
  useEffect(() => setPage(0), [search, modelFilter, costTier, sortBy]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Mini summary over filtered set
  const totalCost     = filtered.reduce((s, r) => s + r.creditCost, 0);
  const avgCost       = filtered.length > 0 ? totalCost / filtered.length : 0;
  const maxCost       = filtered.reduce((m, r) => Math.max(m, r.creditCost), 0);
  const hasEstimates  = filtered.some(r => r.isEstimated);

  return (
    <div className="space-y-3">

      {/* ── Mini summary ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Prompts',        value: filtered.length.toString(),                  color: 'text-[rgb(var(--foreground))]' },
          { label: 'Total Credits',  value: `${hasEstimates ? '~' : ''}${totalCost.toFixed(2)}`, color: 'text-amber-400' },
          { label: 'Avg per Prompt', value: `${hasEstimates ? '~' : ''}${avgCost.toFixed(2)}`,   color: 'text-cyan-400' },
          { label: 'Most Expensive', value: `${hasEstimates ? '~' : ''}${maxCost.toFixed(2)}`,   color: 'text-red-400' },
        ].map(card => (
          <div key={card.label} className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg px-4 py-3">
            <div className="text-[10px] text-[rgb(var(--foreground-muted))] uppercase tracking-wider mb-1.5">{card.label}</div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search prompts or workspaces…"
          className="flex-1 min-w-[200px] bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] text-[rgb(var(--foreground))] text-xs rounded-md px-3 py-2 placeholder:text-[rgb(var(--foreground-muted))] focus:outline-none focus:border-cyan-500/50"
        />

        {/* Model filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[rgb(var(--foreground-muted))]">Model:</span>
          <button
            onClick={() => setModelFilter('all')}
            className={`px-2.5 py-1 rounded-full border text-[10px] font-medium transition-colors ${
              modelFilter === 'all'
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                : 'border-[rgb(var(--border))] text-[rgb(var(--foreground-muted))] hover:text-[rgb(var(--foreground))]'
            }`}
          >
            All
          </button>
          {models.map(m => (
            <button
              key={m}
              onClick={() => setModelFilter(modelFilter === m ? 'all' : m)}
              className={`px-2.5 py-1 rounded-full border text-[10px] font-medium transition-colors ${
                modelFilter === m
                  ? modelChipClass(m)
                  : 'border-[rgb(var(--border))] text-[rgb(var(--foreground-muted))] hover:text-[rgb(var(--foreground))]'
              }`}
            >
              {shortModel(m)}
            </button>
          ))}
        </div>

        {/* Cost tier filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[rgb(var(--foreground-muted))]">Cost:</span>
          {([
            ['all',  'All',      'border-[rgb(var(--border))] text-[rgb(var(--foreground-muted))]'],
            ['high', '>2 cr',    'bg-red-500/10 text-red-400 border-red-500/30'],
            ['mid',  '0.5–2 cr', 'bg-amber-500/10 text-amber-400 border-amber-500/30'],
            ['low',  '<0.5 cr',  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'],
          ] as [CostTier, string, string][]).map(([tier, label, activeClass]) => (
            <button
              key={tier}
              onClick={() => setCostTier(costTier === tier ? 'all' : tier)}
              className={`px-2.5 py-1 rounded-full border text-[10px] font-medium transition-colors ${
                costTier === tier ? activeClass : 'border-[rgb(var(--border))] text-[rgb(var(--foreground-muted))] hover:text-[rgb(var(--foreground))]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortOption)}
          className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] text-[rgb(var(--foreground))] text-[11px] rounded-md px-2 py-1.5 focus:outline-none"
        >
          <option value="credits-desc">Highest cost</option>
          <option value="credits-asc">Lowest cost</option>
          <option value="requests-desc">Most requests</option>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
        </select>

        {/* Export */}
        <button
          onClick={() => onExport(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⬇ Export (.xlsx)
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg overflow-hidden">
        {pageItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-[rgb(var(--foreground-muted))] text-sm">
            No prompts match the current filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))]">Prompt</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))] whitespace-nowrap">Credits ↓</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))]">Model</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))]">Requests</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))]">Tools</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))]">Workspace</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--foreground-muted))]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((rec, idx) => (
                    <tr
                      key={`${rec.sessionId}-${idx}`}
                      className="border-b border-[rgb(var(--border))]/40 last:border-0 hover:bg-[rgb(var(--background-hover))] transition-colors"
                    >
                      {/* Prompt */}
                      <td className="px-3 py-2.5 max-w-xs">
                        <div className="text-[11px] text-[rgb(var(--foreground))] leading-relaxed line-clamp-2">
                          {rec.promptPreview}
                          {rec.promptPreview.length >= 120 && '…'}
                        </div>
                      </td>

                      {/* Credits */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold tabular-nums ${creditColorClass(rec.creditCost)}`}>
                          {rec.isEstimated ? '~' : ''}{rec.creditCost.toFixed(2)}
                        </span>
                        {rec.isEstimated && (
                          <span className="ml-1 text-[8px] text-[rgb(var(--foreground-muted))] bg-white/5 rounded px-1">est.</span>
                        )}
                        {/* mini bar */}
                        <div className="mt-1 w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rec.creditCost > 2 ? 'bg-red-400' : rec.creditCost >= 0.5 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(rec.creditCost / 4 * 100, 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Model */}
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-medium ${modelChipClass(rec.model)}`}>
                          {shortModel(rec.model)}
                        </span>
                      </td>

                      {/* Requests */}
                      <td className="px-3 py-2.5 text-[11px] text-[rgb(var(--foreground-muted))] tabular-nums">{rec.requestCount}</td>

                      {/* Tools */}
                      <td className="px-3 py-2.5 text-[11px] text-[rgb(var(--foreground-muted))] tabular-nums">{rec.toolCount}</td>

                      {/* Workspace */}
                      <td className="px-3 py-2.5 text-[10px] text-[rgb(var(--foreground-muted))] max-w-[120px] truncate" title={rec.workspace}>
                        {rec.workspace}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 text-[10px] text-[rgb(var(--foreground-muted))] whitespace-nowrap">{rec.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[rgb(var(--border))] text-[11px] text-[rgb(var(--foreground-muted))]">
                <span>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 rounded border border-[rgb(var(--border))] disabled:opacity-30 hover:bg-[rgb(var(--background-hover))] transition-colors"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
                    // Show pages around current page
                    const mid   = Math.min(Math.max(page, 3), pageCount - 4);
                    const start = Math.max(0, mid - 3);
                    const idx   = start + i;
                    if (idx >= pageCount) return null;
                    return (
                      <button
                        key={idx}
                        onClick={() => setPage(idx)}
                        className={`px-2.5 py-1 rounded border text-[10px] transition-colors ${
                          idx === page
                            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                            : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--background-hover))]'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    className="px-2 py-1 rounded border border-[rgb(var(--border))] disabled:opacity-30 hover:bg-[rgb(var(--background-hover))] transition-colors"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
