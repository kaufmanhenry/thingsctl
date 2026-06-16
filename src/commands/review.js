'use strict';

const db = require('../lib/db');
const { daysAgoUnix, encodeThingsDate, formatThingsShortDate, unixToDate } = require('../lib/dates');
const { colors } = require('../lib/format');

function _gather(database, days) {
  const now = new Date();
  // Timestamps (stopDate, creationDate) are Unix seconds; deadlines are packed
  // calendar dates, so the two windows use different encodings.
  const sinceUnix = daysAgoUnix(days, now);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineFrom = encodeThingsDate(todayMidnight);
  const until = new Date(todayMidnight);
  until.setDate(until.getDate() + days);
  const deadlineTo = encodeThingsDate(until); // deadline window: today .. today+N

  const completed = database.prepare(`
    SELECT t.uuid, t.title, t.stopDate, t.area, t.project,
      (SELECT title FROM TMArea WHERE uuid = t.area) AS areaName,
      (SELECT title FROM TMTask WHERE uuid = t.project AND type = 1) AS projectName,
      COALESCE((SELECT GROUP_CONCAT(tg.title, ',') FROM TMTaskTag tt
                JOIN TMTag tg ON tg.uuid = tt.tags WHERE tt.tasks = t.uuid), '') AS tagList
    FROM TMTask t
    WHERE t.status = 3 AND t.trashed = 0 AND t.type = 0 AND t.stopDate >= ?
    ORDER BY t.stopDate DESC
  `).all(sinceUnix);

  const added = database.prepare(`
    SELECT t.uuid, t.title, t.creationDate, t.area, t.project,
      (SELECT title FROM TMArea WHERE uuid = t.area) AS areaName,
      (SELECT title FROM TMTask WHERE uuid = t.project AND type = 1) AS projectName
    FROM TMTask t
    WHERE t.trashed = 0 AND t.type = 0 AND t.creationDate >= ?
    ORDER BY t.creationDate DESC
  `).all(sinceUnix);

  const deadlines = database.prepare(`
    SELECT t.uuid, t.title, t.deadline,
      (SELECT title FROM TMArea WHERE uuid = t.area) AS areaName,
      (SELECT title FROM TMTask WHERE uuid = t.project AND type = 1) AS projectName
    FROM TMTask t
    WHERE t.status = 0 AND t.trashed = 0 AND t.type = 0
      AND t.deadline >= ? AND t.deadline < ?
    ORDER BY t.deadline ASC
  `).all(deadlineFrom, deadlineTo);

  return { days, completed, added, deadlines };
}

function _groupBy(rows, key) {
  const map = new Map();
  for (const r of rows) {
    const k = r[key] || 'Uncategorized';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

function run(opts = {}) {
  const days = parseInt(opts.days || 7, 10);
  const data = _gather(db.open(), days);
  if (opts.json) {
    return {
      windowDays: days,
      completed: data.completed.map((c) => ({ uuid: c.uuid, title: c.title, completedAt: unixToDate(c.stopDate)?.toISOString(), area: c.areaName, project: c.projectName })),
      added: data.added.map((a) => ({ uuid: a.uuid, title: a.title, createdAt: unixToDate(a.creationDate)?.toISOString(), area: a.areaName, project: a.projectName })),
      deadlines: data.deadlines.map((d) => ({ uuid: d.uuid, title: d.title, deadline: formatThingsShortDate(d.deadline), area: d.areaName, project: d.projectName })),
    };
  }

  const lines = [];
  lines.push(`# Review — last ${days} day${days === 1 ? '' : 's'}`);
  lines.push('');
  lines.push(`${colors.bold('Completed')} (${data.completed.length})`);
  for (const [area, items] of _groupBy(data.completed, 'areaName')) {
    lines.push(`  ${colors.magenta('[' + area + ']')} ${items.length}`);
    for (const t of items.slice(0, 50)) {
      const d = unixToDate(t.stopDate);
      const day = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      lines.push(`    ✓ ${t.title} ${colors.dim('(' + day + ')')}`);
    }
  }
  lines.push('');
  lines.push(`${colors.bold('Added')} (${data.added.length})`);
  for (const [area, items] of _groupBy(data.added, 'areaName')) {
    lines.push(`  ${colors.magenta('[' + area + ']')} ${items.length}`);
  }
  lines.push('');
  lines.push(`${colors.bold('Deadlines next ' + days + ' day' + (days === 1 ? '' : 's'))} (${data.deadlines.length})`);
  for (const t of data.deadlines) {
    const d = formatThingsShortDate(t.deadline);
    lines.push(`  📅 ${d}  ${t.title}${t.areaName ? ` ${colors.magenta('[' + t.areaName + ']')}` : ''}`);
  }
  return lines;
}

module.exports = {
  run,
  mcp: {
    name: 'things_review',
    description: 'Weekly review: completed/added/deadlines in a rolling window of N days (default 7).',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'number', default: 7 } },
      additionalProperties: false,
    },
    handler: ({ days }) => run({ days, json: true }),
  },
};
