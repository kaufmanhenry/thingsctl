'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl, buildUpdateProjectUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { TYPE, STATUS } = require('../lib/constants');
const { waitForWrite, snapshot, modifiedSince } = require('../lib/verify');

function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });
  const task = queries.getTask(database, ref.uuid);
  const isProject = ref.type === TYPE.PROJECT;

  // `list`/`list-id` exist only on `update`; `area`/`area-id` only on
  // `update-project`. Passing the wrong one is dropped silently by Things, so
  // refuse it here rather than report a move that never happened.
  if (isProject && (opts.list || opts['list-id'])) {
    throw new Error(
      `"${task.title}" is a project. Use --area/--area-id to move it into an area; ` +
        '--list/--list-id only applies to to-dos.'
    );
  }
  if (!isProject && (opts.area || opts['area-id'])) {
    throw new Error(
      `"${task.title}" is a to-do. Use --list/--list-id to move it into a project or area; ` +
        '--area/--area-id only applies to projects.'
    );
  }

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

  // Re-parenting. list-id takes precedence over list, area-id over area.
  if (opts['list-id']) { params['list-id'] = opts['list-id']; changes.push(`moved into ${opts['list-id']}`); }
  else if (opts.list) { params.list = opts.list; changes.push(`moved into "${opts.list}"`); }
  if (opts['area-id']) { params['area-id'] = opts['area-id']; changes.push(`moved into area ${opts['area-id']}`); }
  else if (opts.area) { params.area = opts.area; changes.push(`moved into area "${opts.area}"`); }

  if (opts.completed !== undefined) {
    params.completed = opts.completed ? 'true' : 'false';
    changes.push(opts.completed ? 'completed' : 'reopened');
  }
  if (opts.canceled !== undefined) {
    params.canceled = opts.canceled ? 'true' : 'false';
    changes.push(opts.canceled ? 'canceled' : 'uncanceled');
  }

  if (changes.length === 0) throw new Error('No changes specified');

  const before = snapshot(task.uuid);
  openUrl(isProject ? buildUpdateProjectUrl(params) : buildUpdateUrl(params));

  // Assert the end state where we know it; fall back to "something changed".
  let predicate = modifiedSince(before);
  if (opts.canceled === true) predicate = (r) => r.status === STATUS.CANCELED;
  else if (opts.completed === true) predicate = (r) => r.status === STATUS.COMPLETED;
  else if (opts.completed === false || opts.canceled === false) predicate = (r) => r.status === STATUS.OPEN;

  const { ok } = waitForWrite(task.uuid, predicate);
  if (!ok) {
    return `${colors.red('✗')} Things did not apply the change to "${task.title}" ` +
      `(the URL was accepted but the database never changed)`;
  }
  return `${colors.green('✓')} Updated "${task.title}": ${changes.join(', ')}`;
}

module.exports = {
  run,
  mcp: {
    name: 'things_update',
    description:
      'Update fields on an existing to-do or project, including moving it to a different ' +
      'project or area. Verified against the database before reporting success.',
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
        list: { type: 'string', description: 'TO-DOS ONLY. Title of a project or area to move the to-do into.' },
        'list-id': { type: 'string', description: 'TO-DOS ONLY. UUID of a project or area to move the to-do into. Takes precedence over list.' },
        area: { type: 'string', description: 'PROJECTS ONLY. Title of an area to move the project into.' },
        'area-id': { type: 'string', description: 'PROJECTS ONLY. UUID of an area to move the project into. Takes precedence over area.' },
        completed: { type: 'boolean' },
        canceled: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id, ...rest }) => ({ ok: true, message: run(id, rest) }),
  },
};
