'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { TokenMissingError } = require('./errors');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'thingsctl');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth-token');

function getToken({ required = true } = {}) {
  if (process.env.THINGS_AUTH_TOKEN) return process.env.THINGS_AUTH_TOKEN.trim();
  try {
    const v = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (v) return v;
  } catch (_) {}
  if (required) throw new TokenMissingError();
  return null;
}

function setToken(value) {
  if (!value || typeof value !== 'string') throw new Error('Token must be a non-empty string');
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(TOKEN_FILE, value.trim() + '\n', { mode: 0o600 });
  return TOKEN_FILE;
}

function clearToken() {
  try { fs.unlinkSync(TOKEN_FILE); return true; } catch (_) { return false; }
}

module.exports = { getToken, setToken, clearToken, TOKEN_FILE, CONFIG_DIR };
