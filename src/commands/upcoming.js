'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function run(opts = {}) {
  return outputTasks(queries.upcomingTasks(db.open(), pickFilters(opts)), { ...opts, showScheduled: true });
}

module.exports = {
  run,
  mcp: {
    name: 'things_upcoming',
    description: 'List tasks scheduled for future dates.',
    inputSchema: { type: 'object', properties: { ...filterSchema, ...outputSchema }, additionalProperties: false },
    handler: (args) => queries.upcomingTasks(db.open(), pickFilters(args)).map(require('../lib/format').taskToJson),
  },
};
