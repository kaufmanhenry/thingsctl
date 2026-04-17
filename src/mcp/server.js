'use strict';

// Low-level MCP server that auto-registers each command's mcp descriptor.
// Uses Server (not McpServer) so we can pass JSON Schema directly without
// pulling in zod.

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const commands = require('../commands');
const pkg = require('../../package.json');

function _collectTools() {
  const tools = [];
  const handlers = new Map();
  for (const name of commands.names()) {
    const mod = commands.get(name);
    if (!mod || !mod.mcp) continue;
    const { name: toolName, description, inputSchema, handler } = mod.mcp;
    if (!toolName || !handler || handlers.has(toolName)) continue;
    tools.push({
      name: toolName,
      description: description || '',
      inputSchema: inputSchema || { type: 'object', properties: {} },
    });
    handlers.set(toolName, handler);
  }
  return { tools, handlers };
}

function start() {
  const { tools, handlers } = _collectTools();

  const server = new Server(
    { name: 'thingsctl', version: pkg.version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = handlers.get(name);
    if (!handler) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
    }
    try {
      const result = await handler(args || {});
      return {
        content: [
          { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: 'text', text: `${e.code || 'Error'}: ${e.message}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  return server.connect(transport);
}

module.exports = { start };
