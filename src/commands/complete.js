'use strict';

const db = require('../lib/db');
const { resolveMany } = require('../lib/uuid');
const { buildUpdateUrl, buildUpdateProjectUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { STATUS, TYPE } = require('../lib/constants');
const { waitForWrite, notApplied, DEFAULT_TIMEOUT_MS } = require('../lib/verify');
const queries = require('../lib/queries');

function run(ids, opts = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  const database = db.open();
  const { resolved, errors } = resolveMany(database, list, { yesFirst: opts['yes-first'] });
  const out = [];
  // One slow id should not make the whole batch slow. If Things did not take
  // write #1 it is not taking #7 either, so drop to a short probe after the
  // first timeout instead of burning the full budget per item.
  let budgetMs = DEFAULT_TIMEOUT_MS;

  for (const { error, input } of errors) {
    out.push(`${colors.red('✗')} ${error.code === 'E_AMBIGUOUS' ? error.message : `Not found: ${input}`}`);
  }

  for (const { task } of resolved) {
    const full = queries.getTask(database, task.uuid);
    if (full && full.status === STATUS.COMPLETED) {
      out.push(`${colors.dim('Already completed: ' + full.title)}`);
      continue;
    }
    if (task.type === TYPE.HEADING) {
      out.push(`${colors.red('✗')} Cannot complete a heading: ${task.title}`);
      continue;
    }

    // Projects are only reachable through `update-project`. Sending them to
    // `update` is a silent no-op — the bug this dispatch exists to prevent.
    const isProject = task.type === TYPE.PROJECT;
    const params = { id: task.uuid, completed: 'true', 'auth-token': getToken() };
    const url = isProject ? buildUpdateProjectUrl(params) : buildUpdateUrl(params);
    const label = isProject ? 'project' : 'task';

    try {
      openUrl(url);
    } catch (e) {
      // e.message carries the redacted url; keep it out of per-item output anyway.
      out.push(`${colors.red('✗')} Failed: ${task.title} (could not reach Things)`);
      continue;
    }

    const { ok } = waitForWrite(task.uuid, (r) => r.status === STATUS.COMPLETED, { timeoutMs: budgetMs });
    if (!ok) budgetMs = 250;
    out.push(
      ok
        ? `${colors.green('✓')} Completed ${label}: ${task.title}`
        : notApplied(`complete the ${label}`, task.title)
    );
  }
  return list.length === 1 ? out[0] : out;
}

module.exports = {
  run,
  mcp: {
    name: 'things_complete',
    description: 'Mark one or more tasks or projects as complete. Verified against the database before reporting success.',
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
