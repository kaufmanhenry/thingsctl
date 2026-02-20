# thingsctl

A command-line interface for [Things 3](https://culturedcode.com/things/) that **actually matches the UI**.

## Why?

Other Things CLI tools return incorrect results because they misunderstand Things 3's internal data model. For example, they might show 61 tasks in "Today" when the app only shows 5.

**thingsctl** correctly interprets the Things 3 SQLite database by understanding that `todayIndex > 0` means a task is in Today—not just any non-zero value.

## Installation

### Prerequisites

- macOS with Things 3 installed
- Node.js 18+

### Install from source

```bash
git clone https://github.com/henrykaufman/thingsctl.git
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
# Today's tasks (matches Things UI exactly!)
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

Get command-specific help:
```bash
thingsctl add --help
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

All commands support `--json` for programmatic use:

```bash
# Pipe to jq
thingsctl today --json | jq '.[].title'
thingsctl stats --json | jq '.today'

# Count today's tasks
thingsctl today --json | jq length

# Extract task IDs
thingsctl search "meeting" --json | jq -r '.[].uuid'
```

Example JSON output:
```json
[
  {
    "uuid": "17jJuooocGSZxKNv3JuxRx",
    "title": "Look into canceling AAA",
    "notes": null,
    "status": "open",
    "startDate": null,
    "deadline": null,
    "tags": [],
    "project": null,
    "area": "🏠 Home",
    "inToday": true,
    "list": "someday"
  }
]
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--verbose`, `-v` | Show more details (area/project context) |
| `--help`, `-h` | Show help (global or command-specific) |
| `--version`, `-V` | Show version |

## How It Works

### Read Operations

thingsctl reads directly from the Things 3 SQLite database:

```
~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/
  ThingsData-C1ON7/Things Database.thingsdatabase/main.sqlite
```

The database is opened in **read-only mode**—thingsctl never modifies it directly.

### Write Operations

All modifications use the [Things URL Scheme](https://culturedcode.com/things/support/articles/2803573/):

```
things:///add?title=Buy%20milk&when=today
things:///update?id=UUID&completed=true
```

This is the official, safe way to interact with Things programmatically.

### Key Data Model Insights

| Field | Values | Meaning |
|-------|--------|---------|
| `todayIndex` | `> 0` | Task is in Today |
| `todayIndex` | `< 0` | Was in Today, moved out |
| `todayIndex` | `0` | Never in Today |
| `start` | `0` | Inbox |
| `start` | `1` | Anytime |
| `start` | `2` | Someday |
| `type` | `0` | Task |
| `type` | `1` | Project |
| `type` | `2` | Heading |
| `status` | `0` | Open |
| `status` | `2` | Canceled |
| `status` | `3` | Completed |
| `startDate` | Unix timestamp | Scheduled date |
| `rt1_recurrenceRule` | BLOB | Recurrence config |

## Limitations

Due to Things URL scheme constraints:

1. **Cannot create tags** — Tags must already exist in Things
2. **Cannot set recurrence** — Repeating tasks must be created manually
3. **Cannot move to Inbox** — URL scheme doesn't support this
4. **Things must be running** — For any write operations
5. **Cannot remove tags** — Would replace all tags (limitation)

## Comparison with Other Tools

| Feature | thingsctl | clings | things-cli |
|---------|-----------|--------|------------|
| Today accuracy | ✅ Correct | ❌ Wrong | ❌ Limited |
| Full SQLite access | ✅ | ✅ | ❌ |
| JSON output | ✅ | ❌ | ✅ |
| Search | ✅ | ✅ | ❌ |
| URL scheme writes | ✅ | ❌ | ✅ |
| Repeating tasks | ✅ | ❌ | ❌ |
| Deadline tracking | ✅ | ❌ | ❌ |
| Project/area assignment | ✅ | ❌ | Partial |

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

### Fish Functions

```fish
# Add to ~/.config/fish/functions/
function t; thingsctl today $argv; end
function ta; thingsctl add $argv; end
```

### fzf Integration

```bash
# Select and complete a task interactively
thingsctl today --json | jq -r '.[] | "\(.uuid)\t\(.title)"' | \
  fzf --with-nth=2 | cut -f1 | xargs thingsctl complete
```

## Development

```bash
# Run locally without installing
node thingsctl.js today

# Run tests
npm test

# Check version
node thingsctl.js --version
```

## License

MIT

## Contributing

Issues and PRs welcome! This started as a personal tool to fix the "Today shows wrong count" problem.

## Credits

- [Cultured Code](https://culturedcode.com/) for making Things 3
- Inspired by frustration with `clings` returning 61 tasks when Things showed 5
