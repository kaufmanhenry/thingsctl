'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function run(opts = {}) {
  const tasks = queries.todayTasks(db.open(), pickFilters(opts));
  return outputTasks(tasks, opts);
}

module.exports = {
  run,
  mcp: {
    name: 'things_today',
    description: "List tasks in Today (todayIndex>0 OR scheduled for today/past).",
    inputSchema: { type: 'object', properties: { ...filterSchema, ...outputSchema }, additionalProperties: false },
    handler: (args) => queries.todayTasks(db.open(), pickFilters(args)).map(require('../lib/format').taskToJson),
  },
};
