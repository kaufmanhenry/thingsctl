'use strict';

const { execFileSync } = require('child_process');
const { ThingsUrlError } = require('./errors');

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
    const stderr = (e.stderr && e.stderr.toString()) || '';
    throw new ThingsUrlError(
      `Failed to open Things URL.${stderr ? ' ' + stderr.trim() : ''} ` +
        'Is Things 3 installed and running?'
    );
  }
}

module.exports = { openUrl };
