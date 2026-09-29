'use strict';

class ThingsCtlError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ThingsCtlError';
    this.code = code || 'E_THINGSCTL';
  }
}

class TaskNotFoundError extends ThingsCtlError {
  constructor(id) {
    super(`Task not found: ${id}`, 'E_NOT_FOUND');
    this.id = id;
  }
}

class AmbiguousIdError extends ThingsCtlError {
  constructor(id, matches) {
    const sample = matches.slice(0, 5)
      .map((m) => `  ${m.uuid.slice(0, 8)}…  ${m.title}`)
      .join('\n');
    const more = matches.length > 5 ? `\n  …and ${matches.length - 5} more` : '';
    super(
      `Ambiguous id "${id}" matches ${matches.length} tasks:\n${sample}${more}\n` +
        `Use a longer prefix, or pass --yes-first to act on the first match.`,
      'E_AMBIGUOUS'
    );
    this.id = id;
    this.matches = matches;
  }
}

class ThingsUrlError extends ThingsCtlError {
  constructor(message) {
    super(message, 'E_THINGS_URL');
  }
}

class TokenMissingError extends ThingsCtlError {
  constructor() {
    super(
      'Things auth token not configured.\n' +
        '  Get yours from Things → Settings → General → Enable Things URLs → Manage.\n' +
        '  Then run: thingsctl config set-token <token>\n' +
        '  Or set the THINGS_AUTH_TOKEN environment variable.',
      'E_NO_TOKEN'
    );
  }
}

module.exports = {
  ThingsCtlError,
  TaskNotFoundError,
  AmbiguousIdError,
  ThingsUrlError,
  TokenMissingError,
};
