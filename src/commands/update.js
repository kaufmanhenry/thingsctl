'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl, buildUpdateProjectUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');

function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });
  const task = queries.getTask(database, ref.uuid);

  const params = { id: task.uuid, 'auth-token': getToken() };
  const changes = [];

  if (opts.title) { params.title = opts.title; changes.push(`title → "${opts.title}"`); }
  if (opts.notes) { params.notes = opts.notes; changes.push('notes updated'); }
  if (opts['append-notes']) {
    params.notes = task.notes ? `${task.notes}\n\n${opts['append-notes']}` : opts['append-notes'];
    changes.push('notes appended');
  }
  if (opts['prepend-notes']) {
    params.notes = task.notes ? `${opts['prepend-notes']}\n\n${task.notes}` : opts['prepend-notes'];
    changes.push('notes prepended');
  }
  if (opts.when) { params.when = opts.when; changes.push(`when → ${opts.when}`); }
  if (opts.deadline) { params.deadline = opts.deadline; changes.push(`deadline → ${opts.deadline}`); }
  if (opts['add-tags']) { params['add-tags'] = opts['add-tags']; changes.push(`tags += ${opts['add-tags']}`); }
  if (opts.completed !== undefined) {
    params.completed = opts.completed ? 'true' : 'false';
    changes.push(opts.completed ? 'completed' : 'reopened');
  }
  if (opts.canceled !== undefined) {
    params.canceled = opts.canceled ? 'true' : 'false';
    changes.push(opts.canceled ? 'canceled' : 'uncanceled');
  }

  if (changes.length === 0) throw new Error('No changes specified');

  // type 1 = project; Things ignores `update` on projects, so route to `update-project`.
  const isProject = ref.type === 1;
  openUrl(isProject ? buildUpdateProjectUrl(params) : buildUpdateUrl(params));
  const label = isProject ? 'project ' : '';
  return `${colors.green('✓')} Updated ${label}"${task.title}": ${changes.join(', ')}`;
}

module.exports = {
  run,
  mcp: {
    name: 'things_update',
    description: 'Update fields on an existing task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        notes: { type: 'string' },
        'append-notes': { type: 'string' },
        'prepend-notes': { type: 'string' },
        when: { type: 'string' },
        deadline: { type: 'string' },
        'add-tags': { type: 'string' },
        completed: { type: 'boolean' },
        canceled: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id, ...rest }) => ({ ok: true, message: run(id, rest) }),
  },
};
