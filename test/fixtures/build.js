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

// Frozen "now" for stable date-relative tests: 2026-04-15 12:00 local.
const NOW_UNIX = Math.floor(new Date(2026, 3, 15, 12, 0, 0).getTime() / 1000);
const COCOA = (u) => u - 978307200;
const TODAY_START = Math.floor(new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000);
const TODAY_END = TODAY_START + 86400;

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
    'p-001', 1, 0, 'Launch', null, 1, 0, 0, 0, 1, 0, 'a-work', null, null,
    COCOA(NOW_UNIX - 86400 * 30), COCOA(NOW_UNIX - 86400), null, 0, 0, null, 0
  );

  // Heading inside p-001
  insertTask.run(
    'h-001', 2, 0, 'Engineering', null, 1, 0, 0, 0, 1, 0, null, 'p-001', null,
    COCOA(NOW_UNIX - 86400 * 25), COCOA(NOW_UNIX - 86400 * 25), null, 0, 0, null, 0
  );

  // Today task (todayIndex > 0), in project, has tag Deep
  insertTask.run(
    't-today-1', 0, 0, 'Ship the demo', 'Demo for stakeholders', 1, 0, 0, 0, 1, 5, null, 'p-001', 'h-001',
    COCOA(NOW_UNIX - 86400 * 3), COCOA(NOW_UNIX - 3600), null, 0, 0, null, 0
  );
  db.prepare(`INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)`).run('t-today-1', 'tag-deep');

  // Today task scheduled for today
  insertTask.run(
    't-today-2', 0, 0, 'Standup', null, 1, TODAY_START, 0, 0, 2, 0, 'a-work', null, null,
    COCOA(NOW_UNIX - 86400 * 2), COCOA(NOW_UNIX - 7200), null, 0, 0, null, 0
  );

  // Inbox task
  insertTask.run(
    't-inbox-1', 0, 0, 'Quick capture', null, 0, 0, 0, 0, 1, 0, null, null, null,
    COCOA(NOW_UNIX - 3600), COCOA(NOW_UNIX - 3600), null, 0, 0, null, 0
  );

  // Anytime task in Home area
  insertTask.run(
    't-anytime-1', 0, 0, 'Replace lightbulb', null, 1, 0, 0, 0, 3, 0, 'a-home', null, null,
    COCOA(NOW_UNIX - 86400 * 5), COCOA(NOW_UNIX - 86400 * 5), null, 0, 0, null, 0
  );
  db.prepare(`INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)`).run('t-anytime-1', 'tag-errand');

  // Someday task (no anytime version anywhere — should not appear in today)
  insertTask.run(
    't-someday-1', 0, 0, 'Learn Mandarin', null, 2, 0, 0, 0, 1, 0, 'a-home', null, null,
    COCOA(NOW_UNIX - 86400 * 30), COCOA(NOW_UNIX - 86400 * 30), null, 0, 0, null, 0
  );

  // Upcoming task
  const tomorrow = TODAY_START + 86400 * 2;
  insertTask.run(
    't-upcoming-1', 0, 0, 'Future thing', null, 1, tomorrow, 0, 0, 1, 0, 'a-work', null, null,
    COCOA(NOW_UNIX - 86400 * 4), COCOA(NOW_UNIX - 86400 * 4), null, 0, 0, null, 0
  );

  // Overdue task
  const yesterday = TODAY_START - 86400 * 2;
  insertTask.run(
    't-overdue-1', 0, 0, 'Past due', null, 1, 0, 0, yesterday, 1, 0, 'a-work', null, null,
    COCOA(NOW_UNIX - 86400 * 10), COCOA(NOW_UNIX - 86400), null, 0, 0, null, 0
  );
  db.prepare(`INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)`).run('t-overdue-1', 'tag-urgent');

  // Due (future deadline)
  insertTask.run(
    't-due-1', 0, 0, 'Deadline soon', null, 1, 0, 0, TODAY_START + 86400 * 3, 1, 0, 'a-work', null, null,
    COCOA(NOW_UNIX - 86400 * 4), COCOA(NOW_UNIX - 86400), null, 0, 0, null, 0
  );

  // Evening task
  insertTask.run(
    't-evening-1', 0, 0, 'Read book', null, 1, 0, 1, 0, 1, 0, 'a-home', null, null,
    COCOA(NOW_UNIX - 86400), COCOA(NOW_UNIX - 3600), null, 0, 0, null, 0
  );

  // Repeating task with a stub recurrence rule blob
  insertTask.run(
    't-repeat-1', 0, 0, 'Standup recurring', null, 1, 0, 0, 0, 1, 0, 'a-work', null, null,
    COCOA(NOW_UNIX - 86400 * 30), COCOA(NOW_UNIX - 86400), null, 0, 0,
    Buffer.from('frequency\x00\x01interval\x00\x01'), TODAY_START + 86400 * 1
  );

  // Completed task (logbook)
  insertTask.run(
    't-done-1', 0, 3, 'Deployed v1', null, 1, 0, 0, 0, 1, 0, null, null, null,
    COCOA(NOW_UNIX - 86400 * 2), COCOA(NOW_UNIX - 86400), COCOA(NOW_UNIX - 86400),
    0, 0, null, 0
  );

  // Task with a checklist
  insertTask.run(
    't-checklist-1', 0, 0, 'Trip prep', null, 1, 0, 0, 0, 1, 0, 'a-home', null, null,
    COCOA(NOW_UNIX - 86400), COCOA(NOW_UNIX - 86400), null, 3, 2, null, 0
  );
  const insertChecklist = db.prepare(`INSERT INTO TMChecklistItem (uuid, title, status, "index", task) VALUES (?, ?, ?, ?, ?)`);
  insertChecklist.run('c-001', 'Passport', 0, 1, 't-checklist-1');
  insertChecklist.run('c-002', 'Tickets', 0, 2, 't-checklist-1');
  insertChecklist.run('c-003', 'Charger', 3, 3, 't-checklist-1');

  // Task with embedded comma/quote/newline in notes (CSV escaping). In Inbox.
  insertTask.run(
    't-csv-1', 0, 0, 'CSV edge case', 'has "quotes", and a comma\nand a newline', 0, 0, 0, 0, 2, 0, null, null, null,
    COCOA(NOW_UNIX - 86400), COCOA(NOW_UNIX - 86400), null, 0, 0, null, 0
  );

  db.close();
  return { OUT, NOW_UNIX, TODAY_START, TODAY_END };
}

if (require.main === module) {
  const r = build();
  console.log(`Wrote ${r.OUT}`);
}

module.exports = { build, NOW_UNIX, TODAY_START, TODAY_END, OUT };
