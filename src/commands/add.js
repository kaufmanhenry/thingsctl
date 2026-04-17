'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { buildAddUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');

function _build(database, title, opts) {
  const params = { title, 'auth-token': getToken() };
  if (opts.notes) params.notes = opts.notes;
  if (opts.when) params.when = opts.when;
  if (opts.deadline) params.deadline = opts.deadline;
  if (opts.tags) params.tags = opts.tags;
  if (opts.checklist) {
    const items = opts.checklist.split(',').map((s) => s.trim()).filter(Boolean).join('\n');
    params['checklist-items'] = items;
  }
  if (opts.list) params.list = opts.list;
  if (opts.project) {
    const proj = queries.findProject(database, opts.project);
    if (!proj) throw new Error(`Project not found: ${opts.project}`);
    params.list = proj.title;
  }
  if (opts.area) {
    const area = queries.findArea(database, opts.area);
    if (!area) throw new Error(`Area not found: ${opts.area}`);
    params['list-id'] = area.uuid;
  }
  if (opts.heading) params.heading = opts.heading;
  return params;
}

function run(title, opts = {}) {
  if (!title) throw new Error('Task title required');
  const database = db.open();
  const params = _build(database, title, opts);
  openUrl(buildAddUrl(params));

  let result = `${colors.green('✓')} Added: ${title}`;
  if (opts.checklist) {
    const count = opts.checklist.split(',').filter(Boolean).length;
    result += ` (${count} checklist items)`;
  }
  if (opts.project) result += ` → ${opts.project}`;
  if (opts.area) result += ` (${opts.area})`;
  if (opts.when) result += ` [${opts.when}]`;
  return result;
}

module.exports = {
  run,
  mcp: {
    name: 'things_add',
    description: 'Create a new task. Tags must already exist in Things.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        notes: { type: 'string' },
        when: { type: 'string', description: 'today | tomorrow | evening | anytime | someday | YYYY-MM-DD | "next week"' },
        deadline: { type: 'string', description: 'YYYY-MM-DD' },
        tags: { type: 'string', description: 'Comma-separated' },
        checklist: { type: 'string', description: 'Comma-separated checklist items' },
        list: { type: 'string', enum: ['inbox', 'anytime', 'someday'] },
        project: { type: 'string' },
        area: { type: 'string' },
        heading: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    handler: ({ title, ...rest }) => ({ ok: true, message: run(title, rest) }),
  },
};
