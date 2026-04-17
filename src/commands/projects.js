'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { colors } = require('../lib/format');

function run(opts = {}) {
  const projects = queries.listProjects(db.open());
  if (opts.json) {
    return projects.map((p) => ({
      uuid: p.uuid, title: p.title, taskCount: p.taskCount, area: p.areaName || null,
    }));
  }
  if (opts.ids) return projects.map((p) => p.uuid);
  return projects.map((p) => {
    let line = `📁 ${p.title}`;
    if (p.taskCount > 0) line += ` ${colors.dim('(' + p.taskCount + ')')}`;
    if (p.areaName) line += ` ${colors.magenta('[' + p.areaName + ']')}`;
    return line;
  });
}

module.exports = {
  run,
  mcp: {
    name: 'things_projects',
    description: 'List all open projects with task counts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => run({ json: true }),
  },
};
