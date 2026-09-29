'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl, buildUpdateProjectUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { TYPE, STATUS } = require('../lib/constants');
const { waitForWrite, snapshot, modifiedSince, notApplied } = require('../lib/verify');

// The CLI parser hands flag values through as strings, so `--completed false`
// arrives as the STRING 'false', which is truthy. Left uncoerced that sends
// completed=true and COMPLETES the task the flag was meant to reopen.
function asBool(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no') return false;
  return true;
}

// Resolve a project or area TITLE to its uuid so the re-parent can be verified
// against the row rather than trusting "something changed".
function _resolveListTarget(database, title) {
  const proj = database
    .prepare('SELECT uuid FROM TMTask WHERE type = ? AND trashed = 0 AND title = ? LIMIT 2')
    .all(TYPE.PROJECT, title);
  if (proj.length === 1) return { field: 'project', uuid: proj[0].uuid };
  const area = database
    .prepare('SELECT uuid FROM TMArea WHERE title = ? LIMIT 2')
    .all(title);
  if (area.length === 1) return { field: 'area', uuid: area[0].uuid };
  return null;
}

function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });
  const task = queries.getTask(database, ref.uuid);
  const isProject = ref.type === TYPE.PROJECT;

  if (ref.type === TYPE.HEADING) {
    throw new Error(`"${ref.title}" is a heading. Things has no update command for headings.`);
  }

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

  const completed = asBool(opts.completed);
  const canceled = asBool(opts.canceled);

  const params = { id: task.uuid, 'auth-token': getToken() };
  const changes = [];
  let reparent = null; // { field, uuid } when we can verify the move exactly

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

  // Re-parenting. The -id forms take precedence over the title forms, matching
  // the Things URL scheme.
  if (opts['list-id']) {
    params['list-id'] = opts['list-id'];
    changes.push(`moved into ${opts['list-id']}`);
    reparent = { field: null, uuid: opts['list-id'] }; // project OR area column
  } else if (opts.list) {
    params.list = opts.list;
    changes.push(`moved into "${opts.list}"`);
    reparent = _resolveListTarget(database, opts.list);
  }
  if (opts['area-id']) {
    params['area-id'] = opts['area-id'];
    changes.push(`moved into area ${opts['area-id']}`);
    reparent = { field: 'area', uuid: opts['area-id'] };
  } else if (opts.area) {
    params.area = opts.area;
    changes.push(`moved into area "${opts.area}"`);
    const found = database.prepare('SELECT uuid FROM TMArea WHERE title = ? LIMIT 2').all(opts.area);
    reparent = found.length === 1 ? { field: 'area', uuid: found[0].uuid } : null;
  }

  if (completed !== undefined) {
    params.completed = completed ? 'true' : 'false';
    changes.push(completed ? 'completed' : 'reopened');
  }
  if (canceled !== undefined) {
    params.canceled = canceled ? 'true' : 'false';
    changes.push(canceled ? 'canceled' : 'uncanceled');
  }

  if (changes.length === 0) throw new Error('No changes specified');

  const before = snapshot(task.uuid);
  openUrl(isProject ? buildUpdateProjectUrl(params) : buildUpdateUrl(params));

  // Assert the end state wherever we know it. modifiedSince is the weak
  // fallback: it cannot tell our write apart from a concurrent edit or a sync.
  let predicate = modifiedSince(before);
  if (canceled === true) predicate = (r) => r.status === STATUS.CANCELED;
  else if (completed === true) predicate = (r) => r.status === STATUS.COMPLETED;
  else if (completed === false || canceled === false) predicate = (r) => r.status === STATUS.OPEN;
  else if (reparent) {
    const want = reparent.uuid;
    predicate = reparent.field
      ? (r) => r[reparent.field] === want
      : (r) => r.project === want || r.area === want;
  }

  const { ok } = waitForWrite(task.uuid, predicate);
  if (!ok) return notApplied('apply the change to', task.title);

  const label = isProject ? 'project ' : '';
  return `${colors.green('✓')} Updated ${label}"${task.title}": ${changes.join(', ')}`;
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
    // Whitelist rather than spreading rest: the low-level MCP Server does not
    // enforce inputSchema, so additionalProperties:false buys nothing at runtime.
    handler: (a = {}) =>
      ({ ok: true, message: run(a.id, {
        title: a.title, notes: a.notes,
        'append-notes': a['append-notes'], 'prepend-notes': a['prepend-notes'],
        when: a.when, deadline: a.deadline, 'add-tags': a['add-tags'],
        list: a.list, 'list-id': a['list-id'], area: a.area, 'area-id': a['area-id'],
        completed: a.completed, canceled: a.canceled,
      }) }),
  },
};
