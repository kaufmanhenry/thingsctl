'use strict';

const url = require('../../src/lib/url');

describe('buildAddUrl', () => {
  test('encodes spaces as %20, not +', () => {
    const u = url.buildAddUrl({ title: 'Buy milk', when: 'next week' });
    expect(u).toContain('title=Buy%20milk');
    expect(u).toContain('when=next%20week');
    expect(u).not.toContain('+');
  });

  test('omits empty/null values', () => {
    const u = url.buildAddUrl({ title: 't', notes: null, tags: '' });
    expect(u).toBe('things:///add?title=t');
  });

  test('encodes special chars correctly', () => {
    const u = url.buildAddUrl({ title: 'Coffee & tea' });
    expect(u).toContain('title=Coffee%20%26%20tea');
  });

  test('encodes unicode', () => {
    const u = url.buildAddUrl({ title: '🎂 Birthday' });
    expect(u).toContain('title=%F0%9F%8E%82%20Birthday');
  });

  test('snapshot full URL with multiple params', () => {
    const u = url.buildAddUrl({
      title: 'Tax filing',
      'auth-token': 'abc',
      when: 'tomorrow',
      deadline: '2026-04-15',
      tags: 'Important,Urgent',
    });
    expect(u).toBe(
      'things:///add?title=Tax%20filing&auth-token=abc&when=tomorrow&deadline=2026-04-15&tags=Important%2CUrgent'
    );
  });
});

describe('buildUpdateUrl', () => {
  test('builds update URL', () => {
    const u = url.buildUpdateUrl({ id: 'abc123', completed: 'true' });
    expect(u).toBe('things:///update?id=abc123&completed=true');
  });
});

describe('buildUpdateProjectUrl', () => {
  test('targets the update-project endpoint', () => {
    const u = url.buildUpdateProjectUrl({ id: 'proj1', title: 'New Name' });
    expect(u).toBe('things:///update-project?id=proj1&title=New%20Name');
  });
});

describe('buildJsonUrl', () => {
  test('encodes nested data as JSON', () => {
    const u = url.buildJsonUrl({
      data: [{ type: 'project', attributes: { title: 'New', items: [] } }],
      authToken: 'k1',
    });
    expect(u).toContain('data=');
    expect(u).toContain('auth-token=k1');
    const decoded = decodeURIComponent(u.split('data=')[1].split('&')[0]);
    expect(JSON.parse(decoded)).toEqual([
      { type: 'project', attributes: { title: 'New', items: [] } },
    ]);
  });
});
