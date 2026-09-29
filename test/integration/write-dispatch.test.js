'use strict';

// Regression guard for the bug that shipped in 2.0.3 and earlier: every write
// went to `things:///update`, which Things silently ignores when the target is
// a project. `open` still exits 0, so the CLI printed a checkmark for a write
// that never happened. 2.0.4 fixed `update` only; complete, move and tag were
// still broken.
//
// Only waitForWrite is stubbed. snapshot() and notApplied() run for real, so
// this suite also exercises verify.js's SQL against the fixture database and
// pins the exact failure text users see.

jest.mock('../../src/lib/exec', () => ({ openUrl: jest.fn(), redactToken: (s) => s }));
jest.mock('../../src/lib/token', () => ({ getToken: () => 'TESTTOKEN' }));
jest.mock('../../src/lib/verify', () => {
  const actual = jest.requireActual('../../src/lib/verify');
  return { ...actual, waitForWrite: jest.fn(() => ({ ok: true, row: {} })) };
});

require('./setup');
const { openUrl } = require('../../src/lib/exec');
const { waitForWrite } = require('../../src/lib/verify');
const complete = require('../../src/commands/complete');
const update = require('../../src/commands/update');
const move = require('../../src/commands/move');
const tag = require('../../src/commands/tag');

const lastUrl = () => {
  expect(openUrl).toHaveBeenCalled();
  return openUrl.mock.calls[openUrl.mock.calls.length - 1][0];
};

beforeEach(() => {
  openUrl.mockClear();
  waitForWrite.mockClear();
  waitForWrite.mockReturnValue({ ok: true, row: {} });
});

describe('writes route by entity type', () => {
  test('complete: project → update-project', () => {
    complete.run(['p-001']);
    expect(lastUrl()).toContain('things:///update-project?');
    expect(lastUrl()).toContain('completed=true');
  });

  test('complete: to-do → update', () => {
    complete.run(['t-today-1']);
    expect(lastUrl()).toContain('things:///update?');
    expect(lastUrl()).not.toContain('update-project');
  });

  test('update: project → update-project', () => {
    update.run('p-001', { title: 'Launch v2' });
    expect(lastUrl()).toContain('things:///update-project?');
  });

  test('move: project → update-project', () => {
    move.run('p-001', { to: 'today' });
    expect(lastUrl()).toContain('things:///update-project?');
    expect(lastUrl()).toContain('when=today');
  });

  test('tag: project → update-project (still broken on 2.0.4)', () => {
    tag.run('p-001', { add: 'Urgent' });
    expect(lastUrl()).toContain('things:///update-project?');
    expect(lastUrl()).toContain('add-tags=Urgent');
  });

  test('tag: to-do → update', () => {
    tag.run('t-today-1', { add: 'Urgent' });
    expect(lastUrl()).toContain('things:///update?');
    expect(lastUrl()).not.toContain('update-project');
  });
});

describe('an unapplied write is reported as a failure, not a checkmark', () => {
  beforeEach(() => waitForWrite.mockReturnValue({ ok: false, row: {} }));

  test('complete says so', () => {
    const out = complete.run(['t-today-1']);
    expect(out).toContain('✗');
    expect(out).toContain('the URL was accepted but the database never changed');
  });

  test('update says so', () => {
    const out = update.run('t-today-1', { title: 'X' });
    expect(out).toContain('✗');
    expect(out).toContain('the URL was accepted but the database never changed');
  });

  test('move says so', () => {
    const out = move.run('t-today-1', { to: 'today' });
    expect(out).toContain('✗');
    expect(out).not.toContain('Rescheduled');
  });

  test('tag says so', () => {
    const out = tag.run('t-today-1', { add: 'Urgent' });
    expect(out).toContain('✗');
    expect(out).not.toContain('Added tag');
  });
});

describe('headings are refused, not dispatched into a no-op', () => {
  test('complete refuses', () => {
    const out = complete.run(['h-001']);
    expect(out).toMatch(/Cannot complete a heading/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('update refuses', () => {
    expect(() => update.run('h-001', { title: 'X' })).toThrow(/is a heading/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('move refuses', () => {
    expect(() => move.run('h-001', { to: 'today' })).toThrow(/is a heading/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('tag refuses', () => {
    expect(() => tag.run('h-001', { add: 'X' })).toThrow(/is a heading/);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe('re-parenting', () => {
  test('to-do moves into a project by title', () => {
    update.run('t-today-1', { list: 'Launch' });
    expect(lastUrl()).toContain('list=Launch');
  });

  test('list-id takes precedence over list', () => {
    update.run('t-today-1', { list: 'Launch', 'list-id': 'p-001' });
    expect(lastUrl()).toContain('list-id=p-001');
    expect(lastUrl()).not.toContain('&list=Launch');
  });

  test('area-id takes precedence over area', () => {
    update.run('p-001', { area: 'Work', 'area-id': 'a-work' });
    expect(lastUrl()).toContain('area-id=a-work');
    expect(lastUrl()).not.toContain('&area=Work');
  });

  test('list on a project is refused, because Things would drop it silently', () => {
    expect(() => update.run('p-001', { list: 'Somewhere' })).toThrow(/is a project/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('area on a to-do is refused for the same reason', () => {
    expect(() => update.run('t-today-1', { area: 'Somewhere' })).toThrow(/is a to-do/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('a resolvable move is verified against the row, not just "something changed"', () => {
    update.run('t-today-1', { 'list-id': 'p-001' });
    const predicate = waitForWrite.mock.calls[0][1];
    expect(predicate({ project: 'p-001', area: null })).toBe(true);
    expect(predicate({ project: null, area: null })).toBe(false);
  });
});

describe('--completed false reopens, it does not complete', () => {
  test('the string "false" from the CLI parser is not treated as truthy', () => {
    update.run('t-today-1', { completed: 'false' });
    expect(lastUrl()).toContain('completed=false');
    expect(lastUrl()).not.toContain('completed=true');
  });

  test('and the predicate asserts the task ends up OPEN', () => {
    update.run('t-today-1', { completed: 'false' });
    const predicate = waitForWrite.mock.calls[0][1];
    expect(predicate({ status: 0 })).toBe(true);
    expect(predicate({ status: 3 })).toBe(false);
  });

  test('boolean true still completes', () => {
    update.run('t-today-1', { completed: true });
    expect(lastUrl()).toContain('completed=true');
  });
});
