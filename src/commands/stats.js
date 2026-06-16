'use strict';

const db = require('../lib/db');
const { todayBounds, encodeThingsDate, packedTomorrow } = require('../lib/dates');
const { colors } = require('../lib/format');

function _gather(database) {
  const bounds = todayBounds();
  const today = encodeThingsDate();      // packed calendar date for startDate/deadline
  const tomorrow = packedTomorrow();     // exclusive upper bound for "today or earlier"
  const q = (sql, ...p) => database.prepare(sql).get(...p).count;

  return {
    today: q(`
      SELECT COUNT(*) as count FROM TMTask
      WHERE status = 0 AND trashed = 0 AND type = 0
        AND start = 1 AND startDate IS NOT NULL AND startDate > 0 AND startDate < ?
    `, tomorrow),
    inbox: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=0 AND trashed=0 AND type=0 AND start=0`),
    anytime: q(`
      SELECT COUNT(*) as count FROM TMTask
      WHERE status=0 AND trashed=0 AND type=0 AND start=1 AND todayIndex<=0 AND project IS NULL
    `),
    someday: q(`
      SELECT COUNT(*) as count FROM TMTask
      WHERE status=0 AND trashed=0 AND type=0 AND start=2 AND todayIndex<=0
        AND startDate IS NULL
        AND rt1_recurrenceRule IS NULL
    `),
    upcoming: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=0 AND trashed=0 AND type=0 AND startDate IS NOT NULL AND startDate >= ? AND todayIndex<=0`, tomorrow),
    evening: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=0 AND trashed=0 AND type=0 AND startBucket=1 AND todayIndex<=0`),
    overdue: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=0 AND trashed=0 AND type=0 AND deadline IS NOT NULL AND deadline > 0 AND deadline < ?`, today),
    totalOpen: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=0 AND trashed=0 AND type=0`),
    completedToday: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=3 AND trashed=0 AND type=0 AND stopDate >= ?`, bounds.start),
    projects: q(`SELECT COUNT(*) as count FROM TMTask WHERE status=0 AND trashed=0 AND type=1`),
  };
}

function run(opts = {}) {
  const stats = _gather(db.open());
  if (opts.json) return stats;
  const lines = [];
  lines.push(colors.bold('Things 3 Statistics'));
  lines.push('');
  lines.push(`Today:           ${stats.today}`);
  lines.push(`Inbox:           ${stats.inbox}`);
  lines.push(`Anytime:         ${stats.anytime}`);
  lines.push(`Someday:         ${stats.someday}`);
  lines.push(`Upcoming:        ${stats.upcoming}`);
  lines.push(`Evening:         ${stats.evening}`);
  lines.push(`Overdue:         ${stats.overdue}`);
  lines.push('');
  lines.push(`Total Open:      ${stats.totalOpen}`);
  lines.push(`Completed Today: ${stats.completedToday}`);
  lines.push(`Projects:        ${stats.projects}`);
  return lines;
}

module.exports = {
  run,
  mcp: {
    name: 'things_stats',
    description: 'Counts of tasks across lists; useful for daily summaries.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => _gather(db.open()),
  },
};
