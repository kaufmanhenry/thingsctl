'use strict';

// name → lazy require map. Keeps the cold-start cost off any single command.
const COMMANDS = {
  today:     () => require('./today'),
  inbox:     () => require('./inbox'),
  anytime:   () => require('./anytime'),
  someday:   () => require('./someday'),
  upcoming:  () => require('./upcoming'),
  due:       () => require('./due'),
  overdue:   () => require('./overdue'),
  evening:   () => require('./evening'),
  repeating: () => require('./repeating'),
  logbook:   () => require('./logbook'),
  projects:  () => require('./projects'),
  project:   () => require('./project'),
  areas:     () => require('./areas'),
  tags:      () => require('./tags'),
  search:    () => require('./search'),
  show:      () => require('./show'),
  stats:     () => require('./stats'),
  add:       () => require('./add'),
  update:    () => require('./update'),
  complete:  () => require('./complete'),
  move:      () => require('./move'),
  tag:       () => require('./tag'),
  export:    () => require('./export'),
  review:    () => require('./review'),
  watch:     () => require('./watch'),
  template:  () => require('./template'),
  clone:     () => require('./template'),
  config:    () => require('./config'),
};

function get(name) {
  const loader = COMMANDS[name];
  if (!loader) return null;
  return loader();
}

function names() {
  return Object.keys(COMMANDS);
}

// Eagerly load all command modules — used only by the MCP server.
function loadAll() {
  const out = {};
  for (const n of Object.keys(COMMANDS)) out[n] = COMMANDS[n]();
  return out;
}

module.exports = { get, names, loadAll };
