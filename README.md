# thingsctl

A full-featured command-line interface and **MCP server** for [Things 3](https://culturedcode.com/things/) on macOS. Designed to be a daily driver for humans and a first-class tool for AI agents (Claude Code, GPT, etc.).

```
thingsctl review --days 7
thingsctl today --tag Deep --json
thingsctl complete 7Ae 17j 9pU
thingsctl template "Launch" --name "Launch Q3"
```

Plus — `thingsctl-mcp` exposes the same surface as native tools to any MCP client.

## Install

```bash
npm install -g thingsctl
```

Requires macOS with Things 3 installed and Node ≥ 18.

### One-time auth-token setup

Modifying tasks (add, complete, update, …) needs your Things URL auth token. Get it from **Things → Settings → General → Enable Things URLs → Manage**, then:

```bash
thingsctl config set-token <your-token>
```

(Or set the `THINGS_AUTH_TOKEN` environment variable.)

## Quick reference

### Reading

```bash
thingsctl today                  # Today
thingsctl today --tag Deep       # Filter by tag
thingsctl today --area Work      # Filter by area
thingsctl today --json           # Structured JSON

thingsctl inbox
thingsctl anytime
thingsctl someday
thingsctl upcoming
thingsctl due                    # All deadlines
thingsctl overdue                # Past their deadline
thingsctl evening                # "This evening" tasks
thingsctl repeating --decode     # Recurrence + next instance
thingsctl logbook --since 7      # Completed in last 7 days

thingsctl projects
thingsctl project "Wedding"
thingsctl areas
thingsctl tags

thingsctl search "groceries"
thingsctl show 7Ae               # Partial UUID — errors on ambiguity
thingsctl stats
```

### Writing

```bash
thingsctl add "Buy milk"
thingsctl add "Trip prep" --checklist "Passport,Tickets,Charger"
thingsctl add "Tax filing" --when 2027-04-15 --deadline 2027-04-15 --tags Important

thingsctl update 7Ae --title "New title" --append-notes "context"
thingsctl complete 7Ae           # Single
thingsctl complete 7Ae 17j 9pU   # Bulk
thingsctl move 7Ae --to "next week"
thingsctl tag 7Ae --add Urgent
```

### Workflows

```bash
thingsctl review --days 7        # Weekly review (completed/added/deadlines)
thingsctl review --days 30 --json

thingsctl export today --format md > today.md
thingsctl export project "CoStudy" --format csv

thingsctl template "Sprint Template" --name "Sprint 12"   # Clone a project
thingsctl template "Sprint" --dry-run                     # Preview JSON payload

thingsctl watch                  # Stream task changes as NDJSON
thingsctl watch --interval 10 --events completions
```

## MCP server (Claude Code, etc.)

Register the MCP server with Claude Code:

```bash
claude mcp add things thingsctl-mcp
```

Then ask Claude things like *"What's overdue?"*, *"Add 'Schedule dentist' for tomorrow"*, *"Run a weekly review"*, *"Clone the Sprint Template project as Sprint 13"* — Claude will call the appropriate tools (`things_overdue`, `things_add`, `things_review`, `things_clone_project`) directly.

The full MCP tool surface (24 tools): `things_today`, `things_inbox`, `things_anytime`, `things_someday`, `things_upcoming`, `things_due`, `things_overdue`, `things_evening`, `things_repeating`, `things_logbook`, `things_projects`, `things_project`, `things_areas`, `things_tags`, `things_search`, `things_show`, `things_stats`, `things_review`, `things_export`, `things_add`, `things_update`, `things_complete`, `things_move`, `things_tag`, `things_clone_project`.

## Bug fixes vs 1.x

- **UUID prefix collisions are now an error** (was: silently picked the first match). Pass `--yes-first` to opt into the old behavior on bulk commands.
- **N+1 query in filtered lists is gone** — filters are pushed into SQL via JOINs, so `thingsctl today --tag Deep` no longer fires hundreds of queries.
- **Cocoa-epoch math is centralized** in `src/lib/dates.js` (was inconsistent between `logbook` and `stats`).
- **`export today` now matches `today`** — the same dedupe and Someday-exclusion runs.
- **CSV is RFC 4180** — quotes embedded `"`, `,`, `\n`, `\r` correctly.
- **Auth token is no longer in source** — moved to `~/.config/thingsctl/auth-token` or `THINGS_AUTH_TOKEN` env.

## How it works

- **Reads** open the Things 3 SQLite database in read-only mode at `~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/ThingsData-C1ON7/Things Database.thingsdatabase/main.sqlite`.
- **Writes** go through the [Things URL scheme](https://culturedcode.com/things/support/articles/2803573/), the only officially-supported programmatic write path.

### Data model crib sheet

| Field        | Values             | Meaning                            |
|--------------|--------------------|------------------------------------|
| `todayIndex` | `> 0`              | Task is in Today                   |
| `start`      | `0` / `1` / `2`    | Inbox / Anytime / Someday          |
| `startBucket`| `0` / `1`          | Today / This Evening               |
| `startDate`  | unix seconds       | Scheduled date                     |
| `deadline`   | unix seconds       | Deadline                           |
| `stopDate`   | Cocoa seconds      | Completion timestamp               |
| `creationDate` | Cocoa seconds    | Created at                         |
| `userModificationDate` | Cocoa seconds | Last modified                |

## Limitations

- **Cannot create tags** — they must already exist in Things.
- **Cannot create headings** — must already exist in projects.
- **Cannot move to Inbox** — URL scheme limitation.
- **Cannot remove tags individually** — would replace all tags.
- **Things must be running** for write operations.

## Development

```bash
git clone https://github.com/kaufmanhenry/thingsctl.git
cd thingsctl
npm install
npm run fixture       # Build test SQLite fixture
npm test              # Jest unit + integration
node bin/thingsctl.js today
```

## License

MIT
