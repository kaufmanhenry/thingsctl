'use strict';

require('./setup');
const exportCmd = require('../../src/commands/export');

describe('export', () => {
  test('markdown today contains Ship the demo', () => {
    const out = exportCmd.run('today', { format: 'md' });
    expect(out).toContain('# Today');
    expect(out).toContain('- [ ] Ship the demo');
  });

  test('json today returns valid JSON array', () => {
    const out = exportCmd.run('today', { format: 'json' });
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
  });

  test('csv inbox emits valid header and rows', () => {
    const out = exportCmd.run('inbox', { format: 'csv' });
    const lines = out.split('\n');
    expect(lines[0]).toBe('uuid,title,status,tags,project,area,deadline,notes');
    // "Quick capture" has no commas, so it stays unquoted (RFC4180 conformant).
    expect(out).toMatch(/^[^,]+,Quick capture,open,/m);
  });

  test('csv with comma+quote+newline in notes is RFC4180-quoted', () => {
    // The fixture seeds a task t-csv-1 in Inbox-equivalent; export inbox.
    const out = exportCmd.run('inbox', { format: 'csv' });
    // The notes field "has \"quotes\", and a comma\nand a newline" should appear
    // wrapped in quotes with doubled internal quotes and the literal newline.
    expect(out).toMatch(/"has ""quotes"", and a comma\nand a newline"/);
  });
});
