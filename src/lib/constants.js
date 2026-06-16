'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const GROUP_CONTAINER = path.join(
  os.homedir(),
  'Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac'
);
const DB_LEAF = 'Things Database.thingsdatabase/main.sqlite';

// The `ThingsData-XXXXX` directory suffix is randomized per Things install, so
// it cannot be hardcoded. Resolution order:
//   1. THINGS_DB_PATH env var (explicit override)
//   2. Auto-detect the live DB under the group container (skipping Backups)
//   3. Fall back to the original hardcoded path (so errors stay informative)
function resolveDbPath() {
  if (process.env.THINGS_DB_PATH) return process.env.THINGS_DB_PATH;

  try {
    const candidates = fs
      .readdirSync(GROUP_CONTAINER)
      .filter((name) => name.startsWith('ThingsData-'))
      .map((name) => path.join(GROUP_CONTAINER, name, DB_LEAF))
      .filter((p) => fs.existsSync(p));
    if (candidates.length) return candidates[0];
  } catch {
    // Group container missing — fall through to the legacy default.
  }

  return path.join(GROUP_CONTAINER, 'ThingsData-C1ON7', DB_LEAF);
}

const DB_PATH = resolveDbPath();

const TYPE = { TASK: 0, PROJECT: 1, HEADING: 2 };
const STATUS = { OPEN: 0, CANCELED: 2, COMPLETED: 3 };
const START = { INBOX: 0, ANYTIME: 1, SOMEDAY: 2 };
const START_BUCKET = { TODAY: 0, EVENING: 1 };

module.exports = { DB_PATH, TYPE, STATUS, START, START_BUCKET };
