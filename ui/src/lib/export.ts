import * as XLSX from 'xlsx';
import type { ParsedConversation } from '../types';

/** Returns just the last path segment, e.g. "kiro-history" from a full path. */
function workspaceName(fullPath: string): string {
  return fullPath.split(/[/\\]/).filter(Boolean).pop() ?? fullPath;
}

function formatDate(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}

/**
 * Builds a .xlsx workbook from the given conversations and triggers a
 * browser download.
 *
 * @param conversations  The list to export (pass filteredConversations so the
 *                       export respects whatever search is active in the UI).
 * @param source         'cli' | 'ide' — used only for the filename.
 */
export function exportConversationsToExcel(
  conversations: ParsedConversation[],
  source: string
): void {
  const rows = conversations.map((conv, i) => {
    const userMsgs   = conv.messages.filter(m => m.role === 'user').length;
    const asstMsgs   = conv.messages.filter(m => m.role === 'assistant').length;

    const totalCredits = conv.messages.reduce(
      (sum, m) => sum + (m.turnMetadata?.creditCost ?? 0), 0
    );
    const totalRequests = conv.messages.reduce(
      (sum, m) => sum + (m.turnMetadata?.requestCount ?? 0), 0
    );
    const models = [
      ...new Set(
        conv.messages
          .map(m => m.turnMetadata?.model)
          .filter((m): m is string => !!m && m !== 'unknown')
      ),
    ].join(', ');

    return {
      '#':                   i + 1,
      'Workspace':           workspaceName(conv.directoryPath),
      'Full Path':           conv.directoryPath,
      'Session ID':          conv.conversationId,
      'Last Active':         formatDate(conv.updatedAt),
      'Turns':               userMsgs,
      'Messages':            conv.messages.length,
      'User Messages':       userMsgs,
      'Assistant Messages':  asstMsgs,
      'Total Credits':       totalCredits > 0 ? parseFloat(totalCredits.toFixed(4)) : '',
      'Total Requests':      totalRequests > 0 ? totalRequests : '',
      'Model':               models,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths (characters)
  ws['!cols'] = [
    { wch: 4  },  // #
    { wch: 25 },  // Workspace
    { wch: 50 },  // Full Path
    { wch: 38 },  // Session ID
    { wch: 22 },  // Last Active
    { wch: 7  },  // Turns
    { wch: 10 },  // Messages
    { wch: 14 },  // User Messages
    { wch: 20 },  // Assistant Messages
    { wch: 14 },  // Total Credits
    { wch: 15 },  // Total Requests
    { wch: 28 },  // Model
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conversations');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `kiro-history-${source}-${date}.xlsx`);
}

import type { DayStat, PromptRecord } from './stats';

/**
 * Exports the daily breakdown table to Excel.
 * One row per day, ordered newest-first (matching what the UI shows).
 */
export function exportDailyReport(stats: DayStat[], period: string): void {
  const rows = stats.map((s, i) => ({
    '#':             i + 1,
    'Date':          s.label,
    'Sessions':      s.sessions,
    'Turns':         s.turns,
    'Requests':      s.requests,
    'Est. Credits':  s.creditCost > 0 ? parseFloat(s.creditCost.toFixed(4)) : '',
    'Credit Type':   s.isEstimated ? 'Estimated' : 'Actual',
    'Top Model':     s.topModel,
    'Workspaces':    s.workspaces.join(', '),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 4  },
    { wch: 15 },
    { wch: 10 },
    { wch: 8  },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 25 },
    { wch: 50 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Usage');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `kiro-usage-daily-${period}-${date}.xlsx`);
}

/**
 * Exports the Prompt Tracker list to Excel.
 * Exports whatever filtered/sorted set the user is currently viewing.
 */
export function exportPromptReport(records: PromptRecord[]): void {
  const rows = records.map((r, i) => ({
    '#':             i + 1,
    'Date':          r.date,
    'Workspace':     r.workspace,
    'Prompt':        r.promptPreview,
    'Model':         r.model,
    'Est. Credits':  r.creditCost > 0 ? parseFloat(r.creditCost.toFixed(4)) : '',
    'Credit Type':   r.isEstimated ? 'Estimated' : 'Actual',
    'Requests':      r.requestCount,
    'Tool Calls':    r.toolCount,
    'Session ID':    r.sessionId,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 4  },
    { wch: 12 },
    { wch: 25 },
    { wch: 80 },
    { wch: 22 },
    { wch: 13 },
    { wch: 12 },
    { wch: 10 },
    { wch: 11 },
    { wch: 38 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prompt Tracker');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `kiro-prompt-report-${date}.xlsx`);
}
