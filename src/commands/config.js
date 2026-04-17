'use strict';

const { setToken, getToken, clearToken, TOKEN_FILE } = require('../lib/token');
const { colors } = require('../lib/format');

function run(args, opts = {}) {
  const sub = args[0];
  if (!sub) {
    return [
      'Usage: thingsctl config <subcommand>',
      '  set-token <token>   Save Things auth token to ' + TOKEN_FILE,
      '  show-token          Print current token (masked)',
      '  clear-token         Remove the saved token',
      '  path                Print the config file path',
    ];
  }
  switch (sub) {
    case 'set-token': {
      const t = args[1];
      if (!t) throw new Error('Token value required');
      const file = setToken(t);
      return `${colors.green('✓')} Saved token to ${file}`;
    }
    case 'show-token': {
      const t = getToken({ required: false });
      if (!t) return colors.dim('No token configured.');
      return `Token: ${t.slice(0, 4)}…${t.slice(-2)} (length ${t.length})`;
    }
    case 'clear-token': {
      const ok = clearToken();
      return ok ? `${colors.green('✓')} Cleared token` : colors.dim('No token to clear.');
    }
    case 'path':
      return TOKEN_FILE;
    default:
      throw new Error(`Unknown config subcommand: ${sub}`);
  }
}

module.exports = { run };
