'use strict';

// Build a deterministic SQLite fixture that mirrors a tiny slice of Things.
// Run as: `npm run fixture` or `node test/fixtures/build.js`.
// The output file lives next to this script and is committed.

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SCHEMA = fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8');
const OUT = path.join(HERE, 'things.sqlite');

// "Now" rolls forward with wall-clock time so date-relative queries (today,
// upcoming, overdue, evening) always see the seeded rows in the right state.
// Tests must rebuild the fixture before each run — see package.json `test`.
//
// Encodings mirror the real Things 3 schema:
//   - timestamp columns (creationDate, userModificationDate, stopDate) → Unix seconds
//   - calendar-date columns (startDate, deadline)                      → bit-packed dates
const _now = new Date();
const NOW_UNIX = Math.floor(_now.getTime() / 1000);
const TODAY_MIDNIGHT = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
const TODAY_START = Math.floor(TODAY_MIDNIGHT.getTime() / 1000);
const TODAY_END = TODAY_START + 86400;

// Bit-packed Things calendar date: (year<<16)|(month<<12)|(day<<7).
const PACK = (date) => (date.getFullYear() << 16) | ((date.getMonth() + 1) << 12) | (date.getDate() << 7);
const PACK_DAYS = (offset) => {
  const d = new Date(TODAY_MIDNIGHT);
  d.setDate(d.getDate() + offset);
  return PACK(d);
};
const PACKED_TODAY = PACK(TODAY_MIDNIGHT);

function build() {
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  const db = new Database(OUT);
  db.exec(SCHEMA);

  // Areas
  const insertArea = db.prepare(`INSERT INTO TMArea (uuid, title, visible, "index") VALUES (?, ?, 1, ?)`);
  insertArea.run('a-work', 'Work', 1);
  insertArea.run('a-home', 'Home', 2);

  // Tags
  const insertTag = db.prepare(`INSERT INTO TMTag (uuid, title, shortcut, "index") VALUES (?, ?, ?, ?)`);
  insertTag.run('tag-deep', 'Deep', null, 1);
  insertTag.run('tag-urgent', 'Urgent', 'u', 2);
  insertTag.run('tag-errand', 'Errand', null, 3);

  // Project (in Work area)
  const insertTask = db.prepare(`INSERT INTO TMTask
    (uuid, type, status, trashed, title, notes, start, startDate, startBucket,
     deadline, "index", todayIndex, area, project, heading,
     creationDate, userModificationDate, stopDate,
     checklistItemsCount, openChecklistItemsCount,
     rt1_recurrenceRule, rt1_nextInstanceStartDate)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // Project p-001 in Work area, no heading
  insertTask.run(
    'p-001', 1, 0, 'Launch', null, 1, null, 0, null, 1, 0, 'a-work', null, null,
    NOW_UNIX - 86400 * 30, NOW_UNIX - 86400, null, 0, 0, null, 0
  );

  // Heading inside p-001
  insertTask.run(
    'h-001', 2, 0, 'Engineering', null, 1, null, 0, null, 1, 0, null, 'p-001', null,
    NOW_UNIX - 86400 * 25, NOW_UNIX - 86400 * 25, null, 0, 0, null, 0
  );

  // Today task scheduled for today, in project, has tag Deep. Today rows carry a
  // NEGATIVE todayIndex (it's a sort key, not a membership flag).
  insertTask.run(
    't-today-1', 0, 0, 'Ship the demo', 'Demo for stakeholders', 1, PACKED_TODAY, 0, null, 1, -100, null, 'p-001', 'h-001',
    NOW_UNIX - 86400 * 3, NOW_UNIX - 3600, null, 0, 0, null, 0
  );
  db.prepare(`INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)`).run('t-today-1', 'tag-deep');

  // Today task scheduled for today
  insertTask.run(
    't-today-2', 0, 0, 'Standup', null, 1, PACKED_TODAY, 0, null, 2, -50, 'a-work', null, null,
    NOW_UNIX - 86400 * 2, NOW_UNIX - 7200, null, 0, 0, null, 0
  );

  // Recurrence template: positive todayIndex but NOT in Today (Things hides
  // these). Regression guard for the "todayIndex>0 leaks into Today" bug.
  insertTask.run(
    't-template-1', 0, 0, 'Weekly review template', null, 2, null, 0, null, 1, 900, 'a-work', null, null,
    NOW_UNIX - 86400 * 60, NOW_UNIX - 86400 * 30, null, 0, 0,
    Buffer.from('frequency\x00\x01interval\x00\x01'), PACK_DAYS(7)
  );

  // Inbox task
  insertTask.run(
    't-inbox-1', 0, 0, 'Quick capture', null, 0, null, 0, null, 1, 0, null, null, null,
    NOW_UNIX - 3600, NOW_UNIX - 3600, null, 0, 0, null, 0
  );

  // Anytime task in Home area
  insertTask.run(
    't-anytime-1', 0, 0, 'Replace lightbulb', null, 1, null, 0, null, 3, 0, 'a-home', null, null,
    NOW_UNIX - 86400 * 5, NOW_UNIX - 86400 * 5, null, 0, 0, null, 0
  );
  db.prepare(`INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)`).run('t-anytime-1', 'tag-errand');

  // Someday task (no anytime version anywhere — should not appear in today)
  insertTask.run(
    't-someday-1', 0, 0, 'Learn Mandarin', null, 2, null, 0, null, 1, 0, 'a-home', null, null,
    NOW_UNIX - 86400 * 30, NOW_UNIX - 86400 * 30, null, 0, 0, null, 0
  );

  // Upcoming task (scheduled two days out)
  insertTask.run(
    't-upcoming-1', 0, 0, 'Future thing', null, 1, PACK_DAYS(2), 0, null, 1, 0, 'a-work', null, null,
    NOW_UNIX - 86400 * 4, NOW_UNIX - 86400 * 4, null, 0, 0, null, 0
  );

  // Overdue task (deadline two days ago)
  insertTask.run(
    't-overdue-1', 0, 0, 'Past due', null, 1, null, 0, PACK_DAYS(-2), 1, 0, 'a-work', null, null,
    NOW_UNIX - 86400 * 10, NOW_UNIX - 86400, null, 0, 0, null, 0
  );
  db.prepare(`INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)`).run('t-overdue-1', 'tag-urgent');

  // Due (future deadline)
  insertTask.run(
    't-due-1', 0, 0, 'Deadline soon', null, 1, null, 0, PACK_DAYS(3), 1, 0, 'a-work', null, null,
    NOW_UNIX - 86400 * 4, NOW_UNIX - 86400, null, 0, 0, null, 0
  );

  // Evening task
  insertTask.run(
    't-evening-1', 0, 0, 'Read book', null, 1, null, 1, null, 1, 0, 'a-home', null, null,
    NOW_UNIX - 86400, NOW_UNIX - 3600, null, 0, 0, null, 0
  );

  // Repeating task with a stub recurrence rule blob
  insertTask.run(
    't-repeat-1', 0, 0, 'Standup recurring', null, 1, null, 0, null, 1, 0, 'a-work', null, null,
    NOW_UNIX - 86400 * 30, NOW_UNIX - 86400, null, 0, 0,
    Buffer.from('frequency\x00\x01interval\x00\x01'), PACK_DAYS(1)
  );

  // Completed task (logbook) — stopDate is Unix seconds
  insertTask.run(
    't-done-1', 0, 3, 'Deployed v1', null, 1, null, 0, null, 1, 0, null, null, null,
    NOW_UNIX - 86400 * 2, NOW_UNIX - 86400, NOW_UNIX - 86400,
    0, 0, null, 0
  );

  // Task with a checklist
  insertTask.run(
    't-checklist-1', 0, 0, 'Trip prep', null, 1, null, 0, null, 1, 0, 'a-home', null, null,
    NOW_UNIX - 86400, NOW_UNIX - 86400, null, 3, 2, null, 0
  );
  const insertChecklist = db.prepare(`INSERT INTO TMChecklistItem (uuid, title, status, "index", task) VALUES (?, ?, ?, ?, ?)`);
  insertChecklist.run('c-001', 'Passport', 0, 1, 't-checklist-1');
  insertChecklist.run('c-002', 'Tickets', 0, 2, 't-checklist-1');
  insertChecklist.run('c-003', 'Charger', 3, 3, 't-checklist-1');

  // Task with embedded comma/quote/newline in notes (CSV escaping). In Inbox.
  insertTask.run(
    't-csv-1', 0, 0, 'CSV edge case', 'has "quotes", and a comma\nand a newline', 0, null, 0, null, 2, 0, null, null, null,
    NOW_UNIX - 86400, NOW_UNIX - 86400, null, 0, 0, null, 0
  );

  db.close();
  return { OUT, NOW_UNIX, TODAY_START, TODAY_END };
}

if (require.main === module) {
  const r = build();
  console.log(`Wrote ${r.OUT}`);
}

module.exports = { build, NOW_UNIX, TODAY_START, TODAY_END, OUT };
