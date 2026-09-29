'use strict';

const { redactToken } = require('../../src/lib/exec');

// macOS `open` echoes the whole url back on failure, and our urls carry
// auth-token=<secret>. That text lands in CLI stderr AND in MCP tool output,
// i.e. a model transcript. It must never carry the token.
describe('redactToken', () => {
  test('strips the token out of an open(1) failure message', () => {
    const msg =
      'No application knows how to open URL things:///update?id=abc&auth-token=SECRET123 ' +
      '(Error Domain=NSOSStatusErrorDomain Code=-10814)';
    const out = redactToken(msg);
    expect(out).not.toContain('SECRET123');
    expect(out).toContain('auth-token=<redacted>');
    expect(out).toContain('id=abc');
  });

  test('handles the token at the end of the url', () => {
    expect(redactToken('things:///update?auth-token=ZZZ')).toBe('things:///update?auth-token=<redacted>');
  });

  test('redacts every occurrence', () => {
    const out = redactToken('a auth-token=ONE b auth-token=TWO c');
    expect(out).not.toMatch(/ONE|TWO/);
  });

  test('leaves messages without a token alone', () => {
    expect(redactToken('Is Things 3 installed?')).toBe('Is Things 3 installed?');
  });
});
