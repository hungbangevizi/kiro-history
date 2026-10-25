import { useState, useMemo } from 'react';
import type { ParsedConversation } from '../types';
import type { Period, PromptRecord } from '../lib/stats';
import {
  filterByPeriod,
  buildChartPoints,
  buildSummaryStats,
  buildDailyStats,
  buildPromptRecords,
  buildWorkspaceStats,
  buildModelStats,
} from '../lib/stats';
import { exportDailyReport, exportPromptReport } from '../lib/export';
import { StatsCard }          from './dashboard/StatsCard';
import { UsageChart }         from './dashboard/UsageChart';
import { WorkspaceBreakdown } from './dashboard/WorkspaceBreakdown';
import { DailyBreakdown }     from './dashboard/DailyBreakdown';
import { PromptTracker }      from './dashboard/PromptTracker';

type DashTab = 'overview' | 'prompts';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today'       },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days'},
  { value: 'month', label: 'This month'  },
];

interface DashboardProps {
  conversations: ParsedConversation[];
}

export function Dashboard({ conversations }: DashboardProps) {
  const [period,  setPeriod]  = useState<Period>('7d');
  const [dashTab, setDashTab] = useState<DashTab>('overview');

  // ── Derived data ────────────────────────────────────────────────────
  const filtered     = useMemo(() => filterByPeriod(conversations, period), [conversations, period]);
  const chartPoints  = useMemo(() => buildChartPoints(conversations, period),  [conversations, period]);
  const summary      = useMemo(() => buildSummaryStats(filtered),  [filtered]);
  const dailyStats   = useMemo(() => buildDailyStats(conversations, period),   [conversations, period]);
  const promptRecs   = useMemo(() => buildPromptRecords(filtered),  [filtered]);
  const wsStats      = useMemo(() => buildWorkspaceStats(filtered), [filtered]);
  const modelStats   = useMemo(() => buildModelStats(filtered),     [filtered]);

  // ── Export handlers ─────────────────────────────────────────────────
  function handleExportDaily() {
    exportDailyReport(dailyStats, period);
  }

  function handleExportPrompts(records: PromptRecord[]) {
    exportPromptReport(records);
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  const credPrefix = summary.hasEstimates ? '~' : '';

  function shortModel(m: string): string {
    if (!m || m === 'unknown') return 'Unknown';
    return m.replace(/^claude-/i, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/(\d+) (\d+)/g, '$1.$2');
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* ── Header row ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* Sub-tab toggle */}
          <div className="flex gap-1 border-b border-[rgb(var(--border))]">
            {([
              ['overview', 'Overview'],
              ['prompts',  'Prompt Tracker'],
            ] as [DashTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setDashTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  dashTab === tab
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-[rgb(var(--foreground-muted))] border-transparent hover:text-[rgb(var(--foreground))]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period selector */}
          <div className="flex gap-0.5 bg-[rgb(var(--background-card))] border border-[rgb(var(--border))] rounded-lg p-0.5">
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  period === value
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-[rgb(var(--foreground-muted))] hover:text-[rgb(var(--foreground))]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════════ OVERVIEW TAB ════════════════ */}
        {dashTab === 'overview' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-3">
              <StatsCard
                label="Est. Credits"
                value={`${credPrefix}${summary.totalCredits.toFixed(2)}`}
                sub={summary.hasEstimates ? '⚡ estimated' : '⚡ actual'}
                color="amber"
              />
              <StatsCard
                label="Requests"
                value={summary.totalRequests.toLocaleString()}
                sub="LLM API calls"
                color="cyan"
              />
              <StatsCard
                label="Sessions"
                value={summary.totalSessions}
                sub="conversations"
                color="emerald"
              />
              <StatsCard
                label="Turns"
                value={summary.totalTurns}
                sub="user prompts"
              />
              <StatsCard
                label="Top Model"
                value={shortModel(summary.topModel)}
                sub={`avg ${credPrefix}${summary.avgCreditPerTurn.toFixed(2)} cr/turn`}
                color="purple"
              />
            </div>

            {/* Chart + workspace breakdown side by side */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3">
                <UsageChart data={chartPoints} />
              </div>
              <div className="col-span-2">
                <WorkspaceBreakdown wsStats={wsStats} modelStats={modelStats} />
              </div>
            </div>

            {/* Daily breakdown table */}
            <DailyBreakdown stats={dailyStats} onExport={handleExportDaily} />

            {/* Insight bar — only shown when there's data */}
            {promptRecs.length > 0 && (() => {
              const top10Cost  = promptRecs.slice(0, 10).reduce((s, r) => s + r.creditCost, 0);
              const totalCost  = promptRecs.reduce((s, r) => s + r.creditCost, 0);
              const topPct     = totalCost > 0 ? Math.round(top10Cost / totalCost * 100) : 0;
              return topPct > 0 ? (
                <div className="flex items-start gap-2 px-4 py-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-xs text-[rgb(var(--foreground-muted))] leading-relaxed">
                  <span className="text-cyan-400 shrink-0">💡</span>
                  <span>
                    Your <strong className="text-[rgb(var(--foreground))]">10 most expensive prompts</strong> account for{' '}
                    <strong className="text-amber-400">{topPct}%</strong> of total estimated credits this period.
                    Visit the <button className="text-cyan-400 hover:underline" onClick={() => setDashTab('prompts')}>Prompt Tracker</button> to inspect them.
                  </span>
                </div>
              ) : null;
            })()}
          </>
        )}

        {/* ════════════════ PROMPT TRACKER TAB ════════════════ */}
        {dashTab === 'prompts' && (
          <PromptTracker records={promptRecs} onExport={handleExportPrompts} />
        )}

      </div>
    </div>
  );
}
