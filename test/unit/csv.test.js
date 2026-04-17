'use strict';

const csv = require('../../src/lib/csv');

describe('csv.quoteField', () => {
  test('passes plain values through', () => {
    expect(csv.quoteField('hello')).toBe('hello');
    expect(csv.quoteField(42)).toBe('42');
  });
  test('quotes when comma present', () => {
    expect(csv.quoteField('a,b')).toBe('"a,b"');
  });
  test('quotes and escapes embedded quote', () => {
    expect(csv.quoteField('he said "hi"')).toBe('"he said ""hi"""');
  });
  test('quotes when newline present', () => {
    expect(csv.quoteField('line1\nline2')).toBe('"line1\nline2"');
    expect(csv.quoteField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
  test('null/undefined become empty', () => {
    expect(csv.quoteField(null)).toBe('');
    expect(csv.quoteField(undefined)).toBe('');
  });
  test('round trip with quote followed by comma', () => {
    // Was the legacy bug: "foo", bar produced unbalanced quoting.
    expect(csv.quoteField('"foo", bar')).toBe('"""foo"", bar"');
  });
});

describe('csv.format', () => {
  test('joins rows', () => {
    const out = csv.format([
      ['a', 'b'],
      ['c,1', 'd"e'],
    ]);
    expect(out).toBe('a,b\n"c,1","d""e"');
  });
});
