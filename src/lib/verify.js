'use strict';

const db = require('./db');
const { colors } = require('./format');

// Why this module exists.
//
// Every write in thingsctl goes out through the Things URL scheme via `open`.
// `open` exits 0 as soon as macOS hands the URL to Things — it says nothing
// about whether Things accepted the command. Things silently ignores a command
// it cannot apply (the classic case: `things:///update` aimed at a project,
// which only `update-project` handles). The result is a write that never
// happened and a CLI that cheerfully prints a checkmark.
//
// So: a write is not confirmed until the database says it landed.

// Overridable because one number has to cover two very different situations.
// Things already running applies a write well inside 500ms. A `things:///` URL
// that cold-launches the app can take longer than 3s, and that shows up as a
// false "did not apply" on a write that does eventually land.
const DEFAULT_TIMEOUT_MS = Number(process.env.THINGSCTL_VERIFY_TIMEOUT_MS) || 3000;

// The first read almost always misses: `open` returns as soon as LaunchServices
// hands over the URL, well before Things has committed anything. Start tight and
// back off, so the common case pays ~20ms rather than a flat 100ms.
const BACKOFF_MS = [20, 40, 80];
const STEADY_INTERVAL_MS = 100;

// Only columns a predicate actually reads. Keep this tight: it is the surface
// that can rot, and it runs on every write on a user's machine.
const VERIFY_FIELDS =
  'uuid, status, project, area, start, startBucket, startDate, userModificationDate';

// Synchronous sleep. The CLI is synchronous end to end (better-sqlite3,
// execFileSync), so this keeps the control flow flat.
//
// NOTE: this blocks the Node main thread. Harmless for the one-shot CLI; in the
// long-lived MCP server it freezes the event loop for the duration of the wait,
// which is why bin/thingsctl-mcp.js sets a shorter default timeout. Making the
// whole write path async is the real fix and is deliberately not done here.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// One short-lived connection per wait, not one per poll. The database is in WAL
// mode and a readonly connection in autocommit opens a fresh read transaction
// per statement, so a single connection already sees another process's commits
// between polls — reopening bought nothing and cost ~1.2ms each time.
function _withConnection(fn) {
  const conn = db.openFresh();
  try {
    return fn(conn);
  } finally {
    try { conn.close(); } catch (_) { /* handle dies with the process anyway */ }
  }
}

// Read a row once. Also the "before" snapshot for change-based predicates.
function snapshot(uuid) {
  return _withConnection((conn) =>
    conn.prepare(`SELECT ${VERIFY_FIELDS} FROM TMTask WHERE uuid = ?`).get(uuid)
  );
}

// Poll until `predicate(row)` holds or we run out of patience.
// Returns { ok, row }. Never throws on a failed predicate — callers decide how
// loudly to complain.
function waitForWrite(uuid, predicate, opts = {}) {
  const timeoutMs = opts.timeoutMs == null ? DEFAULT_TIMEOUT_MS : opts.timeoutMs;
  const deadline = Date.now() + timeoutMs;

  return _withConnection((conn) => {
    const stmt = conn.prepare(`SELECT ${VERIFY_FIELDS} FROM TMTask WHERE uuid = ?`);
    for (let attempt = 0; ; attempt++) {
      const row = stmt.get(uuid);
      if (row && predicate(row)) return { ok: true, row };
      if (Date.now() >= deadline) return { ok: false, row };
      sleepSync(BACKOFF_MS[attempt] == null ? STEADY_INTERVAL_MS : BACKOFF_MS[attempt]);
    }
  });
}

// The general-purpose predicate: Things bumps userModificationDate on any real
// edit. Prefer a field-specific predicate where one exists — this one cannot
// tell our write apart from a Things Cloud sync or a concurrent edit in the UI,
// and it cannot see a write that changed nothing.
//
// A missing baseline (the row could not be read before the write) makes this
// vacuously true on the first read, which degrades to the old assume-success
// behaviour. Callers that care should pass a field-specific predicate.
function modifiedSince(before) {
  const was = before ? before.userModificationDate : null;
  return (row) => row.userModificationDate !== was;
}

// Assert a column holds an expected value — the strong form, used where we know
// the end state (a re-parent target, a status change).
function fieldEquals(field, expected) {
  return (row) => row[field] === expected;
}

// One failure message, not one per command. Every write command reports the
// same thing: macOS took the URL, Things did nothing with it.
function notApplied(verb, title) {
  return (
    `${colors.red('✗')} Things did not ${verb} "${title}" ` +
    '(the URL was accepted but the database never changed)'
  );
}

module.exports = {
  waitForWrite,
  snapshot,
  modifiedSince,
  fieldEquals,
  notApplied,
  DEFAULT_TIMEOUT_MS,
};
