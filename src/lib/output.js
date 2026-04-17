'use strict';

const { formatTask, taskToJson, compactLine, emptyMessage } = require('./format');

// Standard --json/--ids/--compact handling for list commands.
function outputTasks(tasks, opts = {}) {
  if (opts.json) return tasks.map(taskToJson);
  if (opts.ids) return tasks.map((t) => t.uuid);
  if (opts.compact) return tasks.map(compactLine);
  return tasks.map((t) => formatTask(t, opts));
}

// Emit a value to stdout in the conventional shape (JSON, lines, or string).
function emit(result, { json = false } = {}) {
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (Array.isArray(result)) {
    if (result.length === 0) {
      process.stdout.write(emptyMessage() + '\n');
      return;
    }
    process.stdout.write(result.join('\n') + '\n');
    return;
  }
  if (result === undefined || result === null) return;
  process.stdout.write(String(result) + '\n');
}

module.exports = { outputTasks, emit };
