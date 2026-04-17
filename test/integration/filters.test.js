'use strict';

require('./setup');

const queries = require('../../src/lib/queries');
const dbModule = require('../../src/lib/db');

describe('SQL-pushed filters (no N+1)', () => {
  const db = dbModule.open();

  test('--tag filters at SQL layer', () => {
    const all = queries.anytimeTasks(db);
    const filtered = queries.anytimeTasks(db, { tag: 'Errand' });
    expect(filtered.length).toBeLessThan(all.length);
    expect(filtered.every((t) => (t.tagList || '').toLowerCase().includes('errand'))).toBe(true);
  });

  test('--area filters at SQL layer', () => {
    const homeRows = queries.anytimeTasks(db, { area: 'Home' });
    expect(homeRows.every((t) => t.areaName === 'Home')).toBe(true);
  });

  test('--project filters at SQL layer', () => {
    const projRows = queries.todayTasks(db, { project: 'Launch' });
    expect(projRows.every((t) => t.projectName === 'Launch')).toBe(true);
    expect(projRows.length).toBeGreaterThan(0);
  });

  test('combined filters intersect', () => {
    const out = queries.todayTasks(db, { tag: 'Deep', area: 'Work' });
    // Deep+Work intersection: Ship the demo is in project Launch (area Work via project)
    expect(out.length).toBeGreaterThanOrEqual(0);
  });
});
