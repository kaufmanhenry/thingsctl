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
// This is the SQLite database that Things uses to store all data.
// We open it in read-only mode for safety.
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
    
    // Project/Area context in verbose mode
    if (verbose) {
      const project = this.getProjectName(task.project);
      const area = this.getAreaName(task.area);
      if (project) {
        line += ` ${colors.dim}[${project}]${colors.reset}`;
      } else if (area) {
        line += ` ${colors.dim}[${area}]${colors.reset}`;
      }
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
  // 
  // Key insight: todayIndex > 0 means the user explicitly added this to Today.
  // A positive value means "in Today", not just "was once touched".
  // This is what most other Things CLI tools get wrong!
  //
  // We also include tasks scheduled for today or earlier (startDate < today_end).
  // startDate uses Unix timestamps, but values < 1000000000 are typically NULL/empty.
  //
  // Supports filters: --tag, --area, --project
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
    
    let tasks = stmt.all(bounds.end);
    tasks = this.applyFilters(tasks, options);
    return this.outputTasks(tasks, options);
  }

  // ANYTIME: Tasks with start=1 (Anytime) that aren't in Today
  // Supports filters: --tag, --area, --project
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
    
    let tasks = stmt.all();
    tasks = this.applyFilters(tasks, options);
    return this.outputTasks(tasks, options);
  }

  // SOMEDAY: Tasks with start=2 (Someday) that aren't scheduled or in Today
  // Supports filters: --tag, --area, --project
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
    
    let tasks = stmt.all();
    tasks = this.applyFilters(tasks, options);
    return this.outputTasks(tasks, options);
  }

  // INBOX: Tasks with start=0 (Inbox)
  // Supports filters: --tag
  inbox(options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND start = 0
      ORDER BY creationDate DESC
    `);
    
    let tasks = stmt.all();
    tasks = this.applyFilters(tasks, options);
    return this.outputTasks(tasks, options);
  }

  // UPCOMING: Tasks scheduled for future dates
  // Supports filters: --tag, --area, --project
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
    
    let tasks = stmt.all(bounds.end);
    tasks = this.applyFilters(tasks, options);
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
  // Note: visible column is often NULL in Things DB, so we don't filter on it
  areas(options = {}) {
    const stmt = this.db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM TMTask t 
         WHERE t.area = a.uuid AND t.status = 0 AND t.trashed = 0 AND t.type = 0) as taskCount,
        (SELECT COUNT(*) FROM TMTask t 
         WHERE t.area = a.uuid AND t.status = 0 AND t.trashed = 0 AND t.type = 1) as projectCount
      FROM TMArea a
      ORDER BY a.\`index\` ASC
    `);
    
    const areas = stmt.all();
    
    if (options.json) {
      return areas.map(a => ({
        uuid: a.uuid,
        title: a.title,
        taskCount: a.taskCount,
        projectCount: a.projectCount
      }));
    }
    
    return areas.map(a => {
      let line = `📂 ${a.title}`;
      const counts = [];
      if (a.taskCount > 0) counts.push(`${a.taskCount} tasks`);
      if (a.projectCount > 0) counts.push(`${a.projectCount} projects`);
      if (counts.length > 0) {
        line += ` ${colors.dim}(${counts.join(', ')})${colors.reset}`;
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

  // Find area UUID by name (partial match)
  findAreaByName(name) {
    const stmt = this.db.prepare(`
      SELECT uuid, title FROM TMArea 
      WHERE title LIKE ?
      LIMIT 1
    `);
    return stmt.get(`%${name}%`);
  }

  // Find project UUID by name (partial match)
  findProjectByName(name) {
    const stmt = this.db.prepare(`
      SELECT uuid, title FROM TMTask 
      WHERE type = 1 AND status = 0 AND trashed = 0
        AND title LIKE ?
      LIMIT 1
    `);
    return stmt.get(`%${name}%`);
  }

  // ADD: Add a new task via Things URL scheme
  // Supports: --notes, --when, --deadline, --tags, --list, --project, --area, --checklist
  add(title, options = {}) {
    const params = new URLSearchParams();
    params.set('title', title);
    params.set('auth-token', 'k6oWCQGAHQIBAAAAAAAAAA');
    
    if (options.notes) params.set('notes', options.notes);
    if (options.when) params.set('when', options.when);
    if (options.deadline) params.set('deadline', options.deadline);
    if (options.tags) params.set('tags', options.tags);
    
    // Checklist items (comma-separated or newline-separated)
    if (options.checklist) {
      // Things URL scheme uses newline-separated items
      const items = options.checklist.split(',').map(s => s.trim()).join('\n');
      params.set('checklist-items', items);
    }
    
    // Handle list assignment (inbox, anytime, someday)
    if (options.list) params.set('list', options.list);
    
    // Handle project assignment (takes precedence over list)
    if (options.project) {
      const project = this.findProjectByName(options.project);
      if (project) {
        params.set('list', project.title);
      } else {
        throw new Error(`Project not found: ${options.project}`);
      }
    }
    
    // Handle area assignment (via list-id parameter)
    if (options.area) {
      const area = this.findAreaByName(options.area);
      if (area) {
        params.set('list-id', area.uuid);
      } else {
        throw new Error(`Area not found: ${options.area}`);
      }
    }
    
    // Handle heading (section within a project)
    if (options.heading) params.set('heading', options.heading);
    
    // URLSearchParams encodes spaces as +, but Things URL scheme needs %20
    const url = `things:///add?${params.toString().replace(/\+/g, '%20')}`;
    
    try {
      execSync(`open "${url}"`);
    } catch (e) {
      throw new Error('Failed to open Things. Is Things 3 installed and running?');
    }
    
    let result = `${colors.green}✓${colors.reset} Added: ${title}`;
    if (options.checklist) {
      const count = options.checklist.split(',').length;
      result += ` (${count} checklist items)`;
    }
    if (options.project) result += ` → ${options.project}`;
    if (options.area) result += ` (${options.area})`;
    if (options.when) result += ` [${options.when}]`;
    return result;
  }

  // COMPLETE: Mark task(s) as complete via URL scheme
  // Supports bulk completion: complete(["id1", "id2", "id3"])
  complete(ids) {
    // Handle single ID or array of IDs
    const idList = Array.isArray(ids) ? ids : [ids];
    const results = [];
    const stmt = this.db.prepare(`SELECT uuid, title, status FROM TMTask WHERE uuid LIKE ?`);
    
    for (const id of idList) {
      const task = stmt.get(`${id}%`);
      
      if (!task) {
        results.push(`${colors.red}✗${colors.reset} Not found: ${id}`);
        continue;
      }
      
      if (task.status === STATUS.COMPLETED) {
        results.push(`${colors.dim}Already completed: ${task.title}${colors.reset}`);
        continue;
      }
      
      const url = `things:///update?id=${task.uuid}&completed=true&auth-token=k6oWCQGAHQIBAAAAAAAAAA`;
      try {
        execSync(`open "${url}"`);
        results.push(`${colors.green}✓${colors.reset} Completed: ${task.title}`);
      } catch (e) {
        results.push(`${colors.red}✗${colors.reset} Failed: ${task.title}`);
      }
    }
    
    // Return single string for single ID, array for bulk
    return idList.length === 1 ? results[0] : results;
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

  // DUE: Tasks with upcoming deadlines
  due(options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND deadline > 1000000000
      ORDER BY deadline ASC
    `);
    
    const tasks = stmt.all();
    return this.outputTasks(tasks, { ...options, showDeadline: true });
  }

  // REPEATING: Show all repeating tasks
  // Note: recurrence rule is stored in rt1_recurrenceRule as a BLOB
  repeating(options = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM TMTask 
      WHERE status = 0 
        AND trashed = 0 
        AND type = 0
        AND rt1_recurrenceRule IS NOT NULL
      ORDER BY title ASC
    `);
    
    const tasks = stmt.all();
    
    if (options.json) {
      return tasks.map(t => this.formatTask(t, { json: true }));
    }
    
    return tasks.map(t => {
      let line = `🔄 ${t.title}`;
      const tags = this.getTaskTags(t.uuid);
      if (tags.length > 0) {
        line += ` ${colors.cyan}#${tags.join(' #')}${colors.reset}`;
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
    
    // --ids flag: output only UUIDs (for scripting)
    if (options.ids) {
      return tasks.map(t => t.uuid);
    }
    
    // --compact flag: single-line format
    if (options.compact) {
      return tasks.map(t => {
        const check = t.status === STATUS.COMPLETED ? '✓' : '☐';
        return `${check} ${t.uuid.slice(0, 4)} ${t.title}`;
      });
    }
    
    return tasks.map(t => this.formatTask(t, options));
  }

  // Apply filters to a task list
  applyFilters(tasks, options = {}) {
    let filtered = tasks;
    
    // Filter by tag
    if (options.tag) {
      const tagName = options.tag.toLowerCase();
      filtered = filtered.filter(t => {
        const tags = this.getTaskTags(t.uuid);
        return tags.some(tag => tag.toLowerCase().includes(tagName));
      });
    }
    
    // Filter by area
    if (options.area) {
      const areaName = options.area.toLowerCase();
      filtered = filtered.filter(t => {
        const area = this.getAreaName(t.area);
        return area && area.toLowerCase().includes(areaName);
      });
    }
    
    // Filter by project
    if (options.project) {
      const projectName = options.project.toLowerCase();
      filtered = filtered.filter(t => {
        const project = this.getProjectName(t.project);
        return project && project.toLowerCase().includes(projectName);
      });
    }
    
    return filtered;
  }

  // UPDATE: Update task properties via URL scheme
  update(id, options = {}) {
    const stmt = this.db.prepare(`SELECT uuid, title, notes FROM TMTask WHERE uuid LIKE ?`);
    const task = stmt.get(`${id}%`);
    
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    
    const params = new URLSearchParams();
    params.set('id', task.uuid);
    params.set('auth-token', 'k6oWCQGAHQIBAAAAAAAAAA');
    
    // Title update
    if (options.title) {
      params.set('title', options.title);
    }
    
    // Notes update (replaces existing notes)
    if (options.notes) {
      params.set('notes', options.notes);
    }
    
    // Append to notes
    if (options['append-notes']) {
      const newNotes = task.notes 
        ? `${task.notes}\n\n${options['append-notes']}`
        : options['append-notes'];
      params.set('notes', newNotes);
    }
    
    // Prepend to notes
    if (options['prepend-notes']) {
      const newNotes = task.notes 
        ? `${options['prepend-notes']}\n\n${task.notes}`
        : options['prepend-notes'];
      params.set('notes', newNotes);
    }
    
    // When (schedule date)
    if (options.when) {
      params.set('when', options.when);
    }
    
    // Deadline
    if (options.deadline) {
      params.set('deadline', options.deadline);
    }
    
    // Tags (add)
    if (options['add-tags']) {
      params.set('add-tags', options['add-tags']);
    }
    
    // Completed
    if (options.completed !== undefined) {
      params.set('completed', options.completed ? 'true' : 'false');
    }
    
    // Canceled
    if (options.canceled !== undefined) {
      params.set('canceled', options.canceled ? 'true' : 'false');
    }
    
    // URLSearchParams encodes spaces as +, but Things URL scheme needs %20
    const url = `things:///update?${params.toString().replace(/\+/g, '%20')}`;
    
    try {
      execSync(`open "${url}"`);
    } catch (e) {
      throw new Error('Failed to open Things. Is Things 3 running?');
    }
    
    const changes = [];
    if (options.title) changes.push(`title → "${options.title}"`);
    if (options.notes) changes.push('notes updated');
    if (options['append-notes']) changes.push('notes appended');
    if (options['prepend-notes']) changes.push('notes prepended');
    if (options.when) changes.push(`when → ${options.when}`);
    if (options.deadline) changes.push(`deadline → ${options.deadline}`);
    if (options['add-tags']) changes.push(`tags += ${options['add-tags']}`);
    
    return `${colors.green}✓${colors.reset} Updated "${task.title}": ${changes.join(', ')}`;
  }

  // EXPORT: Export tasks in various formats
  export(source, options = {}) {
    let tasks = [];
    let title = '';
    
    // Get tasks based on source
    switch (source) {
      case 'today':
        const bounds = this.getTodayBounds();
        const todayStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE status = 0 AND trashed = 0 AND type = 0
            AND (todayIndex > 0 OR (startDate >= 1000000000 AND startDate < ?))
          ORDER BY todayIndex DESC, startDate ASC
        `);
        tasks = todayStmt.all(bounds.end);
        title = 'Today';
        break;
        
      case 'anytime':
        const anytimeStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE status = 0 AND trashed = 0 AND type = 0
            AND start = 1 AND todayIndex <= 0 AND project IS NULL
          ORDER BY \`index\` ASC
        `);
        tasks = anytimeStmt.all();
        title = 'Anytime';
        break;
        
      case 'someday':
        const somedayStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE status = 0 AND trashed = 0 AND type = 0
            AND start = 2 AND todayIndex <= 0 
            AND (startDate IS NULL OR startDate < 1000000000)
          ORDER BY \`index\` ASC
        `);
        tasks = somedayStmt.all();
        title = 'Someday';
        break;
        
      case 'inbox':
        const inboxStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE status = 0 AND trashed = 0 AND type = 0 AND start = 0
          ORDER BY creationDate DESC
        `);
        tasks = inboxStmt.all();
        title = 'Inbox';
        break;
        
      case 'project':
        if (!options.name) {
          throw new Error('Project name required for export project');
        }
        const projectStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE type = 1 AND status = 0 AND trashed = 0
            AND (uuid LIKE ? OR title LIKE ?)
          LIMIT 1
        `);
        const project = projectStmt.get(`${options.name}%`, `%${options.name}%`);
        if (!project) {
          throw new Error(`Project not found: ${options.name}`);
        }
        const projectTasksStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE project = ? AND type = 0 AND status = 0 AND trashed = 0
          ORDER BY \`index\` ASC
        `);
        tasks = projectTasksStmt.all(project.uuid);
        title = project.title;
        break;
        
      case 'area':
        if (!options.name) {
          throw new Error('Area name required for export area');
        }
        const area = this.findAreaByName(options.name);
        if (!area) {
          throw new Error(`Area not found: ${options.name}`);
        }
        const areaTasksStmt = this.db.prepare(`
          SELECT * FROM TMTask 
          WHERE area = ? AND type = 0 AND status = 0 AND trashed = 0
          ORDER BY \`index\` ASC
        `);
        tasks = areaTasksStmt.all(area.uuid);
        title = area.title;
        break;
        
      default:
        throw new Error(`Unknown export source: ${source}. Use: today, anytime, someday, inbox, project, area`);
    }
    
    const format = options.format || 'md';
    
    if (format === 'md' || format === 'markdown') {
      return this.exportMarkdown(tasks, title);
    } else if (format === 'csv') {
      return this.exportCSV(tasks, title);
    } else if (format === 'json') {
      return JSON.stringify(tasks.map(t => this.formatTask(t, { json: true })), null, 2);
    } else {
      throw new Error(`Unknown format: ${format}. Use: md, csv, json`);
    }
  }

  exportMarkdown(tasks, title) {
    const lines = [];
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`*Exported: ${new Date().toLocaleDateString()}*`);
    lines.push('');
    
    for (const task of tasks) {
      const check = task.status === STATUS.COMPLETED ? '[x]' : '[ ]';
      let line = `- ${check} ${task.title}`;
      
      const tags = this.getTaskTags(task.uuid);
      if (tags.length > 0) {
        line += ` #${tags.join(' #')}`;
      }
      
      const deadline = this.formatDate(task.deadline);
      if (deadline) {
        line += ` 📅 ${deadline}`;
      }
      
      lines.push(line);
      
      // Add notes as indented text
      if (task.notes) {
        const noteLines = task.notes.split('\n');
        for (const noteLine of noteLines) {
          lines.push(`    ${noteLine}`);
        }
      }
      
      // Add checklist items
      const checklistStmt = this.db.prepare(`
        SELECT * FROM TMChecklistItem WHERE task = ? ORDER BY \`index\` ASC
      `);
      const checklist = checklistStmt.all(task.uuid);
      for (const item of checklist) {
        const itemCheck = item.status === 3 ? '[x]' : '[ ]';
        lines.push(`    - ${itemCheck} ${item.title}`);
      }
    }
    
    return lines.join('\n');
  }

  exportCSV(tasks, title) {
    const lines = [];
    lines.push('uuid,title,status,tags,project,area,deadline,notes');
    
    for (const task of tasks) {
      const status = task.status === STATUS.COMPLETED ? 'completed' : 'open';
      const tags = this.getTaskTags(task.uuid).join(';');
      const project = this.getProjectName(task.project) || '';
      const area = this.getAreaName(task.area) || '';
      const deadline = task.deadline > 1000000000 
        ? new Date(task.deadline * 1000).toISOString().split('T')[0] 
        : '';
      const notes = (task.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
      
      lines.push(`"${task.uuid}","${task.title}","${status}","${tags}","${project}","${area}","${deadline}","${notes}"`);
    }
    
    return lines.join('\n');
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

function printCommandHelp(command) {
  const helps = {
    add: `
${colors.bold}thingsctl add${colors.reset} - Add a new task

${colors.bold}Usage:${colors.reset}
  thingsctl add <title> [options]

${colors.bold}Options:${colors.reset}
  --notes <text>     Add notes to the task
  --when <date>      Schedule date:
                     - today, tomorrow, evening, anytime, someday
                     - next week, next month
                     - YYYY-MM-DD (e.g., 2024-03-15)
  --deadline <date>  Set deadline (YYYY-MM-DD)
  --tags <tags>      Add tags (comma-separated)
  --checklist <items> Checklist items (comma-separated)
  --list <list>      Target list (inbox, anytime, someday)
  --project <name>   Add to project (partial name match)
  --area <name>      Add to area (partial name match)
  --heading <name>   Add under heading in project

${colors.bold}Examples:${colors.reset}
  thingsctl add "Buy groceries"
  thingsctl add "Call mom" --when today --tags Phone
  thingsctl add "Trip prep" --checklist "Passport,Tickets,Charger"
  thingsctl add "Review quarterly goals" --when "next week" --deadline 2024-03-31
  thingsctl add "Fix login bug" --project "Website Redesign"
  thingsctl add "Tax planning" --area Finance --when someday
  thingsctl add "Final touches" --project "Website" --heading "Launch Tasks"

${colors.bold}Notes:${colors.reset}
  - Tags must already exist in Things (URL scheme limitation)
  - Project/area names are matched partially (case-insensitive)
`,
    update: `
${colors.bold}thingsctl update${colors.reset} - Update a task

${colors.bold}Usage:${colors.reset}
  thingsctl update <id> [options]

${colors.bold}Arguments:${colors.reset}
  <id>    Task UUID (partial match supported)

${colors.bold}Options:${colors.reset}
  --title <text>         Change the title
  --notes <text>         Replace notes entirely
  --append-notes <text>  Append text to existing notes
  --prepend-notes <text> Prepend text to existing notes
  --when <date>          Change schedule date (today, tomorrow, YYYY-MM-DD)
  --deadline <date>      Change deadline (YYYY-MM-DD)
  --add-tags <tags>      Add tags (comma-separated)

${colors.bold}Examples:${colors.reset}
  thingsctl update 7Ae3 --title "New task title"
  thingsctl update 7Ae3 --notes "Completely new notes"
  thingsctl update 7Ae3 --append-notes "Added this context"
  thingsctl update 7Ae3 --when tomorrow
  thingsctl update 7Ae3 --deadline 2026-03-15
  thingsctl update 7Ae3 --add-tags "Important,Urgent"
  thingsctl update 7Ae3 --when today --deadline 2026-03-20

${colors.bold}Notes:${colors.reset}
  - Use 'thingsctl show <id>' to see current values before updating
  - Tags must already exist in Things (URL scheme limitation)
`,
    complete: `
${colors.bold}thingsctl complete${colors.reset} - Mark task(s) as complete

${colors.bold}Usage:${colors.reset}
  thingsctl complete <id> [id2] [id3] ...

${colors.bold}Arguments:${colors.reset}
  <id>    Task UUID(s) (partial match supported)

${colors.bold}Examples:${colors.reset}
  thingsctl complete 7Ae3              # Single task
  thingsctl complete 17jJ ANsB 9pUS    # Bulk complete multiple tasks

${colors.bold}Tip:${colors.reset} Use 'thingsctl today --ids' to get UUIDs for scripting.
`,
    export: `
${colors.bold}thingsctl export${colors.reset} - Export tasks to file

${colors.bold}Usage:${colors.reset}
  thingsctl export <source> [name] [options]

${colors.bold}Sources:${colors.reset}
  today              Export Today's tasks
  anytime            Export Anytime tasks
  someday            Export Someday tasks
  inbox              Export Inbox tasks
  project <name>     Export tasks from a project
  area <name>        Export tasks from an area

${colors.bold}Options:${colors.reset}
  --format <fmt>     Output format: md, csv, json (default: md)

${colors.bold}Examples:${colors.reset}
  thingsctl export today                    # Markdown by default
  thingsctl export today --format md        # Explicit markdown
  thingsctl export project "CoStudy" --format csv
  thingsctl export area Finance --format json
  thingsctl export today --format md > today.md

${colors.bold}Output:${colors.reset}
  md   - Markdown checklist format with notes
  csv  - Spreadsheet-compatible with headers
  json - Full task data as JSON array
`,
    move: `
${colors.bold}thingsctl move${colors.reset} - Move a task to a different list

${colors.bold}Usage:${colors.reset}
  thingsctl move <id> --to <destination>

${colors.bold}Arguments:${colors.reset}
  <id>    Task UUID (partial match supported)

${colors.bold}Options:${colors.reset}
  --to <dest>    Destination:
                 - today, anytime, someday
                 - tomorrow, evening, next week
                 - YYYY-MM-DD (schedule for specific date)

${colors.bold}Examples:${colors.reset}
  thingsctl move 7Ae3 --to today
  thingsctl move 7Ae3 --to someday
  thingsctl move 7Ae3 --to 2024-03-15
  thingsctl move 7Ae3 --to "next week"

${colors.bold}Note:${colors.reset} Moving to inbox is not supported via URL scheme.
`,
    tag: `
${colors.bold}thingsctl tag${colors.reset} - Add or remove tags from a task

${colors.bold}Usage:${colors.reset}
  thingsctl tag <id> --add <tag>
  thingsctl tag <id> --remove <tag>

${colors.bold}Arguments:${colors.reset}
  <id>    Task UUID (partial match supported)

${colors.bold}Options:${colors.reset}
  --add <tag>       Add a tag to the task
  --remove <tag>    Remove a tag (limited support)

${colors.bold}Examples:${colors.reset}
  thingsctl tag 7Ae3 --add "Important"
  thingsctl tag 7Ae3 --add "Home,Errand"

${colors.bold}Limitations:${colors.reset}
  - Tags must already exist in Things
  - Removing tags may replace all existing tags (URL scheme limitation)
`,
    show: `
${colors.bold}thingsctl show${colors.reset} - Show task details

${colors.bold}Usage:${colors.reset}
  thingsctl show <id> [--json]

${colors.bold}Arguments:${colors.reset}
  <id>    Task UUID (partial match supported)

${colors.bold}Options:${colors.reset}
  --json    Output as JSON

${colors.bold}Examples:${colors.reset}
  thingsctl show 7Ae3
  thingsctl show 17jJ --json
`,
    search: `
${colors.bold}thingsctl search${colors.reset} - Search tasks by title or notes

${colors.bold}Usage:${colors.reset}
  thingsctl search <query> [options]

${colors.bold}Options:${colors.reset}
  --json       Output as JSON
  --verbose    Show project context

${colors.bold}Examples:${colors.reset}
  thingsctl search "groceries"
  thingsctl search "meeting" --json
`,
    project: `
${colors.bold}thingsctl project${colors.reset} - Show tasks in a project

${colors.bold}Usage:${colors.reset}
  thingsctl project <name> [options]

${colors.bold}Arguments:${colors.reset}
  <name>    Project name or UUID (partial match supported)

${colors.bold}Options:${colors.reset}
  --json    Output as JSON

${colors.bold}Examples:${colors.reset}
  thingsctl project "Website"
  thingsctl project LinkedIn --json
`
  };

  if (helps[command]) {
    console.log(helps[command]);
    return true;
  }
  return false;
}

function printHelp() {
  console.log(`
${colors.bold}thingsctl - Things 3 CLI${colors.reset}

${colors.bold}Usage:${colors.reset}
  thingsctl <command> [args] [options]

${colors.bold}List Commands:${colors.reset}
  ${colors.cyan}today${colors.reset}              Show Today's tasks
  ${colors.cyan}anytime${colors.reset}            Show Anytime tasks
  ${colors.cyan}someday${colors.reset}            Show Someday tasks
  ${colors.cyan}inbox${colors.reset}              Show Inbox tasks
  ${colors.cyan}upcoming${colors.reset}           Show scheduled tasks
  ${colors.cyan}due${colors.reset}                Show tasks with deadlines
  ${colors.cyan}repeating${colors.reset}          Show repeating tasks
  ${colors.cyan}projects${colors.reset}           List all projects
  ${colors.cyan}project${colors.reset} <name>     Show tasks in a project
  ${colors.cyan}areas${colors.reset}              List all areas
  ${colors.cyan}tags${colors.reset}               List all tags
  ${colors.cyan}search${colors.reset} <query>     Search tasks
  ${colors.cyan}show${colors.reset} <id>          Show task details
  ${colors.cyan}logbook${colors.reset}            Show completed tasks
  ${colors.cyan}stats${colors.reset}              Show statistics
  
${colors.bold}Action Commands:${colors.reset}
  ${colors.cyan}add${colors.reset} <title>        Add a new task
  ${colors.cyan}update${colors.reset} <id>        Update a task
  ${colors.cyan}complete${colors.reset} <id...>   Complete task(s) (bulk supported)
  ${colors.cyan}move${colors.reset} <id>          Move task to a list
  ${colors.cyan}tag${colors.reset} <id>           Manage task tags
  ${colors.cyan}export${colors.reset} <source>    Export tasks (md, csv, json)

${colors.bold}Global Options:${colors.reset}
  --json             Output as JSON
  --verbose, -v      Show more details
  --compact          Single-line output format
  --ids              Output only UUIDs (for scripting)
  --limit <n>        Limit results (for logbook)

${colors.bold}Filter Options:${colors.reset} (for list commands)
  --tag <name>       Filter by tag
  --area <name>      Filter by area  
  --project <name>   Filter by project

${colors.bold}Add Options:${colors.reset}
  --notes <text>     Add notes
  --when <date>      Schedule date (today, tomorrow, anytime, someday, YYYY-MM-DD)
  --deadline <date>  Set deadline (YYYY-MM-DD)
  --tags <tags>      Add tags (comma-separated)
  --checklist <items> Checklist items (comma-separated)
  --list <list>      Target list (inbox, anytime, someday)
  --project <name>   Add to project (partial match)
  --area <name>      Add to area (partial match)
  --heading <name>   Add under heading in project

${colors.bold}Update Options:${colors.reset}
  --title <text>     Change title
  --notes <text>     Replace notes
  --append-notes <text>  Append to notes
  --prepend-notes <text> Prepend to notes
  --when <date>      Change schedule date
  --deadline <date>  Change deadline
  --add-tags <tags>  Add tags (comma-separated)

${colors.bold}Move Options:${colors.reset}
  --to <list>        Target: today, anytime, someday, or date

${colors.bold}Tag Options:${colors.reset}
  --add <tag>        Add a tag
  --remove <tag>     Remove a tag

${colors.bold}Export Options:${colors.reset}
  --format <fmt>     Output format: md, csv, json (default: md)

${colors.bold}Examples:${colors.reset}
  thingsctl today
  thingsctl today --tag Deep            # Filter Today by tag
  thingsctl anytime --area Finance      # Filter Anytime by area
  thingsctl someday --compact           # Compact output
  thingsctl today --ids                 # Just UUIDs for scripting
  
  thingsctl add "Call mom" --when today --tags Phone
  thingsctl add "Trip prep" --checklist "Passport,Tickets,Charger"
  
  thingsctl update 7Ae --title "New title"
  thingsctl update 7Ae --append-notes "Added context"
  thingsctl update 7Ae --when tomorrow --deadline 2026-03-15
  
  thingsctl complete 7Ae                # Single task
  thingsctl complete 17jJ ANsB 9pUS     # Bulk complete
  
  thingsctl export today --format md
  thingsctl export project "CoStudy" --format csv
`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  // Version flag
  if (args[0] === '--version' || args[0] === '-V') {
    const pkg = require('./package.json');
    console.log(`thingsctl v${pkg.version}`);
    process.exit(0);
  }
  
  // Global help
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }
  
  const parsed = parseArgs(args);
  
  // Command-specific help (e.g., "thingsctl add --help")
  if (parsed.options.help || parsed.options.h) {
    if (printCommandHelp(parsed.command)) {
      process.exit(0);
    } else {
      printHelp();
      process.exit(0);
    }
  }
  const cli = new ThingsCLI();
  
  try {
    let result;
    const opts = {
      json: parsed.options.json || false,
      verbose: parsed.options.verbose || parsed.options.v || false,
      limit: parsed.options.limit ? parseInt(parsed.options.limit) : undefined,
      // Output formatting options
      compact: parsed.options.compact || false,
      ids: parsed.options.ids || false,
      // Filter options
      tag: parsed.options.tag,
      area: parsed.options.area,
      project: parsed.options.project
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
      case 'due':
        result = cli.due(opts);
        break;
      case 'repeating':
        result = cli.repeating(opts);
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
          list: parsed.options.list,
          project: parsed.options.project,
          area: parsed.options.area,
          heading: parsed.options.heading,
          checklist: parsed.options.checklist
        });
        break;
      case 'complete':
        if (!parsed.args[0]) {
          throw new Error('Task ID(s) required');
        }
        // Support bulk completion: thingsctl complete id1 id2 id3
        result = cli.complete(parsed.args.length > 1 ? parsed.args : parsed.args[0]);
        break;
      case 'update':
        if (!parsed.args[0]) {
          throw new Error('Task ID required');
        }
        result = cli.update(parsed.args[0], {
          title: parsed.options.title,
          notes: parsed.options.notes,
          'append-notes': parsed.options['append-notes'],
          'prepend-notes': parsed.options['prepend-notes'],
          when: parsed.options.when,
          deadline: parsed.options.deadline,
          'add-tags': parsed.options['add-tags'],
          completed: parsed.options.completed,
          canceled: parsed.options.canceled
        });
        break;
      case 'export':
        if (!parsed.args[0]) {
          throw new Error('Export source required (today, anytime, someday, inbox, project, area)');
        }
        result = cli.export(parsed.args[0], {
          format: parsed.options.format || 'md',
          name: parsed.args[1] // For project/area name
        });
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
