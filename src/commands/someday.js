'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function run(opts = {}) {
  return outputTasks(queries.somedayTasks(db.open(), pickFilters(opts)), opts);
}

module.exports = {
  run,
  mcp: {
    name: 'things_someday',
    description: 'List tasks in Someday (start=2, not scheduled, not in Today).',
    inputSchema: { type: 'object', properties: { ...filterSchema, ...outputSchema }, additionalProperties: false },
    handler: (args) => queries.somedayTasks(db.open(), pickFilters(args)).map(require('../lib/format').taskToJson),
  },
};
