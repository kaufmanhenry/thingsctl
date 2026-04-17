'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { outputTasks } = require('../lib/output');
const { colors } = require('../lib/format');
const { TaskNotFoundError } = require('../lib/errors');

function _resolve(database, nameOrId) {
  // UUID prefix first; fall back to title.
  let row = database.prepare(
    `SELECT uuid, title FROM TMTask WHERE type = 1 AND status = 0 AND trashed = 0 AND uuid LIKE ? LIMIT 1`
  ).get(`${nameOrId}%`);
  if (row) return row;
  row = queries.findProject(database, nameOrId);
  if (!row) throw new TaskNotFoundError(`Project not found: ${nameOrId}`);
  return row;
}

function run(name, opts = {}) {
  const database = db.open();
  const project = _resolve(database, name);
  const tasks = queries.projectTasks(database, project.uuid);
  if (!opts.json && !opts.ids && !opts.compact) {
    process.stdout.write(`${colors.bold('📁 ' + project.title)}\n\n`);
  }
  return outputTasks(tasks, opts);
}

module.exports = {
  run,
  mcp: {
    name: 'things_project',
    description: 'List open tasks in a project (matched by name prefix or UUID).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Project name (partial)' } },
      required: ['name'],
      additionalProperties: false,
    },
    handler: ({ name }) => {
      const database = db.open();
      const project = _resolve(database, name);
      return {
        project: { uuid: project.uuid, title: project.title },
        tasks: queries.projectTasks(database, project.uuid).map(require('../lib/format').taskToJson),
      };
    },
  },
};
