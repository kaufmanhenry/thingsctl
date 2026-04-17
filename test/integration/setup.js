'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const { OUT, build } = require('../fixtures/build');
const dbModule = require('../../src/lib/db');

if (!fs.existsSync(OUT)) build();

// Open the fixture as the singleton DB for the integration suite.
const db = new Database(OUT, { readonly: true });
dbModule._setForTest(db);

// Force NO_COLOR before format.js loads anywhere.
process.env.NO_COLOR = '1';
if (process.stdout.isTTY) process.stdout.isTTY = false;

afterAll(() => {
  try { db.close(); } catch (_) {}
});

module.exports = { db };
