'use strict';

const { execFileSync } = require('child_process');
const { ThingsUrlError } = require('./errors');

// macOS `open` echoes the ENTIRE url back on failure, and our urls carry
// auth-token=<secret>. That message is spliced into ThingsUrlError, which the
// CLI prints to stderr and the MCP server returns as tool output — i.e. straight
// into a model transcript. Redact before the value can reach any sink.
function redactToken(text) {
  return String(text).replace(/auth-token=[^&\s)]*/gi, 'auth-token=<redacted>');
}

// Open a things:/// URL via macOS `open`. Throws ThingsUrlError on failure.
// Uses execFileSync (not execSync) so the URL is a single argv argument and
// is not subject to shell expansion.
function openUrl(url) {
  if (!url.startsWith('things:')) {
    throw new ThingsUrlError(`Refusing to open non-things URL: ${url.slice(0, 32)}…`);
  }
  try {
    execFileSync('open', [url], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    const stderr = redactToken((e.stderr && e.stderr.toString()) || '');
    throw new ThingsUrlError(
      `Failed to open Things URL.${stderr ? ' ' + stderr.trim() : ''} ` +
        'Is Things 3 installed and running?'
    );
  }
}

module.exports = { openUrl, redactToken };
