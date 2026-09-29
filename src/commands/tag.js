'use strict';

const db = require('../lib/db');
const { resolveTaskId } = require('../lib/uuid');
const { buildUpdateUrl, buildUpdateProjectUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { TYPE } = require('../lib/constants');
const { waitForWrite, snapshot, modifiedSince, notApplied } = require('../lib/verify');

function run(id, opts = {}) {
  if (!id) throw new Error('Task id required');
  const database = db.open();
  const ref = resolveTaskId(database, id, { yesFirst: opts['yes-first'] });

  if (opts.add) {
    if (ref.type === TYPE.HEADING) {
      throw new Error(`"${ref.title}" is a heading. Headings cannot be tagged.`);
    }
    const params = { id: ref.uuid, 'add-tags': opts.add, 'auth-token': getToken() };
    // Same routing rule as every other write: Things ignores `update` on a
    // project, so tagging one through it was a silent no-op reporting success.
    const isProject = ref.type === TYPE.PROJECT;
    const before = snapshot(ref.uuid);
    openUrl(isProject ? buildUpdateProjectUrl(params) : buildUpdateUrl(params));

    const { ok } = waitForWrite(ref.uuid, modifiedSince(before));
    if (!ok) return notApplied('tag', ref.title);
    const label = isProject ? 'project ' : '';
    return `${colors.green('✓')} Added tag "${opts.add}" to ${label}"${ref.title}"`;
  }
  if (opts.remove) {
    throw new Error('Removing tags is not supported by the Things URL scheme (it would replace all tags).');
  }
  throw new Error('Specify --add <tag>');
}

module.exports = {
  run,
  mcp: {
    name: 'things_tag',
    description: 'Add a tag to a to-do or project. Tags must already exist in Things. Verified against the database before reporting success.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, add: { type: 'string' } },
      required: ['id', 'add'],
      additionalProperties: false,
    },
    handler: ({ id, add }) => ({ ok: true, message: run(id, { add }) }),
  },
};
