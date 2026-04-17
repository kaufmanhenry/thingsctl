'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { colors } = require('../lib/format');

function run(opts = {}) {
  const areas = queries.listAreas(db.open());
  if (opts.json) {
    return areas.map((a) => ({
      uuid: a.uuid, title: a.title, taskCount: a.taskCount, projectCount: a.projectCount,
    }));
  }
  return areas.map((a) => {
    let line = `📂 ${a.title}`;
    const counts = [];
    if (a.taskCount > 0) counts.push(`${a.taskCount} tasks`);
    if (a.projectCount > 0) counts.push(`${a.projectCount} projects`);
    if (counts.length) line += ` ${colors.dim('(' + counts.join(', ') + ')')}`;
    return line;
  });
}

module.exports = {
  run,
  mcp: {
    name: 'things_areas',
    description: 'List all areas with task and project counts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => run({ json: true }),
  },
};
