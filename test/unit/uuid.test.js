'use strict';

const Database = require('better-sqlite3');
const { resolveTaskId, resolveMany } = require('../../src/lib/uuid');
const { AmbiguousIdError, TaskNotFoundError } = require('../../src/lib/errors');

function _seed() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE TMTask (
      uuid TEXT PRIMARY KEY, title TEXT, type INTEGER, trashed INTEGER DEFAULT 0
    );
    INSERT INTO TMTask (uuid, title, type) VALUES
      ('abc123', 'one', 0),
      ('abc456', 'two', 0),
      ('xyz789', 'three', 0),
      ('def000', 'project A', 1);
  `);
  return db;
}

describe('resolveTaskId', () => {
  let db;
  beforeEach(() => { db = _seed(); });
  afterEach(() => { db.close(); });

  test('returns the single match', () => {
    expect(resolveTaskId(db, 'xyz').uuid).toBe('xyz789');
  });

  test('throws TaskNotFoundError when nothing matches', () => {
    expect(() => resolveTaskId(db, 'zzz')).toThrow(TaskNotFoundError);
  });

  test('throws AmbiguousIdError on multiple matches', () => {
    expect(() => resolveTaskId(db, 'abc')).toThrow(AmbiguousIdError);
  });

  test('AmbiguousIdError lists candidates', () => {
    try {
      resolveTaskId(db, 'abc');
    } catch (e) {
      expect(e.matches.length).toBe(2);
      expect(e.message).toContain('one');
      expect(e.message).toContain('two');
      expect(e.message).toContain('--yes-first');
    }
  });

  test('yesFirst picks the first match', () => {
    const r = resolveTaskId(db, 'abc', { yesFirst: true });
    expect(r.uuid).toBe('abc123');
  });

  test('type filter constrains to projects', () => {
    const r = resolveTaskId(db, 'def', { type: 1 });
    expect(r.uuid).toBe('def000');
  });
});

describe('resolveMany', () => {
  let db;
  beforeEach(() => { db = _seed(); });
  afterEach(() => { db.close(); });

  test('separates resolved from errors', () => {
    const out = resolveMany(db, ['xyz', 'zzz', 'def']);
    expect(out.resolved.map((r) => r.task.uuid)).toEqual(['xyz789', 'def000']);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].input).toBe('zzz');
  });
});
