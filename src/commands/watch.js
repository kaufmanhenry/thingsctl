'use strict';

const db = require('../lib/db');
const { unixToDate } = require('../lib/dates');

// Polls TMTask.userModificationDate; emits NDJSON for each event detected.
function run(opts = {}) {
  const interval = Math.max(1, parseInt(opts.interval || 5, 10));
  const events = (opts.events || 'completions,additions,modifications').split(',').map((s) => s.trim());
  const wantCompletions = events.includes('completions');
  const wantAdditions = events.includes('additions');
  const wantMods = events.includes('modifications');

  const database = db.open();
  let lastSeen = database.prepare(
    `SELECT COALESCE(MAX(userModificationDate), 0) AS m FROM TMTask`
  ).get().m || 0;
  const startedAt = database.prepare(`SELECT COALESCE(MAX(creationDate), 0) AS m FROM TMTask`).get().m || 0;

  function _emit(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
  }

  function _tick() {
    const rows = database.prepare(`
      SELECT uuid, title, status, type, trashed, creationDate, userModificationDate, stopDate
      FROM TMTask WHERE userModificationDate > ?
      ORDER BY userModificationDate ASC
    `).all(lastSeen);
    for (const r of rows) {
      if (r.userModificationDate > lastSeen) lastSeen = r.userModificationDate;
      if (r.type !== 0) continue;
      const at = unixToDate(r.userModificationDate)?.toISOString();
      if (wantAdditions && r.creationDate >= startedAt) {
        _emit({ event: 'added', uuid: r.uuid, title: r.title, at });
      }
      if (wantCompletions && r.status === 3) {
        _emit({ event: 'completed', uuid: r.uuid, title: r.title, at });
      } else if (wantMods) {
        _emit({ event: 'modified', uuid: r.uuid, title: r.title, status: r.status, at });
      }
    }
  }

  if (opts.once) { _tick(); return null; }
  _emit({ event: 'watch-started', interval });
  const t = setInterval(_tick, interval * 1000);
  // Don't keep node from exiting on SIGINT.
  process.on('SIGINT', () => { clearInterval(t); _emit({ event: 'watch-stopped' }); process.exit(0); });
  return null; // never returns; held open by setInterval
}

module.exports = {
  run,
  // Watch is a streaming command; not exposed via MCP (MCP tools are unary).
};
