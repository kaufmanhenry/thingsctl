'use strict';

const { DB_PATH } = require('./constants');

let _db = null;

function open(dbPath = DB_PATH) {
  if (_db) return _db;
  const Database = require('better-sqlite3');
  _db = new Database(dbPath, { readonly: true, fileMustExist: true });
  return _db;
}

function close() {
  if (_db) {
    try { _db.close(); } catch (_) {}
    _db = null;
  }
}

// Test seam: replace the singleton with an existing Database instance.
function _setForTest(db) {
  _db = db;
}

module.exports = { open, close, _setForTest };
