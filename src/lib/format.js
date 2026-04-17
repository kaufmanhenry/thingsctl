'use strict';

const { STATUS, START } = require('./constants');
const { formatShortDate } = require('./dates');

// TTY-aware coloring. Disabled if NO_COLOR is set or stdout is not a TTY.
const _colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;

function _wrap(code) {
  return _colorEnabled ? (s) => `\x1b[${code}m${s}\x1b[0m` : (s) => String(s);
}

const colors = {
  reset: _colorEnabled ? '\x1b[0m' : '',
  dim: _wrap(2),
  bold: _wrap(1),
  yellow: _wrap(33),
  blue: _wrap(34),
  green: _wrap(32),
  cyan: _wrap(36),
  magenta: _wrap(35),
  red: _wrap(31),
};

function statusGlyph(status) {
  if (status === STATUS.COMPLETED) return '✓';
  if (status === STATUS.CANCELED) return '✗';
  return '☐';
}

function listName(start) {
  if (start === START.INBOX) return 'inbox';
  if (start === START.ANYTIME) return 'anytime';
  return 'someday';
}

// Render a task row enriched by queries.js (tagList, projectName, areaName).
function formatTask(task, opts = {}) {
  const { verbose = false, showScheduled = true } = opts;
  let line = `${statusGlyph(task.status)} ${task.title}`;

  const tags = task.tagList
    ? task.tagList.split(',').filter(Boolean).sort()
    : (task._tags || []);
  if (tags.length > 0) {
    line += ` ${colors.cyan('#' + tags.join(' #'))}`;
  }

  if (verbose) {
    if (task.projectName) line += ` ${colors.dim('[' + task.projectName + ']')}`;
    else if (task.areaName) line += ` ${colors.dim('[' + task.areaName + ']')}`;
  }

  const deadline = formatShortDate(task.deadline);
  if (deadline) line += ` ${colors.yellow('📅 ' + deadline)}`;

  if (showScheduled) {
    const scheduled = formatShortDate(task.startDate);
    if (scheduled && task.startDate >= 1000000000) {
      // Only show the arrow when the scheduled date is in the future.
      const todayEnd = new Date(new Date().setHours(24, 0, 0, 0)).getTime() / 1000;
      if (task.startDate >= todayEnd) {
        line += ` ${colors.blue('→ ' + scheduled)}`;
      }
    }
  }

  return line;
}

// Render a task as a plain JSON-ready object.
function taskToJson(task) {
  const { unixToDate } = require('./dates');
  return {
    uuid: task.uuid,
    title: task.title,
    notes: task.notes || null,
    status:
      task.status === STATUS.COMPLETED
        ? 'completed'
        : task.status === STATUS.CANCELED
        ? 'canceled'
        : 'open',
    startDate: task.startDate >= 1000000000 ? unixToDate(task.startDate).toISOString() : null,
    deadline: task.deadline >= 1000000000 ? unixToDate(task.deadline).toISOString() : null,
    tags: task.tagList ? task.tagList.split(',').filter(Boolean).sort() : (task._tags || []),
    project: task.projectName || null,
    area: task.areaName || null,
    inToday: task.todayIndex > 0,
    list: listName(task.start),
    evening: task.startBucket === 1,
  };
}

function compactLine(task) {
  return `${statusGlyph(task.status)} ${task.uuid.slice(0, 4)} ${task.title}`;
}

function emptyMessage() {
  return colors.dim('No tasks found');
}

module.exports = { colors, statusGlyph, formatTask, taskToJson, compactLine, listName, emptyMessage };
