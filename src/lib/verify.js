'use strict';

const db = require('./db');

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

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_INTERVAL_MS = 100;

const VERIFY_FIELDS = `
  uuid, title, type, status, project, area, heading,
  start, startBucket, startDate, deadline, notes, userModificationDate
`;

// Synchronous sleep. The CLI is synchronous end to end (better-sqlite3,
// execFileSync), so this keeps the control flow flat rather than turning every
// command into a promise chain.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readRow(uuid) {
  const conn = db.openFresh();
  try {
    return conn.prepare(`SELECT ${VERIFY_FIELDS} FROM TMTask WHERE uuid = ?`).get(uuid);
  } finally {
    try { conn.close(); } catch (_) { /* nothing useful to do */ }
  }
}

// Poll until `predicate(row)` holds or we run out of patience.
// Returns { ok, row }. Never throws on a failed predicate — callers decide how
// loudly to complain.
function waitForWrite(uuid, predicate, opts = {}) {
  const timeoutMs = opts.timeoutMs == null ? DEFAULT_TIMEOUT_MS : opts.timeoutMs;
  const intervalMs = opts.intervalMs == null ? DEFAULT_INTERVAL_MS : opts.intervalMs;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const row = readRow(uuid);
    if (row && predicate(row)) return { ok: true, row };
    if (Date.now() >= deadline) return { ok: false, row };
    sleepSync(intervalMs);
  }
}

// Snapshot the fields a command is about to change, so the predicate can ask
// "did anything actually move?" rather than guessing at final values.
function snapshot(uuid) {
  return readRow(uuid);
}

// The general-purpose predicate: Things bumps userModificationDate on any real
// edit. Use a field-specific predicate where one exists (status, project) —
// this is the fallback for edits whose end state we can't cheaply assert.
function modifiedSince(before) {
  const was = before ? before.userModificationDate : null;
  return (row) => row.userModificationDate !== was;
}

module.exports = {
  waitForWrite,
  snapshot,
  modifiedSince,
  readRow,
  sleepSync,
  DEFAULT_TIMEOUT_MS,
};
