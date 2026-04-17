'use strict';

const { decodeRecurrenceRule, describe: describeRule } = require('../../src/lib/rrule');

describe('decodeRecurrenceRule', () => {
  test('returns UNKNOWN for empty buffer', () => {
    expect(decodeRecurrenceRule(null)).toEqual({ freq: 'UNKNOWN', interval: 1 });
    expect(decodeRecurrenceRule(Buffer.alloc(0))).toEqual({ freq: 'UNKNOWN', interval: 1 });
  });

  test('describes UNKNOWN as "repeats"', () => {
    expect(describeRule({ freq: 'UNKNOWN', interval: 1 })).toBe('repeats');
  });

  test('describes WEEKLY with interval 1', () => {
    expect(describeRule({ freq: 'WEEKLY', interval: 1 })).toBe('every week');
  });

  test('describes MONTHLY with interval 3', () => {
    expect(describeRule({ freq: 'MONTHLY', interval: 3 })).toBe('every 3 months');
  });
});
