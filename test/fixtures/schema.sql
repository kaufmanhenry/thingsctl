-- Minimal schema for thingsctl tests. Captures only the columns thingsctl
-- reads. Faithful to the live Things 3 schema for those columns.

CREATE TABLE TMArea (
    uuid       TEXT PRIMARY KEY,
    title      TEXT,
    visible    INTEGER,
    "index"    INTEGER,
    cachedTags BLOB
);

CREATE TABLE TMTag (
    uuid     TEXT PRIMARY KEY,
    title    TEXT,
    shortcut TEXT,
    usedDate REAL,
    parent   TEXT,
    "index"  INTEGER
);

CREATE TABLE TMTaskTag (
    tasks TEXT NOT NULL,
    tags  TEXT NOT NULL
);
CREATE INDEX index_TMTaskTag_tasks ON TMTaskTag(tasks);

CREATE TABLE TMTask (
    uuid                              TEXT PRIMARY KEY,
    leavesTombstone                   INTEGER,
    creationDate                      REAL,
    userModificationDate              REAL,
    type                              INTEGER,
    status                            INTEGER,
    stopDate                          REAL,
    trashed                           INTEGER,
    title                             TEXT,
    notes                             TEXT,
    notesSync                         INTEGER,
    cachedTags                        BLOB,
    start                             INTEGER,
    startDate                         INTEGER,
    startBucket                       INTEGER,
    reminderTime                      INTEGER,
    lastReminderInteractionDate       REAL,
    deadline                          INTEGER,
    deadlineSuppressionDate           INTEGER,
    t2_deadlineOffset                 INTEGER,
    "index"                           INTEGER,
    todayIndex                        INTEGER,
    todayIndexReferenceDate           INTEGER,
    area                              TEXT,
    project                           TEXT,
    heading                           TEXT,
    contact                           TEXT,
    untrashedLeafActionsCount         INTEGER,
    openUntrashedLeafActionsCount     INTEGER,
    checklistItemsCount               INTEGER,
    openChecklistItemsCount           INTEGER,
    rt1_repeatingTemplate             TEXT,
    rt1_recurrenceRule                BLOB,
    rt1_instanceCreationStartDate     INTEGER,
    rt1_instanceCreationPaused        INTEGER,
    rt1_instanceCreationCount         INTEGER,
    rt1_afterCompletionReferenceDate  INTEGER,
    rt1_nextInstanceStartDate         INTEGER,
    experimental                      BLOB,
    repeater                          BLOB,
    repeaterMigrationDate             REAL
);

CREATE TABLE TMChecklistItem (
    uuid                 TEXT PRIMARY KEY,
    userModificationDate REAL,
    creationDate         REAL,
    title                TEXT,
    status               INTEGER,
    stopDate             REAL,
    "index"              INTEGER,
    task                 TEXT
);
