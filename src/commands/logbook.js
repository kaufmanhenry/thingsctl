'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { colors, taskToJson } = require('../lib/format');
const { cocoaToDate, daysAgoUnix, unixToCocoa } = require('../lib/dates');

function _line(t) {
  let line = `✓ ${t.title}`;
  const d = cocoaToDate(t.stopDate);
  if (d) {
    const s = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    line += ` ${colors.dim('(' + s + ')')}`;
  }
  return line;
}

function run(opts = {}) {
  let sinceCocoa;
  if (opts.since != null) {
    const days = parseInt(opts.since, 10);
    if (!Number.isNaN(days)) sinceCocoa = unixToCocoa(daysAgoUnix(days));
  }
  const limit = opts.limit ? parseInt(opts.limit, 10) : 20;
  const tasks = queries.logbookTasks(db.open(), { limit, sinceCocoa });
  if (opts.json) {
    return tasks.map((t) => ({
      ...taskToJson(t),
      completedAt: cocoaToDate(t.stopDate)?.toISOString() ?? null,
    }));
  }
  if (opts.ids) return tasks.map((t) => t.uuid);
  return tasks.map(_line);
}

module.exports = {
  run,
  mcp: {
    name: 'things_logbook',
    description: 'List recently completed tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows when --since is not set' },
        since: { type: 'number', description: 'Days back from today (overrides limit)' },
      },
      additionalProperties: false,
    },
    handler: (args) => run({ ...args, json: true }),
  },
};
