'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function run(opts = {}) {
  return outputTasks(queries.overdueTasks(db.open(), pickFilters(opts)), opts);
}

module.exports = {
  run,
  mcp: {
    name: 'things_overdue',
    description: 'List open tasks whose deadline is before today.',
    inputSchema: { type: 'object', properties: { ...filterSchema, ...outputSchema }, additionalProperties: false },
    handler: (args) => queries.overdueTasks(db.open(), pickFilters(args)).map(require('../lib/format').taskToJson),
  },
};
