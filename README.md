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

## Usage

### Viewing Tasks

```bash
# Today's tasks (matches Things UI exactly!)
thingsctl today

# Other lists
thingsctl inbox
thingsctl anytime
thingsctl someday
thingsctl upcoming

# With JSON output for scripting
thingsctl today --json
```

### Projects & Organization

```bash
# List all projects
thingsctl projects

# Show tasks in a specific project
thingsctl project "Wedding Planning"
thingsctl project Wedding          # Partial match works

# List areas and tags
thingsctl areas
thingsctl tags
```

### Search & Details

```bash
# Full-text search
thingsctl search "birthday"
thingsctl search groceries

# Show task details (partial UUID works)
thingsctl show 17jJ
thingsctl show 17jJuooocGSZxKNv3JuxRx

# Recently completed tasks
thingsctl logbook
thingsctl logbook --limit 50
```

### Statistics

```bash
thingsctl stats

# Output:
# Things 3 Statistics
#
# Today:          5
# Inbox:          0
# Anytime:        10
# Someday:        53
# Upcoming:       13
#
# Total Open:     132
# Completed Today: 14
# Projects:       18
```

### Creating & Modifying Tasks

Uses Things URL scheme for safe write operations:

```bash
# Add a new task
thingsctl add "Buy milk"
thingsctl add "Call mom" --when today
thingsctl add "Review proposal" --when tomorrow --deadline 2024-03-15
thingsctl add "Weekly review" --tags "Review,Deep"
thingsctl add "Fix bug" --project "App Maintenance"

# Complete a task
thingsctl complete 17jJ

# Move task to different list
thingsctl move 17jJ --to today
thingsctl move 17jJ --to anytime
thingsctl move 17jJ --to someday
thingsctl move 17jJ --to 2024-03-20   # Schedule for specific date

# Manage tags
thingsctl tag 17jJ --add Important
thingsctl tag 17jJ --add "Deep Work"
```

### JSON Output

All commands support `--json` for programmatic use:

```bash
# Pipe to jq
thingsctl today --json | jq '.[].title'
thingsctl stats --json | jq '.today'

# Use in scripts
TASKS=$(thingsctl today --json)
COUNT=$(echo "$TASKS" | jq length)
```

### Example JSON Output

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

## Limitations

Due to Things URL scheme constraints:

1. **Cannot create tags** — Tags must already exist in Things
2. **Cannot set recurrence** — Repeating tasks must be created manually
3. **Cannot move to Inbox** — URL scheme doesn't support this
4. **Things must be running** — For any write operations

## Comparison with Other Tools

| Feature | thingsctl | clings | things-cli |
|---------|-----------|--------|------------|
| Today accuracy | ✅ Correct | ❌ Wrong | ❌ Limited |
| Full SQLite access | ✅ | ✅ | ❌ |
| JSON output | ✅ | ❌ | ✅ |
| Search | ✅ | ✅ | ❌ |
| URL scheme writes | ✅ | ❌ | ✅ |

## Development

```bash
# Run locally without installing
node thingsctl.js today

# Run tests
npm test
```

## License

MIT

## Contributing

Issues and PRs welcome! This started as a personal tool to fix the "Today shows wrong count" problem, but happy to expand it.

## Credits

- [Cultured Code](https://culturedcode.com/) for making Things 3
- Inspired by frustration with `clings` returning 61 tasks when Things showed 5
