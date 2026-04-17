'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const csv = require('../lib/csv');
const { taskToJson } = require('../lib/format');
const { formatShortDate } = require('../lib/dates');
const { STATUS } = require('../lib/constants');

function _gather(database, source, opts) {
  switch (source) {
    case 'today':    return { tasks: queries.todayTasks(database), title: 'Today' };
    case 'anytime':  return { tasks: queries.anytimeTasks(database), title: 'Anytime' };
    case 'someday':  return { tasks: queries.somedayTasks(database), title: 'Someday' };
    case 'inbox':    return { tasks: queries.inboxTasks(database), title: 'Inbox' };
    case 'upcoming': return { tasks: queries.upcomingTasks(database), title: 'Upcoming' };
    case 'evening':  return { tasks: queries.eveningTasks(database), title: 'Evening' };
    case 'overdue':  return { tasks: queries.overdueTasks(database), title: 'Overdue' };
    case 'project': {
      if (!opts.name) throw new Error('Project name required');
      const project = queries.findProject(database, opts.name);
      if (!project) throw new Error(`Project not found: ${opts.name}`);
      return { tasks: queries.projectTasks(database, project.uuid), title: project.title };
    }
    case 'area': {
      if (!opts.name) throw new Error('Area name required');
      const area = queries.findArea(database, opts.name);
      if (!area) throw new Error(`Area not found: ${opts.name}`);
      return { tasks: queries.areaTasks(database, area.uuid), title: area.title };
    }
    default:
      throw new Error(`Unknown export source: ${source}. Use: today, anytime, someday, inbox, upcoming, evening, overdue, project, area`);
  }
}

function _markdown(database, tasks, title) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`*Exported: ${new Date().toLocaleDateString()}*`);
  lines.push('');
  for (const t of tasks) {
    const check = t.status === STATUS.COMPLETED ? '[x]' : '[ ]';
    let line = `- ${check} ${t.title}`;
    const tags = t.tagList ? t.tagList.split(',').filter(Boolean) : [];
    if (tags.length) line += ` #${tags.join(' #')}`;
    const deadline = formatShortDate(t.deadline);
    if (deadline) line += ` 📅 ${deadline}`;
    lines.push(line);
    if (t.notes) {
      for (const noteLine of t.notes.split('\n')) lines.push(`    ${noteLine}`);
    }
    for (const item of queries.getChecklist(database, t.uuid)) {
      const c = item.status === 3 ? '[x]' : '[ ]';
      lines.push(`    - ${c} ${item.title}`);
    }
  }
  return lines.join('\n');
}

function _csv(tasks) {
  const rows = [['uuid', 'title', 'status', 'tags', 'project', 'area', 'deadline', 'notes']];
  for (const t of tasks) {
    const status = t.status === STATUS.COMPLETED ? 'completed'
      : t.status === STATUS.CANCELED ? 'canceled' : 'open';
    const tags = (t.tagList || '').split(',').filter(Boolean).join(';');
    const deadline = t.deadline >= 1000000000
      ? new Date(t.deadline * 1000).toISOString().split('T')[0] : '';
    rows.push([t.uuid, t.title, status, tags, t.projectName || '', t.areaName || '', deadline, t.notes || '']);
  }
  return csv.format(rows);
}

function run(source, opts = {}) {
  if (!source) throw new Error('Export source required');
  const database = db.open();
  const { tasks, title } = _gather(database, source, opts);
  const format = opts.format || 'md';
  if (format === 'md' || format === 'markdown') return _markdown(database, tasks, title);
  if (format === 'csv') return _csv(tasks);
  if (format === 'json') return JSON.stringify(tasks.map(taskToJson), null, 2);
  throw new Error(`Unknown format: ${format}. Use: md, csv, json`);
}

module.exports = {
  run,
  mcp: {
    name: 'things_export',
    description: 'Export a list as md/csv/json string.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['today', 'anytime', 'someday', 'inbox', 'upcoming', 'evening', 'overdue', 'project', 'area'] },
        name: { type: 'string', description: 'Required for project/area' },
        format: { type: 'string', enum: ['md', 'csv', 'json'], default: 'md' },
      },
      required: ['source'],
      additionalProperties: false,
    },
    handler: ({ source, name, format }) => ({ format: format || 'md', content: run(source, { name, format }) }),
  },
};
