'use strict';

const db = require('../lib/db');
const queries = require('../lib/queries');
const { buildJsonUrl } = require('../lib/url');
const { openUrl } = require('../lib/exec');
const { getToken } = require('../lib/token');
const { colors } = require('../lib/format');
const { TYPE } = require('../lib/constants');
const { TaskNotFoundError } = require('../lib/errors');

function _payload(database, project, opts) {
  const items = [];
  const structure = queries.getProjectStructure(database, project.uuid);
  for (const row of structure) {
    if (row.type === TYPE.HEADING) {
      items.push({ type: 'heading', attributes: { title: row.title } });
      continue;
    }
    const tags = row.tagList ? row.tagList.split(',').filter(Boolean) : [];
    const checklist = queries.getChecklist(database, row.uuid)
      .map((c) => ({ type: 'checklist-item', attributes: { title: c.title } }));
    const attrs = { title: row.title };
    if (row.notes) attrs.notes = row.notes;
    if (tags.length) attrs.tags = tags;
    if (checklist.length) attrs['checklist-items'] = checklist;
    items.push({ type: 'to-do', attributes: attrs });
  }
  const projectAttrs = { title: opts.name || `${project.title} (copy)`, items };
  if (opts.area) projectAttrs.area = opts.area;
  else if (project.areaName) projectAttrs.area = project.areaName;
  if (project.notes) projectAttrs.notes = project.notes;
  return [{ type: 'project', attributes: projectAttrs }];
}

function run(name, opts = {}) {
  if (!name) throw new Error('Source project name required');
  const database = db.open();
  const project = queries.findProject(database, name);
  if (!project) throw new TaskNotFoundError(`Project not found: ${name}`);
  const fullProject = queries.getProject(database, project.uuid);
  const data = _payload(database, fullProject, opts);

  if (opts['dry-run']) return JSON.stringify(data, null, 2);
  openUrl(buildJsonUrl({ data, authToken: getToken() }));
  return `${colors.green('✓')} Cloned project "${fullProject.title}" → "${data[0].attributes.title}"`;
}

module.exports = {
  run,
  mcp: {
    name: 'things_clone_project',
    description: 'Clone a project (with headings, tasks, checklists, tags) to a new project via Things URL JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source project name (partial)' },
        name: { type: 'string', description: 'Title for the new project' },
        area: { type: 'string', description: 'Optional area override' },
      },
      required: ['source'],
      additionalProperties: false,
    },
    handler: ({ source, name, area }) => ({ ok: true, message: run(source, { name, area }) }),
  },
};
