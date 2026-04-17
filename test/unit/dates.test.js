'use strict';

const {
  COCOA_EPOCH_OFFSET, cocoaToUnix, unixToCocoa, cocoaToDate,
  unixToDate, todayBounds, daysAgoUnix, formatShortDate,
} = require('../../src/lib/dates');

describe('cocoa epoch math', () => {
  test('round trips', () => {
    const u = 1729900800;
    expect(cocoaToUnix(unixToCocoa(u))).toBe(u);
  });

  test('cocoaToUnix adds the offset', () => {
    expect(cocoaToUnix(0)).toBe(COCOA_EPOCH_OFFSET);
  });

  test('cocoaToDate converts to JS Date', () => {
    const d = cocoaToDate(0);
    expect(d.toISOString()).toBe('2001-01-01T00:00:00.000Z');
  });

  test('null inputs return null', () => {
    expect(cocoaToUnix(null)).toBeNull();
    expect(unixToCocoa(null)).toBeNull();
    expect(cocoaToDate(null)).toBeNull();
    expect(unixToDate(null)).toBeNull();
  });

  test('unixToDate ignores Things sentinel values', () => {
    expect(unixToDate(0)).toBeNull();
    expect(unixToDate(999999999)).toBeNull();
  });
});

describe('todayBounds', () => {
  test('returns midnight..next-midnight in unix seconds', () => {
    const noon = new Date(2026, 3, 15, 12, 0, 0); // local midday
    const b = todayBounds(noon);
    expect(b.end - b.start).toBe(86400);
    expect(new Date(b.start * 1000).getHours()).toBe(0);
  });
});

describe('daysAgoUnix', () => {
  test('subtracts 86400 per day', () => {
    const noon = new Date(2026, 3, 15, 12, 0, 0);
    const b = todayBounds(noon);
    expect(daysAgoUnix(7, noon)).toBe(b.start - 7 * 86400);
  });
});

describe('formatShortDate', () => {
  test('formats unix seconds as "Mon D"', () => {
    const aprFifteenth = Math.floor(new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000);
    expect(formatShortDate(aprFifteenth)).toBe('Apr 15');
  });
  test('returns null for sentinel', () => {
    expect(formatShortDate(0)).toBeNull();
    expect(formatShortDate(999999999)).toBeNull();
  });
});
