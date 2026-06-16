'use strict';

const { encodeThingsDate, packedTomorrow } = require('./dates');

// Canonical SQL for every list view.
//
// Every read returns rows enriched with:
//   tagList     (comma-joined tag titles)
//   projectName (string or null)
//   areaName    (string or null)
//
// This collapses the legacy N+1 in applyFilters(): filters are pushed into SQL
// and the formatter never has to fetch tags/project/area per row.

const SELECT_TASK_FIELDS = `
  t.uuid, t.title, t.notes, t.status, t.start, t.startBucket,
  t.startDate, t.deadline, t.todayIndex, t.area, t.project,
  t.creationDate, t.userModificationDate, t.stopDate,
  t.checklistItemsCount, t.openChecklistItemsCount,
  t.rt1_recurrenceRule, t.rt1_nextInstanceStartDate,
  COALESCE((
    SELECT GROUP_CONCAT(tg.title, ',')
    FROM TMTaskTag tt
    JOIN TMTag tg ON tg.uuid = tt.tags
    WHERE tt.tasks = t.uuid
  ), '') AS tagList,
  (SELECT title FROM TMArea WHERE uuid = t.area)              AS areaName,
  (SELECT title FROM TMTask  WHERE uuid = t.project AND type = 1) AS projectName
`;

// Compose WHERE clauses from filter options (--tag, --area, --project).
// Returns { sql, params } that the caller appends to its base query.
function _filterClauses({ tag, area, project }) {
  const parts = [];
  const params = [];
  if (tag) {
    parts.push(`EXISTS (
      SELECT 1 FROM TMTaskTag tt
      JOIN TMTag tg ON tg.uuid = tt.tags
      WHERE tt.tasks = t.uuid AND LOWER(tg.title) LIKE LOWER(?)
    )`);
    params.push(`%${tag}%`);
  }
  if (area) {
    parts.push(`EXISTS (
      SELECT 1 FROM TMArea a
      WHERE a.uuid = t.area AND LOWER(a.title) LIKE LOWER(?)
    )`);
    params.push(`%${area}%`);
  }
  if (project) {
    parts.push(`EXISTS (
      SELECT 1 FROM TMTask p
      WHERE p.uuid = t.project AND p.type = 1 AND LOWER(p.title) LIKE LOWER(?)
    )`);
    params.push(`%${project}%`);
  }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

const BASE = `FROM TMTask t WHERE t.status = 0 AND t.trashed = 0 AND t.type = 0`;

// TODAY: Anytime to-dos scheduled for today or earlier (overdue-scheduled roll
// into Today, exactly as the Things app does). startDate is a packed calendar
// date, so the window is (0, packedTomorrow). todayIndex is only a sort key here
// (Today rows carry negative values); it is NOT a membership predicate — a
// positive todayIndex marks recurrence-template rows that Things hides.
function todayTasks(db, filters = {}) {
  const tomorrow = packedTomorrow();
  const f = _filterClauses(filters);
  const sql = `
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE}
      AND t.start = 1
      AND t.startDate IS NOT NULL AND t.startDate > 0 AND t.startDate < ?
      ${f.sql}
    ORDER BY t.todayIndex ASC, t.startDate ASC
  `;
  return db.prepare(sql).all(tomorrow, ...f.params);
}

function inboxTasks(db, filters = {}) {
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.start = 0 ${f.sql}
    ORDER BY t.creationDate DESC
  `).all(...f.params);
}

function anytimeTasks(db, filters = {}) {
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.start = 1 AND t.todayIndex <= 0 AND t.project IS NULL ${f.sql}
    ORDER BY t."index" ASC
  `).all(...f.params);
}

function somedayTasks(db, filters = {}) {
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.start = 2 AND t.todayIndex <= 0
      AND t.startDate IS NULL
      ${f.sql}
    ORDER BY t."index" ASC
  `).all(...f.params);
}

function upcomingTasks(db, filters = {}) {
  const tomorrow = packedTomorrow();
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.startDate IS NOT NULL AND t.startDate >= ? AND t.todayIndex <= 0 ${f.sql}
    ORDER BY t.startDate ASC
  `).all(tomorrow, ...f.params);
}

function dueTasks(db, filters = {}) {
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.deadline IS NOT NULL AND t.deadline > 0 ${f.sql}
    ORDER BY t.deadline ASC
  `).all(...f.params);
}

function overdueTasks(db, filters = {}) {
  const today = encodeThingsDate();
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.deadline IS NOT NULL AND t.deadline > 0 AND t.deadline < ? ${f.sql}
    ORDER BY t.deadline ASC
  `).all(today, ...f.params);
}

function eveningTasks(db, filters = {}) {
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.startBucket = 1 AND t.todayIndex <= 0 ${f.sql}
    ORDER BY t."index" ASC
  `).all(...f.params);
}

function repeatingTasks(db, filters = {}) {
  const f = _filterClauses(filters);
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.rt1_recurrenceRule IS NOT NULL ${f.sql}
    ORDER BY t.title ASC
  `).all(...f.params);
}

function logbookTasks(db, { limit = 20, sinceUnix } = {}) {
  if (sinceUnix != null) {
    return db.prepare(`
      SELECT ${SELECT_TASK_FIELDS}
      FROM TMTask t WHERE t.status = 3 AND t.trashed = 0 AND t.type = 0
        AND t.stopDate >= ?
      ORDER BY t.stopDate DESC
    `).all(sinceUnix);
  }
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    FROM TMTask t WHERE t.status = 3 AND t.trashed = 0 AND t.type = 0
    ORDER BY t.stopDate DESC
    LIMIT ?
  `).all(limit);
}

function searchTasks(db, query) {
  const pattern = `%${query}%`;
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND (t.title LIKE ? OR t.notes LIKE ?)
    ORDER BY t.creationDate DESC
  `).all(pattern, pattern);
}

function projectTasks(db, projectUuid) {
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.project = ?
    ORDER BY t."index" ASC
  `).all(projectUuid);
}

function areaTasks(db, areaUuid) {
  return db.prepare(`
    SELECT ${SELECT_TASK_FIELDS}
    ${BASE} AND t.area = ?
    ORDER BY t."index" ASC
  `).all(areaUuid);
}

function listProjects(db) {
  return db.prepare(`
    SELECT t.uuid, t.title, t.area,
      (SELECT COUNT(*) FROM TMTask sub
       WHERE sub.project = t.uuid AND sub.status = 0 AND sub.trashed = 0) AS taskCount,
      (SELECT title FROM TMArea WHERE uuid = t.area) AS areaName
    FROM TMTask t
    WHERE t.status = 0 AND t.trashed = 0 AND t.type = 1
    ORDER BY t."index" ASC
  `).all();
}

function listAreas(db) {
  return db.prepare(`
    SELECT a.uuid, a.title,
      (SELECT COUNT(*) FROM TMTask t
       WHERE t.area = a.uuid AND t.status = 0 AND t.trashed = 0 AND t.type = 0) AS taskCount,
      (SELECT COUNT(*) FROM TMTask t
       WHERE t.area = a.uuid AND t.status = 0 AND t.trashed = 0 AND t.type = 1) AS projectCount
    FROM TMArea a
    ORDER BY a."index" ASC
  `).all();
}

function listTags(db) {
  return db.prepare(`
    SELECT t.uuid, t.title, t.shortcut,
      (SELECT COUNT(*) FROM TMTaskTag tt
        JOIN TMTask task ON tt.tasks = task.uuid
        WHERE tt.tags = t.uuid AND task.status = 0 AND task.trashed = 0) AS taskCount
    FROM TMTag t
    ORDER BY t.title ASC
  `).all();
}

function findArea(db, name) {
  return db.prepare(`SELECT uuid, title FROM TMArea WHERE title LIKE ? LIMIT 1`)
    .get(`%${name}%`);
}

function findProject(db, name) {
  // Prefix match preferred over substring; first row otherwise.
  const prefix = db.prepare(`
    SELECT uuid, title FROM TMTask
    WHERE type = 1 AND status = 0 AND trashed = 0 AND title LIKE ?
    LIMIT 1
  `).get(`${name}%`);
  if (prefix) return prefix;
  return db.prepare(`
    SELECT uuid, title FROM TMTask
    WHERE type = 1 AND status = 0 AND trashed = 0 AND title LIKE ?
    LIMIT 1
  `).get(`%${name}%`);
}

function getTask(db, uuid) {
  return db.prepare(`SELECT ${SELECT_TASK_FIELDS} FROM TMTask t WHERE t.uuid = ?`).get(uuid);
}

function getChecklist(db, taskUuid) {
  return db.prepare(`SELECT * FROM TMChecklistItem WHERE task = ? ORDER BY "index" ASC`).all(taskUuid);
}

function getProject(db, uuid) {
  return db.prepare(`
    SELECT t.uuid, t.title, t.notes, t.area,
      (SELECT title FROM TMArea WHERE uuid = t.area) AS areaName
    FROM TMTask t
    WHERE t.uuid = ? AND t.type = 1
  `).get(uuid);
}

function getProjectStructure(db, projectUuid) {
  // Tasks + headings inside the project, in order.
  return db.prepare(`
    SELECT t.uuid, t.title, t.notes, t.type, t.heading, t.status,
      COALESCE((SELECT GROUP_CONCAT(tg.title, ',')
                FROM TMTaskTag tt JOIN TMTag tg ON tg.uuid = tt.tags
                WHERE tt.tasks = t.uuid), '') AS tagList
    FROM TMTask t
    WHERE t.project = ? AND t.trashed = 0 AND t.status = 0
    ORDER BY t."index" ASC
  `).all(projectUuid);
}

module.exports = {
  todayTasks, inboxTasks, anytimeTasks, somedayTasks, upcomingTasks,
  dueTasks, overdueTasks, eveningTasks, repeatingTasks,
  logbookTasks, searchTasks,
  projectTasks, areaTasks,
  listProjects, listAreas, listTags,
  findArea, findProject,
  getTask, getProject, getProjectStructure, getChecklist,
};
