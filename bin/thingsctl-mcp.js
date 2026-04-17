#!/usr/bin/env node
'use strict';

// Force NO_COLOR for MCP responses — clients render the text content as-is.
process.env.NO_COLOR = '1';

const { start } = require('../src/mcp/server');

start().catch((e) => {
  process.stderr.write(`thingsctl-mcp fatal: ${e.message}\n`);
  process.exit(1);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
