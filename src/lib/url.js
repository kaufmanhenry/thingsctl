'use strict';

// Pure URL builders for the Things URL scheme.
// https://culturedcode.com/things/support/articles/2803573/
//
// Notes:
// - URLSearchParams encodes spaces as `+`. Things requires `%20`. We post-process.
// - auth-token is required for `update` / `update-project` / `json`. It is
//   threaded in by callers (see lib/token.js). It is *not* embedded here so
//   tests can snapshot URL strings without secrets.

function _encode(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  return usp.toString().replace(/\+/g, '%20');
}

function buildAddUrl(params) {
  return `things:///add?${_encode(params)}`;
}

function buildUpdateUrl(params) {
  return `things:///update?${_encode(params)}`;
}

// Things applies `update` to to-dos only; projects need `update-project`.
function buildUpdateProjectUrl(params) {
  return `things:///update-project?${_encode(params)}`;
}

function buildShowUrl(params) {
  return `things:///show?${_encode(params)}`;
}

function buildAddProjectUrl(params) {
  return `things:///add-project?${_encode(params)}`;
}

// Bulk JSON import — supports nested projects/headings/tasks/checklists.
// `data` is the JS array as documented in the URL-scheme JSON section.
function buildJsonUrl({ data, authToken, reveal }) {
  const params = { data: JSON.stringify(data) };
  if (authToken) params['auth-token'] = authToken;
  if (reveal != null) params.reveal = reveal ? 'true' : 'false';
  return `things:///json?${_encode(params)}`;
}

module.exports = {
  buildAddUrl,
  buildUpdateUrl,
  buildUpdateProjectUrl,
  buildShowUrl,
  buildAddProjectUrl,
  buildJsonUrl,
};
