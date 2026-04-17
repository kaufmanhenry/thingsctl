'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function run(opts = {}) {
  return outputTasks(queries.anytimeTasks(db.open(), pickFilters(opts)), opts);
}

module.exports = {
  run,
  mcp: {
    name: 'things_anytime',
    description: 'List tasks in Anytime (start=1, not in Today, no project).',
    inputSchema: { type: 'object', properties: { ...filterSchema, ...outputSchema }, additionalProperties: false },
    handler: (args) => queries.anytimeTasks(db.open(), pickFilters(args)).map(require('../lib/format').taskToJson),
  },
};
