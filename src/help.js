'use strict';

const { colors } = require('./lib/format');

function printGlobal() {
  const c = colors;
  process.stdout.write(`
${c.bold('thingsctl - Things 3 CLI')}

${c.bold('Usage:')}
  thingsctl <command> [args] [options]

${c.bold('List Commands:')}
  ${c.cyan('today')}              Tasks in Today
  ${c.cyan('inbox')}              Inbox tasks
  ${c.cyan('anytime')}            Anytime list
  ${c.cyan('someday')}            Someday list
  ${c.cyan('upcoming')}           Scheduled future tasks
  ${c.cyan('due')}                Tasks with deadlines
  ${c.cyan('overdue')}            Tasks past their deadline
  ${c.cyan('evening')}            Tasks scheduled for "this evening"
  ${c.cyan('repeating')}          Repeating tasks (--decode for frequency)
  ${c.cyan('logbook')}            Recently completed tasks
  ${c.cyan('projects')}           List all projects
  ${c.cyan('project <name>')}     Tasks in a project
  ${c.cyan('areas')}              List all areas
  ${c.cyan('tags')}               List all tags
  ${c.cyan('search <query>')}     Full-text search
  ${c.cyan('show <id>')}          Task details
  ${c.cyan('stats')}              Counts across lists

${c.bold('Action Commands:')}
  ${c.cyan('add <title>')}        Add a new task
  ${c.cyan('update <id>')}        Update a task
  ${c.cyan('complete <id...>')}   Complete one or many tasks
  ${c.cyan('move <id> --to ...')} Reschedule a task
  ${c.cyan('tag <id> --add ...')} Add a tag

${c.bold('Workflow Commands:')}
  ${c.cyan('review [--days N]')}  Weekly review (completed/added/deadlines)
  ${c.cyan('export <source>')}    Export md/csv/json
  ${c.cyan('template <name>')}    Clone a project as a new project
  ${c.cyan('watch')}              Stream task changes as NDJSON
  ${c.cyan('config <sub>')}       Manage Things auth token

${c.bold('Global Options:')}
  --json | --verbose, -v | --compact | --ids | --help, -h | --version, -V

${c.bold('Filter Options (list commands):')}
  --tag <name> | --area <name> | --project <name>

${c.bold('Examples:')}
  thingsctl today
  thingsctl today --tag Deep --json
  thingsctl review --days 14
  thingsctl template "Launch" --name "Launch Q3"
  thingsctl complete 7Ae 17j 9pU
`);
}

const PER_COMMAND = {
  add: `
${colors.bold('thingsctl add')} - Add a new task

${colors.bold('Usage:')} thingsctl add <title> [options]

${colors.bold('Options:')}
  --notes <text>          Notes
  --when <date>           today | tomorrow | evening | anytime | someday | "next week" | YYYY-MM-DD
  --deadline <date>       YYYY-MM-DD
  --tags <list>           Comma-separated (must already exist)
  --checklist <items>     Comma-separated checklist items
  --list <list>           inbox | anytime | someday
  --project <name>        Add to project (partial name)
  --area <name>           Add to area (partial name)
  --heading <name>        Add under a heading in the project

${colors.bold('Examples:')}
  thingsctl add "Buy groceries"
  thingsctl add "Call mom" --when today --tags Phone
  thingsctl add "Trip prep" --checklist "Passport,Tickets,Charger"
  thingsctl add "Tax planning" --area Finance --when someday
`,
  update: `
${colors.bold('thingsctl update')} - Update a task

${colors.bold('Usage:')} thingsctl update <id> [options]

${colors.bold('Options:')}
  --title <text>            Change the title
  --notes <text>            Replace notes entirely
  --append-notes <text>     Append text to existing notes
  --prepend-notes <text>    Prepend text to existing notes
  --when <date>             Reschedule
  --deadline <date>         Set deadline
  --add-tags <list>         Add tags
  --completed               Mark complete
  --canceled                Mark canceled
`,
  complete: `
${colors.bold('thingsctl complete')} - Mark task(s) complete

${colors.bold('Usage:')} thingsctl complete <id> [id2] [id3] ...

If a UUID prefix matches more than one task, you'll get an error listing
the candidates. Pass --yes-first to act on the first match instead.
`,
  move: `
${colors.bold('thingsctl move')} - Reschedule a task

${colors.bold('Usage:')} thingsctl move <id> --to <destination>

Destinations:
  today | tomorrow | evening | anytime | someday | "next week" | YYYY-MM-DD
Note: moving to inbox is not supported by the URL scheme.
`,
  tag: `
${colors.bold('thingsctl tag')} - Add a tag

${colors.bold('Usage:')} thingsctl tag <id> --add <tag>

Tags must already exist in Things.
`,
  show: `
${colors.bold('thingsctl show')} - Show task details

${colors.bold('Usage:')} thingsctl show <id> [--json]
`,
  search: `
${colors.bold('thingsctl search')} - Search by title/notes

${colors.bold('Usage:')} thingsctl search <query> [--json] [--verbose]
`,
  project: `
${colors.bold('thingsctl project')} - Show tasks in a project

${colors.bold('Usage:')} thingsctl project <name> [--json]
`,
  export: `
${colors.bold('thingsctl export')} - Export tasks

${colors.bold('Usage:')} thingsctl export <source> [name] [--format md|csv|json]

Sources: today, anytime, someday, inbox, upcoming, evening, overdue, project, area
`,
  review: `
${colors.bold('thingsctl review')} - Weekly review report

${colors.bold('Usage:')} thingsctl review [--days N] [--json]

Includes: completed in window, added in window, deadlines in next N days.
Defaults to 7 days.
`,
  template: `
${colors.bold('thingsctl template')} (alias: clone) - Clone a project

${colors.bold('Usage:')} thingsctl template <source-name> [--name "New name"] [--area <area>] [--dry-run]

Reads the source project's headings, tasks, notes, tags, and checklist
items, then creates a new project via the Things URL JSON API.
`,
  watch: `
${colors.bold('thingsctl watch')} - Stream task changes

${colors.bold('Usage:')} thingsctl watch [--interval N] [--events list] [--once]

Polls the Things DB every N seconds (default 5) and emits NDJSON events.
Events: completions, additions, modifications (default: all three).
`,
  config: `
${colors.bold('thingsctl config')} - Manage configuration

${colors.bold('Usage:')}
  thingsctl config set-token <token>
  thingsctl config show-token
  thingsctl config clear-token
  thingsctl config path

Get your auth token from Things → Settings → General → Enable Things URLs.
`,
};

function printCommand(name) {
  if (!PER_COMMAND[name]) return false;
  process.stdout.write(PER_COMMAND[name]);
  return true;
}

module.exports = { printGlobal, printCommand };
