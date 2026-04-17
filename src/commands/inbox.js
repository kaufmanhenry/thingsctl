'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { pickFilters, filterSchema, outputSchema } = require('./_filters');

function run(opts = {}) {
  return outputTasks(queries.inboxTasks(db.open(), pickFilters(opts)), opts);
}

module.exports = {
  run,
  mcp: {
    name: 'things_inbox',
    description: 'List tasks in the Inbox.',
    inputSchema: { type: 'object', properties: { ...filterSchema, ...outputSchema }, additionalProperties: false },
    handler: (args) => queries.inboxTasks(db.open(), pickFilters(args)).map(require('../lib/format').taskToJson),
  },
};
