# thingsctl

A full-featured command-line interface for [Things 3](https://culturedcode.com/things/) on macOS. Designed for both human use and AI agent integration.

## Installation

### Prerequisites

- macOS with Things 3 installed
- Node.js 18+

### Install from source

```bash
git clone https://github.com/kaufmanhenry/thingsctl.git
cd thingsctl
npm install
npm link
```

This installs `thingsctl` globally on your system.

## Quick Start

```bash
# See today's tasks
thingsctl today

# Add a task to today
thingsctl add "Call dentist" --when today

# Complete a task
thingsctl complete 17jJ

# Get help
thingsctl --help
thingsctl add --help
```

## Commands Reference

### Viewing Tasks

```bash
# Today's tasks
thingsctl today
thingsctl today --verbose    # Show area/project context
thingsctl today --json       # JSON output for scripting

# Other lists
thingsctl inbox
thingsctl anytime
thingsctl someday
thingsctl upcoming           # Scheduled for future dates
thingsctl due                # Tasks with deadlines
thingsctl repeating          # Recurring tasks
thingsctl logbook            # Recently completed
thingsctl logbook --limit 50 # More completed tasks
```

### Projects & Organization

```bash
# List all projects with task counts
thingsctl projects

# Show tasks in a specific project
thingsctl project "Wedding Planning"
thingsctl project Wedding          # Partial match works

# List areas with task/project counts
thingsctl areas

# List all tags with usage counts
thingsctl tags
```

### Search & Details

```bash
# Full-text search across titles and notes
thingsctl search "birthday"
thingsctl search groceries --verbose

# Show detailed task info (partial UUID works)
thingsctl show 17jJ
thingsctl show 17jJuooocGSZxKNv3JuxRx --json
```

### Statistics

```bash
thingsctl stats
```

Output:
```
Things 3 Statistics

Today:          5
Inbox:          0
Anytime:        10
Someday:        53
Upcoming:       13

Total Open:     132
Completed Today: 14
Projects:       18
```

### Adding Tasks

```bash
# Basic
thingsctl add "Buy milk"

# With scheduling
thingsctl add "Call mom" --when today
thingsctl add "Review proposal" --when tomorrow
thingsctl add "Someday project" --when someday
thingsctl add "Next week task" --when "next week"
thingsctl add "Specific date" --when 2024-03-15

# With deadline
thingsctl add "Tax filing" --deadline 2024-04-15

# With tags (must exist in Things)
thingsctl add "Weekly review" --tags "Review,Deep"

# Into a project (partial name match)
thingsctl add "Fix login bug" --project "Website"
thingsctl add "Review docs" --project Costudy

# Into an area (partial name match)
thingsctl add "Pay rent" --area Finance

# With notes
thingsctl add "Research topic" --notes "Check the PDF in Downloads"

# Into a heading within a project
thingsctl add "Final test" --project "Launch" --heading "QA Tasks"

# Combined
thingsctl add "Critical fix" --when today --deadline 2024-03-10 --tags Urgent --project "App"
```

### Completing Tasks

```bash
# Use partial UUID from any list command
thingsctl complete 17jJ
thingsctl complete ANsB
```

### Moving Tasks

```bash
# Move to lists
thingsctl move 17jJ --to today
thingsctl move 17jJ --to anytime
thingsctl move 17jJ --to someday

# Schedule for specific date
thingsctl move 17jJ --to 2024-03-20
thingsctl move 17jJ --to "next week"
thingsctl move 17jJ --to tomorrow
```

### Managing Tags

```bash
# Add tags (tag must exist in Things)
thingsctl tag 17jJ --add Important
thingsctl tag 17jJ --add "Deep Work"
```

### JSON Output

All commands support `--json` for scripting:

```bash
# Pipe to jq
thingsctl today --json | jq '.[].title'
thingsctl stats --json | jq '.today'

# Count today's tasks
thingsctl today --json | jq length

# Extract task IDs
thingsctl search "meeting" --json | jq -r '.[].uuid'
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--verbose`, `-v` | Show more details (area/project context) |
| `--help`, `-h` | Show help (global or command-specific) |
| `--version`, `-V` | Show version |

## AI Agent Integration

thingsctl is designed to work seamlessly with AI assistants and agents (Claude, GPT, etc.). The `--json` flag on all commands provides structured output that's easy for agents to parse and act on.

### Why thingsctl for agents?

- **Structured output**: `--json` returns clean, parseable data
- **Full CRUD**: Read tasks, add new ones, complete them, move between lists
- **Partial UUID matching**: Agents can reference tasks with short IDs (e.g., `17jJ` instead of full UUID)
- **Natural language dates**: `--when tomorrow`, `--when "next week"` work intuitively
- **Search**: Find tasks by keyword without knowing exact titles
- **Context-aware**: `--verbose` shows project/area context for better understanding

### Example agent workflows

```bash
# Agent checks what's on today's list
thingsctl today --json

# Agent adds a task from conversation
thingsctl add "Book flight to Denver" --when tomorrow --project "Denver Trip"

# Agent completes a task the user mentioned
thingsctl search "dentist" --json  # Find the task
thingsctl complete 7Ae              # Complete it

# Agent provides a daily briefing
thingsctl today --json | jq -r '.[] | "- \(.title)"'

# Agent checks upcoming deadlines
thingsctl due --json | jq '.[] | select(.deadline <= "2024-03-15")'
```

### Agent prompt snippet

```
You have access to Things 3 via thingsctl. Use these commands:
- `thingsctl today --json` — Get today's tasks
- `thingsctl add "<title>" --when today` — Add a task
- `thingsctl complete <id>` — Mark task done
- `thingsctl search "<query>" --json` — Find tasks
- `thingsctl due --json` — Check deadlines
```

## How It Works

### Read Operations

thingsctl reads directly from the Things 3 SQLite database (read-only mode):

```
~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/
  ThingsData-C1ON7/Things Database.thingsdatabase/main.sqlite
```

### Write Operations

All modifications use the [Things URL Scheme](https://culturedcode.com/things/support/articles/2803573/), the official way to interact with Things programmatically.

### Key Data Model

| Field | Values | Meaning |
|-------|--------|---------|
| `todayIndex` | `> 0` | Task is in Today |
| `start` | `0` | Inbox |
| `start` | `1` | Anytime |
| `start` | `2` | Someday |
| `startDate` | Unix timestamp | Scheduled date |

## Limitations

Due to Things URL scheme constraints:

1. **Cannot create tags** — Tags must already exist in Things
2. **Cannot set recurrence** — Repeating tasks must be created in the app
3. **Cannot move to Inbox** — URL scheme doesn't support this
4. **Things must be running** — For write operations

## Shell Integration

### Bash/Zsh Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias t="thingsctl today"
alias tt="thingsctl today --verbose"
alias ta="thingsctl add"
alias tc="thingsctl complete"
alias ts="thingsctl search"
```

### fzf Integration

```bash
# Select and complete a task interactively
thingsctl today --json | jq -r '.[] | "\(.uuid)\t\(.title)"' | \
  fzf --with-nth=2 | cut -f1 | xargs thingsctl complete
```

## License

MIT
