'use strict';

const { parseArgs } = require('../../src/cli');

describe('parseArgs', () => {
  test('captures command, args, options', () => {
    const r = parseArgs(['add', 'Buy', 'milk', '--when', 'today']);
    expect(r.command).toBe('add');
    expect(r.args).toEqual(['Buy', 'milk']);
    expect(r.options).toEqual({ when: 'today' });
  });

  test('flag without value is true', () => {
    const r = parseArgs(['today', '--json']);
    expect(r.options.json).toBe(true);
  });

  test('-- terminator', () => {
    const r = parseArgs(['add', '--', '--literal-title']);
    expect(r.args).toEqual(['--literal-title']);
  });

  test('multi-arg complete', () => {
    const r = parseArgs(['complete', '7Ae', '17j', '9pU']);
    expect(r.args).toEqual(['7Ae', '17j', '9pU']);
  });

  test('-v short option', () => {
    const r = parseArgs(['today', '-v']);
    expect(r.options.v).toBe(true);
  });
});
