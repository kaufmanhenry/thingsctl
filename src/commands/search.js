'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');

function run(query, opts = {}) {
  if (!query) throw new Error('Search query required');
  const tasks = queries.searchTasks(db.open(), query);
  return outputTasks(tasks, { ...opts, verbose: true });
}

module.exports = {
  run,
  mcp: {
    name: 'things_search',
    description: 'Search open tasks by title or notes (case-insensitive substring).',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
    handler: ({ query }) =>
      queries.searchTasks(db.open(), query).map(require('../lib/format').taskToJson),
  },
};
