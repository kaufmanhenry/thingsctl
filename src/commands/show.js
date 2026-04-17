'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { resolveTaskId } = require('../lib/uuid');
const { colors, taskToJson } = require('../lib/format');
const { formatShortDate } = require('../lib/dates');
const { STATUS, START } = require('../lib/constants');

function _details(database, task) {
  const lines = [];
  lines.push(`${colors.bold(task.title)}`);
  lines.push(`${colors.dim('UUID: ' + task.uuid)}`);
  lines.push('');
  const status = task.status === STATUS.COMPLETED ? 'Completed'
    : task.status === STATUS.CANCELED ? 'Canceled' : 'Open';
  lines.push(`Status: ${status}`);
  const list = task.start === START.INBOX ? 'Inbox'
    : task.start === START.ANYTIME ? 'Anytime' : 'Someday';
  lines.push(`List: ${list}`);
  if (task.todayIndex > 0) lines.push(`${colors.yellow('★ In Today')}`);
  if (task.startBucket === 1) lines.push(`${colors.blue('🌙 This evening')}`);
  if (task.projectName) lines.push(`Project: ${task.projectName}`);
  if (task.areaName) lines.push(`Area: ${task.areaName}`);
  const tags = task.tagList ? task.tagList.split(',').filter(Boolean) : [];
  if (tags.length) lines.push(`Tags: ${tags.join(', ')}`);
  const scheduled = formatShortDate(task.startDate);
  if (scheduled) lines.push(`Scheduled: ${scheduled}`);
  const deadline = formatShortDate(task.deadline);
  if (deadline) lines.push(`Deadline: ${deadline}`);
  if (task.notes) {
    lines.push('');
    lines.push(`${colors.dim('Notes:')}`);
    lines.push(task.notes);
  }
  const checklist = queries.getChecklist(database, task.uuid);
  if (checklist.length) {
    lines.push('');
    lines.push(`${colors.dim('Checklist:')}`);
    for (const item of checklist) {
      lines.push(`  ${item.status === 3 ? '✓' : '☐'} ${item.title}`);
    }
  }
  return lines;
}

function run(id, opts = {}) {
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });
  const task = queries.getTask(database, ref.uuid);
  if (opts.json) {
    return {
      ...taskToJson(task),
      checklist: queries.getChecklist(database, task.uuid).map((c) => ({
        title: c.title, completed: c.status === 3,
      })),
    };
  }
  return _details(database, task);
}

module.exports = {
  run,
  mcp: {
    name: 'things_show',
    description: 'Show full details for one task by UUID prefix.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task UUID prefix (long enough to be unique)' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id }) => run(id, { json: true }),
  },
};
