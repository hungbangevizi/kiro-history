import type { ParsedConversation } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export type Period = 'today' | '7d' | '30d' | 'month';

/** One data point for the bar chart (one day). */
export interface ChartPoint {
  date: string;     // YYYY-MM-DD
  label: string;    // display label, may be '' for dense ranges
  credits: number;
  requests: number;
  sessions: number;
  turns: number;
  isToday: boolean;
}

/** Richer per-day aggregate shown in the Daily Breakdown table. */
export interface DayStat {
  date: string;
  label: string;
  sessions: number;
  turns: number;
  requests: number;
  creditCost: number;
  isEstimated: boolean;
  workspaces: string[];
  topModel: string;
}

/** One row in the Prompt Tracker table (one user↔assistant exchange). */
export interface PromptRecord {
  sessionId: string;
  workspace: string;
  date: string;
  promptPreview: string; // first 120 chars, whitespace collapsed
  model: string;
  creditCost: number;
  isEstimated: boolean;
  requestCount: number;
  toolCount: number;
}

/** Summary numbers for the top stat cards. */
export interface SummaryStats {
  totalCredits: number;
  totalRequests: number;
  totalSessions: number;
  totalTurns: number;
  hasEstimates: boolean;
  topModel: string;
  avgCreditPerTurn: number;
  maxCreditPerTurn: number;
}

export interface WorkspaceStat {
  name: string;
  credits: number;
  sessions: number;
  pct: number; // 0–100 relative to the top workspace
}

export interface ModelStat {
  model: string;
  turns: number;
  pct: number;
}

// ── Date helpers ───────────────────────────────────────────────────────

export function toDateString(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Extract the last path segment, e.g. "kiro-history" from a full path. */
export function workspaceName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}

export function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = startOfDay(new Date(now));
  if (period === 'today') return { from, to };
  if (period === '7d')    { from.setDate(from.getDate() - 6); return { from, to }; }
  if (period === '30d')   { from.setDate(from.getDate() - 29); return { from, to }; }
  // month
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
}

/** Bar chart label — keeps 30-day view readable by showing only ~6 ticks. */
function labelFor(dateStr: string, period: Period, idx: number, total: number): string {
  const today = toDateString(new Date());
  if (dateStr === today) return period === 'today' ? '' : 'Today';
  if (period === 'today') return '';

  if (period === '7d') {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  }

  // 30d / month — only keep ~6 evenly-spaced labels
  const step = Math.max(1, Math.ceil(total / 6));
  if (idx % step !== 0 && idx !== total - 1) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Human-readable date, e.g. "Today", "Yesterday", "Oct 23". */
export function friendlyDate(dateStr: string): string {
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86_400_000));
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Core aggregation ───────────────────────────────────────────────────

export function filterByPeriod(
  conversations: ParsedConversation[],
  period: Period,
): ParsedConversation[] {
  const { from, to } = getPeriodRange(period);
  return conversations.filter(c => {
    if (!c.updatedAt) return false;
    const d = new Date(c.updatedAt);
    return d >= from && d <= to;
  });
}

/** Produces the array of day buckets consumed by UsageChart. */
export function buildChartPoints(
  conversations: ParsedConversation[],
  period: Period,
): ChartPoint[] {
  const { from } = getPeriodRange(period);
  const today = toDateString(new Date());

  // Build the full date spine
  const dates: string[] = [];
  const cursor = startOfDay(new Date(from));
  const end    = startOfDay(new Date());
  end.setDate(end.getDate() + 1);
  while (cursor < end) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const map = new Map<string, { credits: number; requests: number; sessions: number; turns: number }>();
  dates.forEach(d => map.set(d, { credits: 0, requests: 0, sessions: 0, turns: 0 }));

  for (const conv of conversations) {
    if (!conv.updatedAt) continue;
    const key = toDateString(new Date(conv.updatedAt));
    const e = map.get(key);
    if (!e) continue;
    e.sessions++;
    for (const msg of conv.messages) {
      if (msg.role === 'user') e.turns++;
      if (msg.role === 'assistant' && msg.turnMetadata) {
        e.requests += msg.turnMetadata.requestCount;
        e.credits   = Math.round((e.credits + msg.turnMetadata.creditCost) * 100) / 100;
      }
    }
  }

  return dates.map((date, i) => ({
    date,
    label: labelFor(date, period, i, dates.length),
    isToday: date === today,
    ...map.get(date)!,
  }));
}

export function buildSummaryStats(conversations: ParsedConversation[]): SummaryStats {
  let totalCredits = 0;
  let totalRequests = 0;
  let totalTurns = 0;
  let hasEstimates = false;
  let maxCredit = 0;
  let turnCount = 0;
  const modelCounts: Record<string, number> = {};

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role === 'user') totalTurns++;
      if (msg.role === 'assistant' && msg.turnMetadata) {
        const m = msg.turnMetadata;
        totalCredits  += m.creditCost;
        totalRequests += m.requestCount;
        if (m.isEstimated) hasEstimates = true;
        if (m.creditCost > maxCredit) maxCredit = m.creditCost;
        turnCount++;
        if (m.model && m.model !== 'unknown') {
          modelCounts[m.model] = (modelCounts[m.model] || 0) + 1;
        }
      }
    }
  }

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

  return {
    totalCredits:    Math.round(totalCredits * 100) / 100,
    totalRequests,
    totalSessions:   conversations.length,
    totalTurns,
    hasEstimates,
    topModel,
    avgCreditPerTurn: turnCount > 0 ? Math.round(totalCredits / turnCount * 100) / 100 : 0,
    maxCreditPerTurn: Math.round(maxCredit * 100) / 100,
  };
}

export function buildDailyStats(
  conversations: ParsedConversation[],
  period: Period,
): DayStat[] {
  const { from, to } = getPeriodRange(period);

  // Group conversations by date
  const byDate = new Map<string, ParsedConversation[]>();
  for (const conv of conversations) {
    if (!conv.updatedAt) continue;
    const d = new Date(conv.updatedAt);
    if (d < from || d > to) continue;
    const key = toDateString(d);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(conv);
  }

  const points = buildChartPoints(conversations, period);

  return points
    .filter(p => p.date <= toDateString(new Date()))
    .reverse() // newest first
    .map(p => {
      const convs = byDate.get(p.date) ?? [];
      const wsSet = new Set<string>();
      const modelCounts: Record<string, number> = {};
      let isEstimated = false;

      for (const conv of convs) {
        if (conv.directoryPath) wsSet.add(workspaceName(conv.directoryPath));
        for (const msg of conv.messages) {
          if (msg.role === 'assistant' && msg.turnMetadata) {
            if (msg.turnMetadata.isEstimated) isEstimated = true;
            const m = msg.turnMetadata.model;
            if (m && m !== 'unknown') modelCounts[m] = (modelCounts[m] || 0) + 1;
          }
        }
      }

      const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

      return {
        date: p.date,
        label: p.label || friendlyDate(p.date),
        sessions:   p.sessions,
        turns:      p.turns,
        requests:   p.requests,
        creditCost: p.credits,
        isEstimated,
        workspaces: Array.from(wsSet),
        topModel,
      };
    });
}

export function buildPromptRecords(conversations: ParsedConversation[]): PromptRecord[] {
  const records: PromptRecord[] = [];

  for (const conv of conversations) {
    const ws   = workspaceName(conv.directoryPath || '');
    const date = conv.updatedAt ? toDateString(new Date(conv.updatedAt)) : '';
    const msgs = conv.messages;

    for (let i = 0; i < msgs.length; i++) {
      const msg  = msgs[i];
      const next = msgs[i + 1];
      if (msg.role !== 'user' || !next || next.role !== 'assistant') continue;

      records.push({
        sessionId:     conv.conversationId,
        workspace:     ws,
        date,
        promptPreview: msg.content.trim().replace(/\s+/g, ' ').slice(0, 120),
        model:         next.turnMetadata?.model     ?? 'unknown',
        creditCost:    next.turnMetadata?.creditCost ?? 0,
        isEstimated:   next.turnMetadata?.isEstimated ?? false,
        requestCount:  next.turnMetadata?.requestCount ?? 0,
        toolCount:     next.toolUses?.length ?? 0,
      });
    }
  }

  // Default sort: most expensive first
  return records.sort((a, b) => b.creditCost - a.creditCost);
}

export function buildWorkspaceStats(conversations: ParsedConversation[]): WorkspaceStat[] {
  const map = new Map<string, { credits: number; sessions: number }>();

  for (const conv of conversations) {
    const name = workspaceName(conv.directoryPath || 'unknown');
    const e = map.get(name) ?? { credits: 0, sessions: 0 };
    e.sessions++;
    for (const msg of conv.messages) {
      if (msg.role === 'assistant' && msg.turnMetadata) {
        e.credits = Math.round((e.credits + msg.turnMetadata.creditCost) * 100) / 100;
      }
    }
    map.set(name, e);
  }

  const arr = Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v, pct: 0 }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 8);

  const maxCredits = arr[0]?.credits || 1;
  return arr.map(s => ({ ...s, pct: Math.round(s.credits / maxCredits * 100) }));
}

export function buildModelStats(conversations: ParsedConversation[]): ModelStat[] {
  const map = new Map<string, number>();
  let total = 0;

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role === 'assistant' && msg.turnMetadata?.model) {
        const m = msg.turnMetadata.model;
        if (m === 'unknown') continue;
        map.set(m, (map.get(m) || 0) + 1);
        total++;
      }
    }
  }

  return Array.from(map.entries())
    .map(([model, turns]) => ({ model, turns, pct: total > 0 ? Math.round(turns / total * 100) : 0 }))
    .sort((a, b) => b.turns - a.turns);
}
