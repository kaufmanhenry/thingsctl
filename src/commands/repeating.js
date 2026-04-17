'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { colors } = require('../lib/format');
const { taskToJson } = require('../lib/format');
const { decodeRecurrenceRule, describe } = require('../lib/rrule');
const { formatShortDate, unixToDate } = require('../lib/dates');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function _line(t, decode) {
  let line = `🔄 ${t.title}`;
  if (decode) {
    const rule = decodeRecurrenceRule(t.rt1_recurrenceRule);
    line += ` ${colors.dim('(' + describe(rule) + ')')}`;
  }
  if (t.rt1_nextInstanceStartDate >= 1000000000) {
    const next = formatShortDate(t.rt1_nextInstanceStartDate);
    if (next) line += ` ${colors.blue('next ' + next)}`;
  }
  const tags = t.tagList ? t.tagList.split(',').filter(Boolean) : [];
  if (tags.length) line += ` ${colors.cyan('#' + tags.join(' #'))}`;
  return line;
}

function run(opts = {}) {
  const tasks = queries.repeatingTasks(db.open(), pickFilters(opts));
  if (opts.json) {
    return tasks.map((t) => ({
      ...taskToJson(t),
      recurrence: decodeRecurrenceRule(t.rt1_recurrenceRule),
      nextInstance: t.rt1_nextInstanceStartDate >= 1000000000
        ? unixToDate(t.rt1_nextInstanceStartDate).toISOString() : null,
    }));
  }
  if (opts.ids) return tasks.map((t) => t.uuid);
  return tasks.map((t) => _line(t, opts.decode));
}

module.exports = {
  run,
  mcp: {
    name: 'things_repeating',
    description: 'List repeating tasks with decoded frequency and next instance.',
    inputSchema: {
      type: 'object',
      properties: { ...filterSchema, json: { type: 'boolean' } },
      additionalProperties: false,
    },
    handler: (args) => run({ ...args, json: true }),
  },
};
