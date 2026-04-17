'use strict';

// Best-effort decode of TMTask.rt1_recurrenceRule (a binary plist that
// archives an EKRecurrenceRule). We don't ship a full plist parser; instead
// we sniff the canonical bytes that always appear in the buffer.
//
// Returns { freq, interval, weekdays, raw } where freq ∈
// 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY'|'UNKNOWN'.

const FREQ = { 0: 'DAILY', 1: 'WEEKLY', 2: 'MONTHLY', 3: 'YEARLY' };

function decodeRecurrenceRule(buf) {
  if (!buf || !Buffer.isBuffer(buf)) return { freq: 'UNKNOWN', interval: 1 };

  let freq = 'UNKNOWN';
  let interval = 1;

  // Look for "frequency" / "interval" UTF-8 keys, then read the byte after the
  // associated kCFNumberSInt32Type marker. This is heuristic but stable across
  // recent Things versions.
  const text = buf.toString('binary');

  const fIdx = text.indexOf('frequency');
  if (fIdx >= 0) {
    // After 'frequency' (9 bytes) comes a few bytes of plist metadata, then
    // the integer value as a single byte for small numbers.
    for (let off = fIdx + 9; off < Math.min(fIdx + 24, buf.length); off++) {
      const b = buf[off];
      if (b >= 0 && b <= 3) { freq = FREQ[b]; break; }
    }
  }

  const iIdx = text.indexOf('interval');
  if (iIdx >= 0) {
    for (let off = iIdx + 8; off < Math.min(iIdx + 24, buf.length); off++) {
      const b = buf[off];
      if (b >= 1 && b <= 60) { interval = b; break; }
    }
  }

  return { freq, interval };
}

function describe(rule) {
  if (!rule || rule.freq === 'UNKNOWN') return 'repeats';
  const word = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[rule.freq];
  if (!word) return 'repeats';
  if (rule.interval === 1) return `every ${word}`;
  return `every ${rule.interval} ${word}s`;
}

module.exports = { decodeRecurrenceRule, describe };
