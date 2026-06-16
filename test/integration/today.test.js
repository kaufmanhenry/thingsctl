'use strict';

require('./setup');
const today = require('../../src/commands/today');

describe('today', () => {
  test('returns tasks scheduled for today or earlier', () => {
    const out = today.run({ json: true });
    const titles = out.map((t) => t.title).sort();
    expect(titles).toEqual(['Ship the demo', 'Standup']);
  });

  test('excludes Someday-only tasks', () => {
    const out = today.run({ json: true });
    expect(out.find((t) => t.title === 'Learn Mandarin')).toBeUndefined();
  });

  test('excludes recurrence templates (positive todayIndex is not a membership flag)', () => {
    const out = today.run({ json: true });
    expect(out.find((t) => t.title === 'Weekly review template')).toBeUndefined();
  });

  test('--tag Deep filters to one task', () => {
    const out = today.run({ json: true, tag: 'Deep' });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Ship the demo');
  });

  test('--ids returns just uuids', () => {
    const ids = today.run({ ids: true });
    expect(ids.sort()).toEqual(['t-today-1', 't-today-2']);
  });
});
