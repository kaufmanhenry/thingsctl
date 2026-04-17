'use strict';

// Force NO_COLOR so the format module emits plain strings.
process.env.NO_COLOR = '1';
// Pretend stdout isn't a TTY so colors are disabled deterministically.
process.stdout.isTTY = false;

const fmt = require('../../src/lib/format');
const { STATUS, START } = require('../../src/lib/constants');

describe('format.formatTask', () => {
  test('renders an open task', () => {
    expect(fmt.formatTask({ title: 'foo', status: STATUS.OPEN, tagList: '', startDate: 0 }))
      .toBe('☐ foo');
  });

  test('shows tags sorted alphabetically', () => {
    const out = fmt.formatTask({ title: 'foo', status: STATUS.OPEN, tagList: 'Zeta,Alpha,Mike' });
    expect(out).toBe('☐ foo #Alpha #Mike #Zeta');
  });

  test('verbose adds project context', () => {
    const out = fmt.formatTask(
      { title: 'foo', status: STATUS.OPEN, tagList: '', projectName: 'Demo' },
      { verbose: true }
    );
    expect(out).toBe('☐ foo [Demo]');
  });
});

describe('format.taskToJson', () => {
  test('converts a task row to a stable shape', () => {
    const row = {
      uuid: 'u-1', title: 't', status: STATUS.COMPLETED, start: START.ANYTIME,
      startDate: 0, deadline: 0, tagList: 'b,a', projectName: null, areaName: null,
      todayIndex: 0, startBucket: 0,
    };
    expect(fmt.taskToJson(row)).toEqual({
      uuid: 'u-1', title: 't', notes: null,
      status: 'completed',
      startDate: null, deadline: null,
      tags: ['a', 'b'],
      project: null, area: null,
      inToday: false, list: 'anytime', evening: false,
    });
  });
});

describe('format.compactLine', () => {
  test('renders 4-char short id + title', () => {
    expect(fmt.compactLine({ uuid: 'abcd1234', title: 'x', status: STATUS.OPEN }))
      .toBe('☐ abcd x');
  });
});
