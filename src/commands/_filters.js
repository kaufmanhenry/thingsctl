'use strict';

// Pull --tag/--area/--project off an opts object.
function pickFilters(opts = {}) {
  return { tag: opts.tag, area: opts.area, project: opts.project };
}

const filterSchema = {
  tag: { type: 'string', description: 'Filter by tag (partial match)' },
  area: { type: 'string', description: 'Filter by area (partial match)' },
  project: { type: 'string', description: 'Filter by project (partial match)' },
};

const outputSchema = {
  json: { type: 'boolean', description: 'Return structured JSON' },
  verbose: { type: 'boolean', description: 'Include project/area context' },
  compact: { type: 'boolean', description: 'Single-line output' },
  ids: { type: 'boolean', description: 'Output only UUIDs' },
};

module.exports = { pickFilters, filterSchema, outputSchema };
