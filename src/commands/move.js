'use strict';

const db = require('../lib/db');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');

function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  if (!opts.to) throw new Error('--to option required');
  if (opts.to === 'inbox') throw new Error('Moving to inbox is not supported via the Things URL scheme');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });
  openUrl(buildUpdateUrl({ id: ref.uuid, when: opts.to, 'auth-token': getToken() }));
  return `Moved "${ref.title}" to ${opts.to}`;
}

module.exports = {
  run,
  mcp: {
    name: 'things_move',
    description: 'Reschedule a task by moving it to today/anytime/someday/evening or a specific date.',
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
