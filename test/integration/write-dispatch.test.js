'use strict';

// Regression guard for the bug that shipped in 2.0.3 and earlier: every write
// went to `things:///update`, which Things silently ignores when the target is
// a project. `open` still exits 0, so the CLI printed a checkmark for a write
// that never happened.

jest.mock('../../src/lib/exec', () => ({ openUrl: jest.fn() }));
jest.mock('../../src/lib/token', () => ({ getToken: () => 'TESTTOKEN' }));
jest.mock('../../src/lib/verify', () => ({
  waitForWrite: () => ({ ok: true, row: {} }),
  snapshot: () => ({ userModificationDate: 1 }),
  modifiedSince: () => () => true,
}));

require('./setup');
const { openUrl } = require('../../src/lib/exec');
const complete = require('../../src/commands/complete');
const update = require('../../src/commands/update');
const move = require('../../src/commands/move');

const lastUrl = () => openUrl.mock.calls[openUrl.mock.calls.length - 1][0];

beforeEach(() => openUrl.mockClear());

describe('complete routes by task type', () => {
  test('a project goes to update-project', () => {
    complete.run(['p-001']);
    expect(lastUrl()).toContain('things:///update-project?');
    expect(lastUrl()).toContain('id=p-001');
    expect(lastUrl()).toContain('completed=true');
  });

  test('a to-do goes to update', () => {
    complete.run(['t-today-1']);
    expect(lastUrl()).toContain('things:///update?');
    expect(lastUrl()).not.toContain('update-project');
  });

  test('a heading is refused rather than silently dropped', () => {
    const out = complete.run(['h-001']);
    expect(out).toMatch(/Cannot complete a heading/);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe('update routes by task type', () => {
  test('a project goes to update-project', () => {
    update.run('p-001', { title: 'Launch v2' });
    expect(lastUrl()).toContain('things:///update-project?');
  });

  test('a to-do goes to update', () => {
    update.run('t-today-1', { title: 'Ship it' });
    expect(lastUrl()).toContain('things:///update?');
  });
});

describe('move routes by task type', () => {
  test('rescheduling a project goes to update-project', () => {
    move.run('p-001', { to: 'today' });
    expect(lastUrl()).toContain('things:///update-project?');
    expect(lastUrl()).toContain('when=today');
  });
});

describe('re-parenting', () => {
  test('a to-do can be moved into a project by title', () => {
    update.run('t-today-1', { list: 'Berlin Trip' });
    expect(lastUrl()).toContain('list=Berlin%20Trip');
  });

  test('a project can be moved into an area', () => {
    update.run('p-001', { area: 'Travel' });
    expect(lastUrl()).toContain('area=Travel');
  });

  test('list on a project is refused, because Things would drop it silently', () => {
    expect(() => update.run('p-001', { list: 'Somewhere' })).toThrow(/is a project/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('area on a to-do is refused for the same reason', () => {
    expect(() => update.run('t-today-1', { area: 'Somewhere' })).toThrow(/is a to-do/);
    expect(openUrl).not.toHaveBeenCalled();
  });
});
