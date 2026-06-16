'use strict';

const { decodeRecurrenceRule, describe: describeRule } = require('../../src/lib/rrule');

// Minimal real-format Things recurrence plist.
const plist = ({ fu, fa, of = '' }) =>
  Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>` +
      `<key>fa</key><integer>${fa}</integer>` +
      `<key>fu</key><integer>${fu}</integer>` +
      `<key>of</key><array>${of}</array>` +
      `</dict></plist>`,
    'utf8'
  );

describe('decodeRecurrenceRule', () => {
  test('returns UNKNOWN for empty buffer', () => {
    expect(decodeRecurrenceRule(null)).toEqual({ freq: 'UNKNOWN', interval: 1 });
    expect(decodeRecurrenceRule(Buffer.alloc(0))).toEqual({ freq: 'UNKNOWN', interval: 1 });
  });

  test('decodes daily / weekly / monthly / yearly from fu (NSCalendarUnit)', () => {
    expect(decodeRecurrenceRule(plist({ fu: 16, fa: 1 }))).toMatchObject({ freq: 'DAILY', interval: 1 });
    expect(decodeRecurrenceRule(plist({ fu: 256, fa: 1 }))).toMatchObject({ freq: 'WEEKLY', interval: 1 });
    expect(decodeRecurrenceRule(plist({ fu: 8, fa: 1 }))).toMatchObject({ freq: 'MONTHLY', interval: 1 });
    expect(decodeRecurrenceRule(plist({ fu: 4, fa: 1 }))).toMatchObject({ freq: 'YEARLY', interval: 1 });
  });

  test('reads the interval from fa', () => {
    expect(decodeRecurrenceRule(plist({ fu: 256, fa: 2 }))).toMatchObject({ freq: 'WEEKLY', interval: 2 });
  });

  test('extracts weekday and day-of-month from the `of` array', () => {
    const weekly = decodeRecurrenceRule(plist({ fu: 256, fa: 1, of: '<dict><key>wd</key><integer>6</integer></dict>' }));
    expect(weekly.weekday).toBe(6);
    const monthly = decodeRecurrenceRule(plist({ fu: 8, fa: 1, of: '<dict><key>dy</key><integer>18</integer></dict>' }));
    expect(monthly.dayOfMonth).toBe(18);
  });

  test('accepts a string rule as well as a Buffer', () => {
    expect(decodeRecurrenceRule(plist({ fu: 16, fa: 1 }).toString('utf8'))).toMatchObject({ freq: 'DAILY' });
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
