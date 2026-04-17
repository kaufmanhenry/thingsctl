'use strict';

require('./setup');
const stats = require('../../src/commands/stats');

describe('stats', () => {
  test('returns counts across all lists', () => {
    const out = stats.run({ json: true });
    expect(out).toMatchObject({
      inbox: 2,
      someday: 1,
      evening: 1,
      overdue: 1,
      projects: 1,
    });
    expect(out.totalOpen).toBeGreaterThan(0);
  });
});
