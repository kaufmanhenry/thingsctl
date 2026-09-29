#!/usr/bin/env node
'use strict';

// Force NO_COLOR for MCP responses — clients render the text content as-is.
process.env.NO_COLOR = '1';

// Write verification sleeps synchronously, which blocks this server's event
// loop. The CLI can afford a 3s worst case; a long-lived stdio server cannot,
// so default it lower here. THINGSCTL_VERIFY_TIMEOUT_MS still wins if set.
if (!process.env.THINGSCTL_VERIFY_TIMEOUT_MS) process.env.THINGSCTL_VERIFY_TIMEOUT_MS = '1200';

const { start } = require('../src/mcp/server');

start().catch((e) => {
  process.stderr.write(`thingsctl-mcp fatal: ${e.message}\n`);
  process.exit(1);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
