<div align="center">

# 🗂️ Kiro History

**Browse your Kiro conversations in a beautiful web UI — supports both Kiro CLI and Kiro IDE.**

[![npm version](https://img.shields.io/npm/v/kiro-history.svg?style=flat-square&color=cyan)](https://www.npmjs.com/package/kiro-history)
[![npm downloads](https://img.shields.io/npm/dm/kiro-history.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/kiro-history)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```bash
npx kiro-history
```

</div>

<!--
📸 Add a screenshot or GIF here to showcase the UI, e.g.:
<div align="center">
  <img src="assets/screenshot.png" alt="Kiro History UI" width="900" />
</div>
-->

## ✨ Features

- 🔍 **Search** — Find conversations instantly across all your history, with highlighted matches and auto-scroll within the selected session
- 📝 **Markdown Support** — Rendered markdown with syntax-highlighted code blocks and tables
- 💰 **Credit Cost & Model** — Per-turn credit cost and model name displayed on each assistant response, with a session-level summary bar
- 🔧 **Tool Details** — Collapsible tool usage information for each assistant response
- 🔄 **Live Updates** — Automatically refreshes when new conversations are added, including sessions in brand-new IDE workspaces opened after the server started
- 🚀 **Resume Sessions** — Copy a ready-to-run `kiro-cli chat --resume-id` command for any CLI conversation
- 🔀 **Source Switching** — Segmented toggle to flip between CLI and IDE conversations
- 🖥️ **Fullscreen & Collapsible Sidebar** — Focus on a single conversation or reclaim screen space
- 🎨 **Clean UI** — Modern, responsive interface with a dark theme

## 🚀 Quick Start

```bash
# Run directly with npx (no install needed)
npx kiro-history
```

That's it! The tool will auto-detect your Kiro data and open a browser window.

## 📦 Installation

```bash
# Install globally for repeated use
npm install -g kiro-history

# Then run anytime
kiro-history
```

## 🎯 Usage

### Basic Usage

```bash
# Auto-detect and open browser
kiro-history

# Use a specific port
kiro-history -p 3000

# Don't open browser automatically
kiro-history --no-open
```

### Source Selection

```bash
# Explicitly use Kiro IDE conversations
kiro-history --source ide

# Explicitly use Kiro CLI conversations
kiro-history --source cli

# Auto-detect (default - prefers CLI if both exist)
kiro-history --source auto
```

### Custom Paths

```bash
# Use a custom database path (CLI mode)
kiro-history ~/path/to/data.sqlite3

# Use a custom sessions directory (IDE mode)
kiro-history --source ide ~/path/to/kiro.kiroagent
```

## 📋 Options

| Option | Description | Default |
|--------|-------------|---------|
| `path` | Custom path to database file (CLI) or sessions directory (IDE) | Auto-detected |
| `-s, --source <type>` | Source type: `cli`, `ide`, or `auto` | `auto` |
| `-p, --port <number>` | Port to run the server on | Random available port |
| `--no-open` | Don't open browser automatically | Opens browser |
| `-V, --version` | Show version number | - |
| `-h, --help` | Show help | - |

## 🔧 How It Works

**Kiro CLI** saves conversations to a local SQLite database (and newer flat-file sessions). **Kiro IDE** stores them as JSON files — both the original pre-v1.0 format and the current v1.0 JSONL format. This tool reads from all sources and displays your chat history in a clean, browsable format.

### Default Paths

**macOS:**
- CLI: `~/Library/Application Support/kiro-cli/data.sqlite3`
- IDE: `~/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent`

**Linux:**
- CLI: `~/.local/share/kiro-cli/data.sqlite3`
- IDE: `~/.config/Kiro/User/globalStorage/kiro.kiroagent`

**Windows:**
- CLI: `%USERPROFILE%\.local\share\kiro-cli\data.sqlite3`
- IDE: `%APPDATA%\Kiro\User\globalStorage\kiro.kiroagent`

### Source Detection

When using `--source auto` (the default):
1. Checks for both CLI and IDE data sources
2. If both exist, defaults to **CLI**
3. If only one exists, uses that source
4. Shows a switch button in the UI when both sources are available

## 💰 Credit Estimation (IDE sessions)

Kiro IDE does **not** write credit data into local session files — the `promptTurnSummaries` field inside every `usage_summary` JSONL payload is always an empty array `[]`. When you view IDE sessions, kiro-history **estimates** the credit cost from the visible message content and flags every estimated figure with a `~` prefix and an `(est.)` badge in the UI.

> **CLI sessions** always show real credit data (read from `metering_usage` in the session JSON). No estimation is applied.

### Formula

```
estimated_credits = round(visible_tokens × context_multiplier / 1000 × rate, 2)

where:
  visible_tokens    = visible_chars / 4
  visible_chars     = user_prompt.length + assistant_response.length + tool_args_json.length
  context_multiplier = 2.5
  rate              = credits per 1 K tokens (model-dependent, see table below)
```

#### Why the 2.5× multiplier?

The session file only contains the messages you can see. Every real LLM request also includes content that never appears in the file:

- System prompt and agent instructions
- Tool definitions (all available tools are sent on every request)
- Steering / memory files included in context
- Prior conversation turns (context window accumulation)

Visible content typically represents only **30–40 %** of the tokens actually sent to the model. The `2.5×` multiplier compensates for this gap. It is a conservative midpoint — heavy tool-use sessions may still be underestimated.

### Model rates

| Model family | Credits / 1 K tokens | vs Auto |
|---|---|---|
| **Auto** (Kiro default) | 0.15 | 1.0× baseline |
| **Claude Sonnet 4.x** | 0.195 | 1.3× — confirmed in [Kiro pricing docs](https://kiro.dev/blog/new-pricing-plans-and-auto/) |
| **Claude Opus 4.x** | 0.60 | 4.0× — confirmed in Kiro pricing docs |
| **Claude Haiku 3.x** | 0.045 | ~0.3× — estimated |

### Calibration source

Rates are calibrated against [community usage benchmarks (Oct 2025)](https://note.com/ai_tech_notes/n/n88fe8fde9d13):

| Task | Auto | Sonnet 4 | Opus 4 |
|---|---|---|---|
| Refactor 200-line React component + add TypeScript types | ~0.8 cr | ~1.1 cr | ~3.2 cr |

The Sonnet 4 (1.3×) and Opus (4.0×) multipliers are independently confirmed by the official Kiro documentation.

### Accuracy

**Expected accuracy: ±40–70 %**

| Error source | Typical impact |
|---|---|
| Prompt caching (Kiro caches aggressively) | ±30–50 % |
| Auto mode sub-model selection per request | ±20–30 % |
| Context window accumulation across long sessions | ±10–30 % |
| Character → token approximation (4 chars/token) | ±10–15 % |

The estimates are useful as **order-of-magnitude indicators** — they tell you which sessions and prompts are expensive relative to each other. Do not use them for billing or budgeting decisions; check your actual credit balance in the Kiro IDE or subscription dashboard.

### Example calculation

A turn where the user sends a 500-character prompt and the assistant responds with 2 000 characters, using 3 tool calls totalling 800 characters of JSON args:

```
visible_chars  = 500 + 2 000 + 800 = 3 300
visible_tokens = 3 300 / 4         = 825
total_tokens   = 825 × 2.5         = 2 062.5
credits (Auto) = 2 062.5 / 1000 × 0.15 = 0.31  → displayed as ~0.31 (est.)
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [Ajaykumar Prathap](https://github.com/pajaydev)

## 🔗 Links

- [GitHub Repository](https://github.com/pajaydev/kiro-history)
- [npm Package](https://www.npmjs.com/package/kiro-history)
- [Report Issues](https://github.com/pajaydev/kiro-history/issues)
