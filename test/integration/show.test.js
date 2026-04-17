'use strict';

require('./setup');
const show = require('../../src/commands/show');

describe('show', () => {
  test('returns task details by full uuid', () => {
    const out = show.run('t-checklist-1', { json: true });
    expect(out.title).toBe('Trip prep');
    expect(out.checklist).toEqual([
      { title: 'Passport', completed: false },
      { title: 'Tickets', completed: false },
      { title: 'Charger', completed: true },
    ]);
  });

  test('throws on ambiguous prefix', () => {
    expect(() => show.run('t-', { json: true })).toThrow(/Ambiguous/);
  });

  test('throws on missing prefix', () => {
    expect(() => show.run('zzzz', { json: true })).toThrow(/not found/i);
  });
});
