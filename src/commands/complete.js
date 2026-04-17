'use strict';

const db = require('../lib/db');
const { resolveMany } = require('../lib/uuid');
const { buildUpdateUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { STATUS } = require('../lib/constants');
const queries = require('../lib/queries');

function run(ids, opts = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  const database = db.open();
  const { resolved, errors } = resolveMany(database, list, { yesFirst: opts['yes-first'] });
  const out = [];

  for (const { error, input } of errors) {
    out.push(`${colors.red('✗')} ${error.code === 'E_AMBIGUOUS' ? error.message : `Not found: ${input}`}`);
  }

  for (const { task } of resolved) {
    const full = queries.getTask(database, task.uuid);
    if (full && full.status === STATUS.COMPLETED) {
      out.push(`${colors.dim('Already completed: ' + full.title)}`);
      continue;
    }
    try {
      openUrl(buildUpdateUrl({ id: task.uuid, completed: 'true', 'auth-token': getToken() }));
      out.push(`${colors.green('✓')} Completed: ${task.title}`);
    } catch (e) {
      out.push(`${colors.red('✗')} Failed: ${task.title} (${e.message})`);
    }
  }
  return list.length === 1 ? out[0] : out;
}

module.exports = {
  run,
  mcp: {
    name: 'things_complete',
    description: 'Mark one or more tasks as complete.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
        'yes-first': { type: 'boolean', description: 'Auto-pick first match on ambiguous prefixes' },
      },
      required: ['ids'],
      additionalProperties: false,
    },
    handler: ({ ids, 'yes-first': yf }) => ({ ok: true, results: [].concat(run(ids, { 'yes-first': yf })) }),
  },
};
