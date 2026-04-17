'use strict';

const db = require('../lib/db');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');

function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });

  if (opts.add) {
    openUrl(buildUpdateUrl({ id: ref.uuid, 'add-tags': opts.add, 'auth-token': getToken() }));
    return `Added tag "${opts.add}" to "${ref.title}"`;
  }
  if (opts.remove) {
    throw new Error('Removing tags is not supported by the Things URL scheme (it would replace all tags).');
  }
  throw new Error('Specify --add <tag>');
}

module.exports = {
  run,
  mcp: {
    name: 'things_tag',
    description: 'Add a tag to a task. Tags must already exist in Things.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, add: { type: 'string' } },
      required: ['id', 'add'],
      additionalProperties: false,
    },
    handler: ({ id, add }) => ({ ok: true, message: run(id, { add }) }),
  },
};
