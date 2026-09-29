'use strict';

// verify.js's SQL runs on every write on a user's machine and was previously
// stubbed out of every test, so a column typo would have shipped green. This
// reads the fixture through the real code path, which also exercises the
// db.openFresh test-seam facade.

require('./setup');
const verify = require('../../src/lib/verify');
const db = require('../../src/lib/db');

describe('snapshot reads real rows', () => {
  test('returns the columns predicates depend on', () => {
    const row = verify.snapshot('t-today-1');
    expect(row).toBeDefined();
    expect(row.uuid).toBe('t-today-1');
    for (const col of ['status', 'project', 'area', 'start', 'startBucket', 'startDate', 'userModificationDate']) {
      expect(row).toHaveProperty(col);
    }
  });

  test('a project row reads back too', () => {
    expect(verify.snapshot('p-001').uuid).toBe('p-001');
  });

  test('an unknown uuid is undefined, not a throw', () => {
    expect(verify.snapshot('does-not-exist')).toBeUndefined();
  });
});

describe('openFresh under the test seam', () => {
  test('hands back a facade that must not close the shared fixture', () => {
    const conn = db.openFresh();
    conn.close();
    expect(verify.snapshot('t-today-1')).toBeDefined();
  });
});

describe('waitForWrite against a row that will never change', () => {
  test('gives up and reports the row it last saw', () => {
    const { ok, row } = verify.waitForWrite('t-today-1', () => false, { timeoutMs: 60 });
    expect(ok).toBe(false);
    expect(row.uuid).toBe('t-today-1');
  });

  test('succeeds immediately when the predicate already holds', () => {
    const { ok } = verify.waitForWrite('t-today-1', (r) => r.uuid === 't-today-1', { timeoutMs: 60 });
    expect(ok).toBe(true);
  });
});
