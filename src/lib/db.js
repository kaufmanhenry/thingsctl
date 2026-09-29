'use strict';

const { DB_PATH } = require('./constants');

let _db = null;
let _isTestDb = false;

function open(dbPath = DB_PATH) {
  if (_db) return _db;
  const Database = require('better-sqlite3');
  _db = new Database(dbPath, { readonly: true, fileMustExist: true });
  return _db;
}

// A separate, short-lived readonly connection. Used by lib/verify to re-read a
// row after a URL-scheme write without disturbing (or reading a stale snapshot
// through) the long-lived singleton. Caller closes it.
function openFresh(dbPath = DB_PATH) {
  // Under the test seam there is exactly one fixture database and it must not
  // be closed out from under the suite, so hand back a facade instead.
  if (_isTestDb && _db) {
    return { prepare: (...a) => _db.prepare(...a), close: () => {} };
  }
  const Database = require('better-sqlite3');
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

function close() {
  if (_db) {
    try { _db.close(); } catch (_) {}
    _db = null;
    _isTestDb = false;
  }
}

// Test seam: replace the singleton with an existing Database instance.
function _setForTest(db) {
  _db = db;
  _isTestDb = true;
}

module.exports = { open, openFresh, close, _setForTest };
