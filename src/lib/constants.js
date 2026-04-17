'use strict';

const path = require('path');
const os = require('os');

const DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/ThingsData-C1ON7/Things Database.thingsdatabase/main.sqlite'
);

const TYPE = { TASK: 0, PROJECT: 1, HEADING: 2 };
const STATUS = { OPEN: 0, CANCELED: 2, COMPLETED: 3 };
const START = { INBOX: 0, ANYTIME: 1, SOMEDAY: 2 };
const START_BUCKET = { TODAY: 0, EVENING: 1 };

module.exports = { DB_PATH, TYPE, STATUS, START, START_BUCKET };
