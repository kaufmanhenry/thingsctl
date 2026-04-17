'use strict';

const { TaskNotFoundError, AmbiguousIdError } = require('./errors');

// Resolve a partial UUID prefix to a full task uuid.
// Throws AmbiguousIdError when 2+ tasks match and yesFirst is not set.
// Caller can pass `type: 1` to constrain to projects.
function resolveTaskId(db, partial, opts = {}) {
  if (!partial) throw new TaskNotFoundError(partial);
  const { type, yesFirst = false, includeTrashed = false } = opts;

  let sql = 'SELECT uuid, title, type FROM TMTask WHERE uuid LIKE ?';
  const params = [`${partial}%`];
  if (!includeTrashed) sql += ' AND trashed = 0';
  if (type !== undefined) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' LIMIT 6';

  const matches = db.prepare(sql).all(...params);
  if (matches.length === 0) throw new TaskNotFoundError(partial);
  if (matches.length === 1 || yesFirst) return matches[0];
  throw new AmbiguousIdError(partial, matches);
}

// Resolve many ids at once. Returns { resolved: [{input, task}], errors: [{input, error}] }.
function resolveMany(db, partials, opts = {}) {
  const resolved = [];
  const errors = [];
  for (const p of partials) {
    try {
      resolved.push({ input: p, task: resolveTaskId(db, p, opts) });
    } catch (e) {
      errors.push({ input: p, error: e });
    }
  }
  return { resolved, errors };
}

module.exports = { resolveTaskId, resolveMany };
