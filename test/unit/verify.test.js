'use strict';

const db = require('../../src/lib/db');
const verify = require('../../src/lib/verify');

// Stand in for a better-sqlite3 connection. `rows` is read fresh on every
// prepare().get() so a test can mutate it mid-poll to imitate Things catching up.
function fakeConn(getRow) {
  return { prepare: () => ({ get: () => getRow() }), close: () => {} };
}

describe('waitForWrite', () => {
  const realOpenFresh = db.openFresh;
  afterEach(() => { db.openFresh = realOpenFresh; });

  test('succeeds immediately when the row already satisfies the predicate', () => {
    db.openFresh = () => fakeConn(() => ({ uuid: 'x', status: 3 }));
    const { ok, row } = verify.waitForWrite('x', (r) => r.status === 3);
    expect(ok).toBe(true);
    expect(row.status).toBe(3);
  });

  test('fails after the timeout when the write never lands', () => {
    db.openFresh = () => fakeConn(() => ({ uuid: 'x', status: 0 }));
    const started = Date.now();
    const { ok } = verify.waitForWrite('x', (r) => r.status === 3, { timeoutMs: 120, intervalMs: 20 });
    expect(ok).toBe(false);
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
  });

  test('polls until Things applies the change', () => {
    let reads = 0;
    db.openFresh = () => fakeConn(() => ({ uuid: 'x', status: ++reads >= 3 ? 3 : 0 }));
    const { ok } = verify.waitForWrite('x', (r) => r.status === 3, { timeoutMs: 1000, intervalMs: 5 });
    expect(ok).toBe(true);
    expect(reads).toBeGreaterThanOrEqual(3);
  });

  test('a missing row never satisfies the predicate', () => {
    db.openFresh = () => fakeConn(() => undefined);
    const { ok, row } = verify.waitForWrite('gone', () => true, { timeoutMs: 40, intervalMs: 10 });
    expect(ok).toBe(false);
    expect(row).toBeUndefined();
  });
});

describe('modifiedSince', () => {
  test('is false until userModificationDate moves', () => {
    const pred = verify.modifiedSince({ userModificationDate: 100 });
    expect(pred({ userModificationDate: 100 })).toBe(false);
    expect(pred({ userModificationDate: 101 })).toBe(true);
  });

  test('treats a missing baseline as "any value counts as changed"', () => {
    const pred = verify.modifiedSince(undefined);
    expect(pred({ userModificationDate: 7 })).toBe(true);
  });
});
