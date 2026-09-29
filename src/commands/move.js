'use strict';

const db = require('../lib/db');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl, buildUpdateProjectUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { TYPE } = require('../lib/constants');
const { waitForWrite, snapshot, modifiedSince, notApplied } = require('../lib/verify');

// NOTE: this command RESCHEDULES. It does not change which project or area a
// task belongs to — that is `update --list` / `update --area`. The name is
// historical; the description says so plainly so callers stop guessing.
function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  if (!opts.to) throw new Error('--to option required');
  if (opts.to === 'inbox') throw new Error('Moving to inbox is not supported via the Things URL scheme');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });
  if (ref.type === TYPE.HEADING) {
    throw new Error(`"${ref.title}" is a heading. Headings cannot be scheduled.`);
  }

  const params = { id: ref.uuid, when: opts.to, 'auth-token': getToken() };
  const before = snapshot(ref.uuid);
  openUrl(ref.type === TYPE.PROJECT ? buildUpdateProjectUrl(params) : buildUpdateUrl(params));

  const { ok } = waitForWrite(ref.uuid, modifiedSince(before));
  if (!ok) return notApplied('reschedule', ref.title);
  return `Rescheduled "${ref.title}" to ${opts.to}`;
}

module.exports = {
  run,
  mcp: {
    name: 'things_move',
    description:
      'RESCHEDULE a to-do or project to today/anytime/someday/evening or a specific date. ' +
      'This does NOT change which project or area it belongs to — use things_update with ' +
      'list/list-id (to-dos) or area/area-id (projects) for that.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        to: { type: 'string', description: 'today | tomorrow | evening | anytime | someday | YYYY-MM-DD | "next week"' },
      },
      required: ['id', 'to'],
      additionalProperties: false,
    },
    handler: ({ id, to }) => ({ ok: true, message: run(id, { to }) }),
  },
};
