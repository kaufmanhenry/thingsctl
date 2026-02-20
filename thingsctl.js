#!/usr/bin/env node

/**
 * Things 3 CLI - A proper command-line interface for Things 3
 * 
 * Key insight: todayIndex > 0 means the task is in Today view
 * This is what other tools like clings get wrong!
 */

const Database = require('better-sqlite3');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// Things 3 database path
const DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/ThingsData-C1ON7/Things Database.thingsdatabase/main.sqlite'
);

// Task types
const TYPE = {
  TASK: 0,
  PROJECT: 1,
  HEADING: 2
};

// Task status
const STATUS = {
  OPEN: 0,
  CANCELED: 2,
  COMPLETED: 3
};

// Start values (list assignment)
const START = {
  INBOX: 0,
  ANYTIME: 1,
  SOMEDAY: 2
};

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
};

class ThingsCLI {
  constructor() {
    this.db = new Database(DB_PATH, { readonly: true });
  }

  close() {
    this.db.close();
  }

  // Get today's date boundaries (Unix timestamps)
  getTodayBounds() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    return {
      start: Math.floor(todayStart.getTime() / 1000),
      end: Math.floor(todayEnd.getTime() / 1000)
    };
  }

  // Format a Unix timestamp to readable date
  formatDate(timestamp) {
    if (!timestamp || timestamp < 1000000000) return null;
    const date = new Date(timestamp * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  // Get tags for a task
  getTaskTags(taskUuid) {
    const stmt = this.db.prepare(`
      SELECT t.title 
      FROM TMTag t
      JOIN TMTaskTag tt ON t.uuid = tt.tags
      WHERE tt.tasks = ?
      ORDER BY t.title
    `);
    return stmt.all(taskUuid).map(row => row.title);
  }

  // Get area name for a task
  getAreaName(areaUuid) {
    if (!areaUuid) return null;
    const stmt = this.db.prepare('SELECT title FROM TMArea WHERE uuid = ?');
    const row = stmt.get(areaUuid);
    return row ? row.title : null;
  }

  // Get project name for a task
  getProjectName(projectUuid) {
    if (!projectUuid) return null;
    const stmt = this.db.prepare('SELECT title FROM TMTask WHERE uuid = ? AND type = 1');
    const row = stmt.get(projectUuid);
    return row ? row.title : null;
  }

  // Format task for display
  formatTask(task, options = {}) {
    const { json = false, verbose = false } = options;
    
    if (json) {
      return {
        uuid: task.uuid,
        title: task.title,
        notes: task.notes || null,
        status: task.status === STATUS.COMPLETED ? 'completed' : 
                task.status === STATUS.CANCELED ? 'canceled' : 'open',
        startDate: task.startDate > 1000000000 ? new Date(task.startDate * 1000).toISOString() : null,
        deadline: task.deadline > 1000000000 ? new Date(task.deadline * 1000).toISOString() : null,
        tags: this.getTaskTags(task.uuid),
        project: this.getProjectName(task.project),
        area: this.getAreaName(task.area),
        inToday: task.todayIndex > 0,
        list: task.start === START.INBOX ? 'inbox' : 
              task.start === START.ANYTIME ? 'anytime' : 'someday'
      };
    }

    let line = '';
    
    // Checkbox
    line += task.status === STATUS.COMPLETED ? '✓ ' : 
            task.status === STATUS.CANCELED ? '✗ ' : '☐ ';
    
    // Title
    line += task.title;
    
    // Tags
    const tags = this.getTaskTags(task.uuid);
    if (tags.length > 0) {
      line += ` ${colors.cyan}#${tags.join(' #')}${colors.reset}`;
    }
    
    // Project context
    const project = this.getProjectName(task.project);
    if (project && verbose) {
      line += ` ${colors.dim}[${project}]${colors.reset}`;
    }
    
    // Due date
    const deadline = this.formatDate(task.deadline);
    if (deadline) {
      line += ` ${colors.yellow}📅 ${deadline}${colors.reset}`;
    }
    
    // Scheduled date (if not today)
    const scheduled = this.formatDate(task.startDate);
    if (scheduled && task.startDate > 1000000000) {
      const today = this.getTodayBounds();
      if (task.startDate >= today.end) {
        line += ` ${colors.blue}→ ${scheduled}${colors.reset}`;
      }
    }
    
    return line;
  }

  // TODAY: Tasks explicitly in Today (todayIndex > 0) OR scheduled for today/past
  today(options = {}) {
    const bounds = this.getTodayBounds();
    
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND (
          todayIndex > 0 
          OR (startDate >= 1000000000 AND startDate < ?)
        )
      ORDER BY 
        CASE WHEN todayIndex > 0 THEN 0 ELSE 1 END,
        todayIndex DESC,
        startDate ASC
    `);
    
    const tasks = stmt.all(bounds.end);
    return this.outputTasks(tasks, options);
  }

  // ANYTIME: Tasks with start=1 (Anytime) that aren't in Today
  anytime(options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND start = 1
        AND todayIndex <= 0
        AND project IS NULL
      ORDER BY \`index\` ASC
    `);
    
    const tasks = stmt.all();
    return this.outputTasks(tasks, options);
  }

  // SOMEDAY: Tasks with start=2 (Someday) that aren't scheduled or in Today
  someday(options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND start = 2
        AND todayIndex <= 0
        AND (startDate IS NULL OR startDate < 1000000000)
      ORDER BY \`index\` ASC
    `);
    
    const tasks = stmt.all();
    return this.outputTasks(tasks, options);
  }

  // INBOX: Tasks with start=0 (Inbox)
  inbox(options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND start = 0
      ORDER BY creationDate DESC
    `);
    
    const tasks = stmt.all();
    return this.outputTasks(tasks, options);
  }

  // UPCOMING: Tasks scheduled for future dates
  upcoming(options = {}) {
    const bounds = this.getTodayBounds();
    
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND startDate >= ?
      ORDER BY startDate ASC
    `);
    
    const tasks = stmt.all(bounds.end);
    return this.outputTasks(tasks, { ...options, showDate: true });
  }

  // PROJECTS: List all projects
  projects(options = {}) {
    const stmt = this.db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM TMTask sub 
         WHERE sub.project = t.uuid AND sub.status = 0 AND sub.trashed = 0) as taskCount
      FROM TMTask t
      WHERE t.status = 0 
        AND t.trashed = 0 
        AND t.type = 1
      ORDER BY t.\`index\` ASC
    `);
    
    const projects = stmt.all();
    
    if (options.json) {
      return projects.map(p => ({
        uuid: p.uuid,
        title: p.title,
        taskCount: p.taskCount,
        area: this.getAreaName(p.area)
      }));
    }
    
    return projects.map(p => {
      const area = this.getAreaName(p.area);
      let line = `📁 ${p.title}`;
      if (p.taskCount > 0) {
        line += ` ${colors.dim}(${p.taskCount})${colors.reset}`;
      }
      if (area) {
        line += ` ${colors.magenta}[${area}]${colors.reset}`;
      }
      return line;
    });
  }

  // AREAS: List all areas
  areas(options = {}) {
    const stmt = this.db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM TMTask t 
         WHERE t.area = a.uuid AND t.status = 0 AND t.trashed = 0) as taskCount
      FROM TMArea a
      WHERE a.visible = 1
      ORDER BY a.\`index\` ASC
    `);
    
    const areas = stmt.all();
    
    if (options.json) {
      return areas.map(a => ({
        uuid: a.uuid,
        title: a.title,
        taskCount: a.taskCount
      }));
    }
    
    return areas.map(a => {
      let line = `📂 ${a.title}`;
      if (a.taskCount > 0) {
        line += ` ${colors.dim}(${a.taskCount})${colors.reset}`;
      }
      return line;
    });
  }

  // SEARCH: Full-text search across tasks
  search(query, options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND (title LIKE ? OR notes LIKE ?)
      ORDER BY creationDate DESC
    `);
    
    const pattern = `%${query}%`;
    const tasks = stmt.all(pattern, pattern);
    return this.outputTasks(tasks, { ...options, verbose: true });
  }

  // SHOW: Show task details by ID (partial match supported)
  show(id, options = {}) {
    // Support partial UUID match
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE uuid LIKE ? 
      LIMIT 1
    `);
    
    const task = stmt.get(`${id}%`);
    
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    
    if (options.json) {
      return this.formatTask(task, { json: true });
    }
    
    const lines = [];
    lines.push(`${colors.bold}${task.title}${colors.reset}`);
    lines.push(`${colors.dim}UUID: ${task.uuid}${colors.reset}`);
    lines.push('');
    
    // Status
    const status = task.status === STATUS.COMPLETED ? 'Completed' : 
                   task.status === STATUS.CANCELED ? 'Canceled' : 'Open';
    lines.push(`Status: ${status}`);
    
    // List
    const list = task.start === START.INBOX ? 'Inbox' : 
                 task.start === START.ANYTIME ? 'Anytime' : 'Someday';
    lines.push(`List: ${list}`);
    
    // Today
    if (task.todayIndex > 0) {
      lines.push(`${colors.yellow}★ In Today${colors.reset}`);
    }
    
    // Project
    const project = this.getProjectName(task.project);
    if (project) {
      lines.push(`Project: ${project}`);
    }
    
    // Area
    const area = this.getAreaName(task.area);
    if (area) {
      lines.push(`Area: ${area}`);
    }
    
    // Tags
    const tags = this.getTaskTags(task.uuid);
    if (tags.length > 0) {
      lines.push(`Tags: ${tags.join(', ')}`);
    }
    
    // Dates
    const scheduled = this.formatDate(task.startDate);
    if (scheduled && task.startDate > 1000000000) {
      lines.push(`Scheduled: ${scheduled}`);
    }
    
    const deadline = this.formatDate(task.deadline);
    if (deadline) {
      lines.push(`Deadline: ${deadline}`);
    }
    
    // Notes
    if (task.notes) {
      lines.push('');
      lines.push(`${colors.dim}Notes:${colors.reset}`);
      lines.push(task.notes);
    }
    
    // Checklist items
    const checklistStmt = this.db.prepare(`
      SELECT * FROM TMChecklistItem 
      WHERE task = ? 
      ORDER BY \`index\` ASC
    `);
    const checklist = checklistStmt.all(task.uuid);
    
    if (checklist.length > 0) {
      lines.push('');
      lines.push(`${colors.dim}Checklist:${colors.reset}`);
      for (const item of checklist) {
        const check = item.status === 3 ? '✓' : '☐';
        lines.push(`  ${check} ${item.title}`);
      }
    }
    
    return lines;
  }

  // PROJECT: Show tasks in a project
  project(nameOrId, options = {}) {
    // Find project by name or UUID
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE type = 1 AND status = 0 AND trashed = 0
        AND (uuid LIKE ? OR title LIKE ?)
      LIMIT 1
    `);
    
    const project = stmt.get(`${nameOrId}%`, `%${nameOrId}%`);
    
    if (!project) {
      throw new Error(`Project not found: ${nameOrId}`);
    }
    
    const tasksStmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE project = ? AND type = 0 AND status = 0 AND trashed = 0
      ORDER BY \`index\` ASC
    `);
    
    const tasks = tasksStmt.all(project.uuid);
    
    if (!options.json) {
      console.log(`${colors.bold}📁 ${project.title}${colors.reset}\n`);
    }
    
    return this.outputTasks(tasks, options);
  }

  // ADD: Add a new task via Things URL scheme
  add(title, options = {}) {
    const params = new URLSearchParams();
    params.set('title', title);
    
    if (options.notes) params.set('notes', options.notes);
    if (options.when) params.set('when', options.when);
    if (options.deadline) params.set('deadline', options.deadline);
    if (options.tags) params.set('tags', options.tags);
    if (options.list) params.set('list', options.list);
    if (options.project) params.set('list', options.project);
    
    const url = `things:///add?${params.toString()}`;
    execSync(`open "${url}"`);
    return `Added: ${title}`;
  }

  // COMPLETE: Mark task as complete via URL scheme
  complete(id) {
    // Get full UUID
    const stmt = this.db.prepare(`SELECT uuid, title FROM TMTask WHERE uuid LIKE ?`);
    const task = stmt.get(`${id}%`);
    
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    
    const url = `things:///update?id=${task.uuid}&completed=true`;
    execSync(`open "${url}"`);
    return `Completed: ${task.title}`;
  }

  // MOVE: Move task to a different list via URL scheme
  move(id, options = {}) {
    const stmt = this.db.prepare(`SELECT uuid, title FROM TMTask WHERE uuid LIKE ?`);
    const task = stmt.get(`${id}%`);
    
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    
    let when;
    switch (options.to) {
      case 'today':
        when = 'today';
        break;
      case 'anytime':
        when = 'anytime';
        break;
      case 'someday':
        when = 'someday';
        break;
      case 'inbox':
        // URL scheme doesn't support moving to inbox directly
        throw new Error('Moving to inbox is not supported via URL scheme');
      default:
        // Assume it's a date
        when = options.to;
    }
    
    const url = `things:///update?id=${task.uuid}&when=${when}`;
    execSync(`open "${url}"`);
    return `Moved "${task.title}" to ${options.to}`;
  }

  // TAG: Add or remove tags via URL scheme
  tag(id, options = {}) {
    const stmt = this.db.prepare(`SELECT uuid, title FROM TMTask WHERE uuid LIKE ?`);
    const task = stmt.get(`${id}%`);
    
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    
    if (options.add) {
      const url = `things:///update?id=${task.uuid}&add-tags=${encodeURIComponent(options.add)}`;
      execSync(`open "${url}"`);
      return `Added tag "${options.add}" to "${task.title}"`;
    }
    
    if (options.remove) {
      // Note: URL scheme doesn't support removing tags directly
      // We'd need to use the full tags parameter which replaces all tags
      throw new Error('Removing tags is not fully supported via URL scheme (would replace all tags)');
    }
    
    throw new Error('Specify --add or --remove');
  }

  // TAGS: List all tags
  tags(options = {}) {
    const stmt = this.db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM TMTaskTag tt 
         JOIN TMTask task ON tt.tasks = task.uuid 
         WHERE tt.tags = t.uuid AND task.status = 0 AND task.trashed = 0) as taskCount
      FROM TMTag t
      ORDER BY t.title ASC
    `);
    
    const tags = stmt.all();
    
    if (options.json) {
      return tags.map(t => ({
        uuid: t.uuid,
        title: t.title,
        shortcut: t.shortcut,
        taskCount: t.taskCount
      }));
    }
    
    return tags.map(t => {
      let line = `#${t.title}`;
      if (t.taskCount > 0) {
        line += ` ${colors.dim}(${t.taskCount})${colors.reset}`;
      }
      if (t.shortcut) {
        line += ` ${colors.cyan}[${t.shortcut}]${colors.reset}`;
      }
      return line;
    });
  }

  // LOGBOOK: Show completed tasks
  logbook(options = {}) {
    const limit = options.limit || 20;
    
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 3 
        AND trashed = 0 
        AND type = 0
      ORDER BY stopDate DESC
      LIMIT ?
    `);
    
    const tasks = stmt.all(limit);
    
    if (options.json) {
      return tasks.map(t => this.formatTask(t, { json: true }));
    }
    
    return tasks.map(t => {
      const stopDate = t.stopDate ? new Date(t.stopDate * 1000 + 978307200000) : null;
      let line = `✓ ${t.title}`;
      if (stopDate) {
        const dateStr = stopDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        line += ` ${colors.dim}(${dateStr})${colors.reset}`;
      }
      return line;
    });
  }

  // STATS: Show task statistics
  stats(options = {}) {
    const stats = {};
    
    // Today count
    const bounds = this.getTodayBounds();
    stats.today = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 0
        AND (todayIndex > 0 OR (startDate >= 1000000000 AND startDate < ?))
    `).get(bounds.end).count;
    
    // Inbox count
    stats.inbox = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 0 AND start = 0
    `).get().count;
    
    // Anytime count
    stats.anytime = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 0 AND start = 1 AND todayIndex <= 0 AND project IS NULL
    `).get().count;
    
    // Someday count
    stats.someday = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 0 AND start = 2 
        AND todayIndex <= 0 AND (startDate IS NULL OR startDate < 1000000000)
    `).get().count;
    
    // Upcoming count
    stats.upcoming = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 0 AND startDate >= ?
    `).get(bounds.end).count;
    
    // Total open
    stats.totalOpen = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 0
    `).get().count;
    
    // Completed today
    const cocoaTodayStart = Math.floor(bounds.start - 978307200);
    stats.completedToday = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 3 AND trashed = 0 AND type = 0 AND stopDate >= ?
    `).get(cocoaTodayStart).count;
    
    // Projects count
    stats.projects = this.db.prepare(`
      SELECT COUNT(*) as count FROM TMTask 
      WHERE status = 0 AND trashed = 0 AND type = 1
    `).get().count;
    
    if (options.json) {
      return stats;
    }
    
    const lines = [];
    lines.push(`${colors.bold}Things 3 Statistics${colors.reset}`);
    lines.push('');
    lines.push(`Today:          ${stats.today}`);
    lines.push(`Inbox:          ${stats.inbox}`);
    lines.push(`Anytime:        ${stats.anytime}`);
    lines.push(`Someday:        ${stats.someday}`);
    lines.push(`Upcoming:       ${stats.upcoming}`);
    lines.push('');
    lines.push(`Total Open:     ${stats.totalOpen}`);
    lines.push(`Completed Today: ${stats.completedToday}`);
    lines.push(`Projects:       ${stats.projects}`);
    return lines;
  }

  // Helper to output tasks
  outputTasks(tasks, options = {}) {
    if (options.json) {
      return tasks.map(t => this.formatTask(t, { json: true }));
    }
    
    return tasks.map(t => this.formatTask(t, options));
  }
}

// CLI argument parsing
function parseArgs(args) {
  const parsed = {
    command: null,
    args: [],
    options: {}
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Check if next arg is a value or another flag
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed.options[key] = args[i + 1];
        i += 2;
      } else {
        parsed.options[key] = true;
        i++;
      }
    } else if (!parsed.command) {
      parsed.command = arg;
      i++;
    } else {
      parsed.args.push(arg);
      i++;
    }
  }
  
  return parsed;
}

function printHelp() {
  console.log(`
${colors.bold}thingsctl - Things 3 CLI${colors.reset}

${colors.bold}Usage:${colors.reset}
  thingsctl <command> [args] [options]

${colors.bold}Commands:${colors.reset}
  ${colors.cyan}today${colors.reset}              Show Today's tasks
  ${colors.cyan}anytime${colors.reset}            Show Anytime tasks
  ${colors.cyan}someday${colors.reset}            Show Someday tasks
  ${colors.cyan}inbox${colors.reset}              Show Inbox tasks
  ${colors.cyan}upcoming${colors.reset}           Show scheduled tasks
  ${colors.cyan}projects${colors.reset}           List all projects
  ${colors.cyan}project${colors.reset} <name>     Show tasks in a project
  ${colors.cyan}areas${colors.reset}              List all areas
  ${colors.cyan}tags${colors.reset}               List all tags
  ${colors.cyan}search${colors.reset} <query>     Search tasks
  ${colors.cyan}show${colors.reset} <id>          Show task details
  ${colors.cyan}logbook${colors.reset}            Show completed tasks
  ${colors.cyan}stats${colors.reset}              Show statistics
  
  ${colors.cyan}add${colors.reset} <title>        Add a new task
  ${colors.cyan}complete${colors.reset} <id>      Complete a task
  ${colors.cyan}move${colors.reset} <id>          Move task to a list
  ${colors.cyan}tag${colors.reset} <id>           Manage task tags

${colors.bold}Options:${colors.reset}
  --json             Output as JSON
  --verbose, -v      Show more details
  --limit <n>        Limit results (for logbook)
  
${colors.bold}Add Options:${colors.reset}
  --notes <text>     Add notes
  --when <date>      Schedule date (today, tomorrow, etc.)
  --deadline <date>  Set deadline
  --tags <tags>      Add tags (comma-separated)
  --project <name>   Add to project

${colors.bold}Move Options:${colors.reset}
  --to <list>        Target: today, anytime, someday, or date

${colors.bold}Tag Options:${colors.reset}
  --add <tag>        Add a tag
  --remove <tag>     Remove a tag

${colors.bold}Examples:${colors.reset}
  thingsctl today
  thingsctl today --json
  thingsctl search "buy groceries"
  thingsctl add "Call mom" --when today --tags Phone
  thingsctl complete 7Ae
  thingsctl move 7Ae --to someday
`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }
  
  const parsed = parseArgs(args);
  const cli = new ThingsCLI();
  
  try {
    let result;
    const opts = {
      json: parsed.options.json || false,
      verbose: parsed.options.verbose || parsed.options.v || false,
      limit: parsed.options.limit ? parseInt(parsed.options.limit) : undefined
    };
    
    switch (parsed.command) {
      case 'today':
        result = cli.today(opts);
        break;
      case 'anytime':
        result = cli.anytime(opts);
        break;
      case 'someday':
        result = cli.someday(opts);
        break;
      case 'inbox':
        result = cli.inbox(opts);
        break;
      case 'upcoming':
        result = cli.upcoming(opts);
        break;
      case 'projects':
        result = cli.projects(opts);
        break;
      case 'project':
        if (!parsed.args[0]) {
          throw new Error('Project name or ID required');
        }
        result = cli.project(parsed.args.join(' '), opts);
        break;
      case 'areas':
        result = cli.areas(opts);
        break;
      case 'tags':
        result = cli.tags(opts);
        break;
      case 'search':
        if (!parsed.args[0]) {
          throw new Error('Search query required');
        }
        result = cli.search(parsed.args.join(' '), opts);
        break;
      case 'show':
        if (!parsed.args[0]) {
          throw new Error('Task ID required');
        }
        result = cli.show(parsed.args[0], opts);
        break;
      case 'logbook':
        result = cli.logbook(opts);
        break;
      case 'stats':
        result = cli.stats(opts);
        break;
      case 'add':
        if (!parsed.args[0]) {
          throw new Error('Task title required');
        }
        result = cli.add(parsed.args.join(' '), {
          notes: parsed.options.notes,
          when: parsed.options.when,
          deadline: parsed.options.deadline,
          tags: parsed.options.tags,
          project: parsed.options.project
        });
        break;
      case 'complete':
        if (!parsed.args[0]) {
          throw new Error('Task ID required');
        }
        result = cli.complete(parsed.args[0]);
        break;
      case 'move':
        if (!parsed.args[0]) {
          throw new Error('Task ID required');
        }
        if (!parsed.options.to) {
          throw new Error('--to option required');
        }
        result = cli.move(parsed.args[0], { to: parsed.options.to });
        break;
      case 'tag':
        if (!parsed.args[0]) {
          throw new Error('Task ID required');
        }
        result = cli.tag(parsed.args[0], {
          add: parsed.options.add,
          remove: parsed.options.remove
        });
        break;
      default:
        console.error(`Unknown command: ${parsed.command}`);
        printHelp();
        process.exit(1);
    }
    
    // Output result
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (Array.isArray(result)) {
      if (result.length === 0) {
        console.log(colors.dim + 'No tasks found' + colors.reset);
      } else {
        for (const line of result) {
          console.log(line);
        }
      }
    } else {
      console.log(result);
    }
    
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    cli.close();
  }
}

main();
