import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ParsedConversation, ConversationMessage, ToolUse, TurnMetadata } from './types.js';

// ── session.json schema ─────────────────────────────────────────────

interface IdeV1SessionMeta {
  id: string;
  title?: string;
  agentMode?: string;
  workspacePaths?: string[];
  rootPaths?: string[];
  createdAt: string;
  lastModifiedAt: string;
  modelId?: string;
  status?: string;
  description?: string;
}

// ── messages.jsonl payload types ────────────────────────────────────

interface JsonlEntry {
  id: string;
  timestamp: string;
  payload: JsonlPayload;
}

type JsonlPayload =
  | { type: 'user'; content: string }
  | { type: 'assistant'; content: string; executionId?: string }
  | { type: 'tool_call'; toolCallId: string; toolName: string; args: Record<string, unknown>; status?: string }
  | { type: 'tool_result'; toolCallId: string; content?: string; success?: boolean }
  | { type: 'turn_start'; executionId?: string }
  | { type: 'turn_end'; stopReason?: string; executionId?: string }
  | { type: string; [key: string]: unknown }; // catch-all for types we don't parse

// ── Reader interface ────────────────────────────────────────────────

export interface IdeV1Reader {
  getConversations(): ParsedConversation[];
  /**
   * Re-resolve the set of workspace-hash directories under the base path.
   * Lets the reader pick up IDE workspaces created after startup without a
   * restart. No-op when the reader was created without a base path (i.e. with
   * an explicit, fixed directory list).
   */
  refresh(): void;
  close(): void;
}

// ── Path resolution ─────────────────────────────────────────────────

/**
 * Returns the base path for new-format IDE sessions: ~/.kiro/sessions/
 * The actual workspace-hash directories are children of this path.
 */
export function resolveIdeV1BasePath(): string {
  return join(homedir(), '.kiro', 'sessions');
}

/**
 * Scans ~/.kiro/sessions/ and returns workspace-hash directory paths,
 * excluding the `cli` directory (that's for CLI V2 sessions).
 */
export function resolveIdeV1WorkspaceDirs(basePath?: string): string[] {
  const sessionsDir = basePath || resolveIdeV1BasePath();
  if (!existsSync(sessionsDir)) return [];

  const dirs: string[] = [];
  try {
    for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      // Skip `cli` — that's the CLI V2 reader's domain
      if (entry.name === 'cli') continue;
      dirs.push(join(sessionsDir, entry.name));
    }
  } catch {
    // sessionsDir might not be readable
  }
  return dirs;
}

// ── Credit-cost estimation ──────────────────────────────────────────
//
// Kiro IDE writes `promptTurnSummaries: []` (always empty), so actual credit
// data is never stored locally.  We estimate from visible message content.
//
// Calibration source (community usage reports, Oct 2025):
//   200-line React refactor:  Auto ≈ 0.8 cr  |  Sonnet 4 ≈ 1.1 cr  |  Opus ≈ 3.2 cr
//   Kiro docs confirm:  Sonnet 4 = 1.3× Auto;  Opus ≈ 4× Auto.
//
// We only see a fraction of the real context window (system prompt, tool
// definitions, steering files, memory, prior turns are hidden).  The
// HIDDEN_CONTEXT_MULTIPLIER compensates for that.
//
// Expected accuracy: ±40–70 %.  All estimated values are flagged with
// isEstimated=true so the UI can show them with a "~" prefix.

const CHARS_PER_TOKEN = 4;           // industry-standard approximation
const HIDDEN_CONTEXT_MULTIPLIER = 2.5; // visible ≈ 30–40 % of actual context

/** Credits per 1 K tokens, keyed by model family. */
const CREDITS_PER_1K_TOKENS: Record<string, number> = {
  auto:   0.15,   // Kiro Auto baseline
  sonnet: 0.195,  // 1.3× Auto  (Kiro docs)
  haiku:  0.045,  // ~0.3× Auto (estimated)
  opus:   0.60,   // 4.0× Auto  (Kiro docs)
};

function getCreditsPerKTokens(modelId?: string): number {
  if (!modelId || modelId === 'unknown') return CREDITS_PER_1K_TOKENS.auto;
  const m = modelId.toLowerCase();
  if (m.includes('opus'))   return CREDITS_PER_1K_TOKENS.opus;
  if (m.includes('haiku'))  return CREDITS_PER_1K_TOKENS.haiku;
  if (m.includes('sonnet')) return CREDITS_PER_1K_TOKENS.sonnet;
  return CREDITS_PER_1K_TOKENS.auto;
}

function estimateTurnCreditCost(visibleChars: number, modelId?: string): number {
  const visibleTokens = visibleChars / CHARS_PER_TOKEN;
  const totalTokens   = visibleTokens * HIDDEN_CONTEXT_MULTIPLIER;
  const rate          = getCreditsPerKTokens(modelId);
  // Round to 2 dp to avoid implying false precision.
  return Math.round((totalTokens / 1000) * rate * 100) / 100;
}

// ── JSONL parser ────────────────────────────────────────────────────

function parseIdeV1Messages(jsonlPath: string, modelId?: string): ConversationMessage[] {
  let lines: string[];
  try {
    lines = readFileSync(jsonlPath, 'utf-8').split('\n').filter(l => l.trim());
  } catch {
    return [];
  }

  const messages: ConversationMessage[] = [];
  // Accumulate tool calls per turn so we can attach them to the assistant message
  let pendingToolUses: ToolUse[] = [];
  let pendingAssistantContent = '';
  let pendingTurnMetadata: TurnMetadata | undefined;
  let inTurn = false;

  for (const line of lines) {
    let entry: JsonlEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const payload = entry.payload;
    if (!payload || !payload.type) continue;

    switch (payload.type) {
      case 'user': {
        // Flush any pending assistant content from previous turn
        flushAssistant();
        const content = (payload as { type: 'user'; content: string }).content;
        if (content) {
          messages.push({ role: 'user', content });
        }
        break;
      }

      case 'turn_start': {
        inTurn = true;
        pendingToolUses = [];
        pendingAssistantContent = '';
        pendingTurnMetadata = undefined;
        break;
      }

      case 'assistant': {
        const content = (payload as { type: 'assistant'; content: string }).content;
        // Skip streaming placeholders ('...')
        if (content && content !== '...') {
          pendingAssistantContent = content;
        }
        break;
      }

      case 'tool_call': {
        const p = payload as { type: 'tool_call'; toolCallId: string; toolName: string; args: Record<string, unknown> };
        pendingToolUses.push({
          id: p.toolCallId || '',
          name: p.toolName || '',
          args: p.args || {},
        });
        break;
      }

      case 'usage_summary': {
        const p = payload as {
          type: 'usage_summary';
          promptTurnSummaries?: { usage?: number; unit?: string }[];
          requestIds?: string[];
        };
        const summaries = p.promptTurnSummaries;
        const hasRealData = Array.isArray(summaries) && summaries.length > 0;
        const requestCount = Array.isArray(p.requestIds) ? p.requestIds.length : 0;

        let creditCost: number;
        let isEstimated: boolean;

        if (hasRealData) {
          // Real data available — use it directly.
          creditCost  = summaries!.reduce((sum, s) => sum + (s.usage || 0), 0);
          isEstimated = false;
        } else {
          // promptTurnSummaries is always empty in Kiro IDE v1.
          // Estimate from the visible content of this turn.
          // At this point in the JSONL stream usage_summary fires BEFORE
          // turn_end, so pendingAssistantContent / pendingToolUses still hold
          // the current turn's data.
          let visibleChars = pendingAssistantContent.length;

          // Tool-use argument JSON also consumes tokens.
          for (const tu of pendingToolUses) {
            visibleChars += JSON.stringify(tu.args).length;
          }

          // The user prompt was already pushed to messages[] by the 'user' case.
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          if (lastUserMsg) visibleChars += lastUserMsg.content.length;

          creditCost  = estimateTurnCreditCost(visibleChars, modelId);
          isEstimated = true;
        }

        pendingTurnMetadata = {
          creditCost,
          model: modelId || 'unknown',
          requestCount,
          isEstimated,
        };
        break;
      }

      case 'turn_end': {
        flushAssistant();
        inTurn = false;
        break;
      }

      // All other payload types (session_metadata, steering_inclusion, etc.) are skipped
    }
  }

  // Flush any remaining assistant content (session might not have a final turn_end)
  flushAssistant();

  return messages;

  function flushAssistant(): void {
    if (pendingAssistantContent || pendingToolUses.length > 0) {
      const msg: ConversationMessage = {
        role: 'assistant',
        content: pendingAssistantContent,
        ...(pendingToolUses.length > 0 ? { toolUses: [...pendingToolUses] } : {}),
      };
      if (pendingTurnMetadata) {
        msg.turnMetadata = pendingTurnMetadata;
      }
      messages.push(msg);
      pendingAssistantContent = '';
      pendingToolUses = [];
      pendingTurnMetadata = undefined;
    }
  }
}

// ── Reader factory ──────────────────────────────────────────────────

/**
 * Creates a reader for new-format IDE sessions.
 *
 * @param workspaceDirs Initial list of `<workspace-hash>` directories to read.
 * @param basePath Optional `~/.kiro/sessions/` base path. When provided,
 *   `refresh()` re-scans it so workspace directories created after startup are
 *   picked up without a restart. When omitted, `refresh()` is a no-op and the
 *   reader operates on the fixed `workspaceDirs` list it was given.
 */
export function createIdeV1Reader(workspaceDirs: string[], basePath?: string): IdeV1Reader {
  // Mutable so refresh() can replace it with a freshly-scanned list.
  let currentWorkspaceDirs = workspaceDirs;

  function refresh(): void {
    if (!basePath) return; // fixed-list mode: nothing to re-resolve
    currentWorkspaceDirs = resolveIdeV1WorkspaceDirs(basePath);
  }

  return {
    getConversations(): ParsedConversation[] {
      // Re-resolve first so newly-created workspace dirs are included.
      refresh();

      const conversations: ParsedConversation[] = [];

      for (const wsDir of currentWorkspaceDirs) {
        if (!existsSync(wsDir)) continue;

        let sessionDirs: string[];
        try {
          sessionDirs = readdirSync(wsDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name);
        } catch {
          continue;
        }

        for (const sessionId of sessionDirs) {
          const sessionDir = join(wsDir, sessionId);
          const metaPath = join(sessionDir, 'session.json');
          const jsonlPath = join(sessionDir, 'messages.jsonl');

          if (!existsSync(metaPath) || !existsSync(jsonlPath)) continue;

          let meta: IdeV1SessionMeta;
          try {
            meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          } catch {
            continue;
          }

          const messages = parseIdeV1Messages(jsonlPath, meta.modelId);
          if (messages.length === 0) continue;

          const updatedAt = meta.lastModifiedAt
            ? new Date(meta.lastModifiedAt).getTime()
            : meta.createdAt
              ? new Date(meta.createdAt).getTime()
              : undefined;

          // Use workspacePaths[0] as directoryPath, fall back to rootPaths[0]
          const dirPath = meta.workspacePaths?.[0]
            || meta.rootPaths?.[0]
            || wsDir;

          conversations.push({
            directoryPath: dirPath,
            conversationId: meta.id || sessionId,
            messages,
            updatedAt,
          });
        }
      }

      // Sort by recency
      conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return conversations;
    },

    refresh,

    close(): void {
      // No resources to clean up
    },
  };
}
