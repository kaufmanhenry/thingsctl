'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { colors } = require('../lib/format');

function run(opts = {}) {
  const tags = queries.listTags(db.open());
  if (opts.json) {
    return tags.map((t) => ({
      uuid: t.uuid, title: t.title, shortcut: t.shortcut, taskCount: t.taskCount,
    }));
  }
  return tags.map((t) => {
    let line = `#${t.title}`;
    if (t.taskCount > 0) line += ` ${colors.dim('(' + t.taskCount + ')')}`;
    if (t.shortcut) line += ` ${colors.cyan('[' + t.shortcut + ']')}`;
    return line;
  });
}

module.exports = {
  run,
  mcp: {
    name: 'things_tags',
    description: 'List all tags with their task counts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => run({ json: true }),
  },
};
