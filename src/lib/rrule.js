'use strict';

// Decode TMTask.rt1_recurrenceRule. In current Things 3 builds this is an
// XML *property list* (not a binary plist) archiving the repeat rule. It uses
// short keys:
//
//   fu  frequency unit  — an NSCalendarUnit bit value:
//                           4=year, 8=month, 16=day, 256=weekday(week),
//                           512=weekday-ordinal (nth weekday of month)
//   fa  frequency amount — the interval ("every N units")
//   of  array of "on" specifiers, each a dict with either
//         wd=<1..7> (weekday, 1=Sun) or dy=<1..31> (day of month)
//   tp  schedule type, ed/ia/sr  anchor + end dates (not needed for cadence)
//
// Returns { freq, interval, weekday?, dayOfMonth? } where freq ∈
// 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY'|'UNKNOWN'. Anything we can't parse
// degrades to { freq: 'UNKNOWN', interval: 1 }.

function _toXml(buf) {
  if (buf == null) return null;
  if (Buffer.isBuffer(buf)) return buf.length ? buf.toString('utf8') : null;
  const s = String(buf);
  return s.length ? s : null;
}

function _int(xml, key) {
  const m = xml.match(new RegExp(`<key>${key}</key>\\s*<integer>(-?\\d+)</integer>`));
  return m ? parseInt(m[1], 10) : null;
}

// First weekday/day-of-month inside the <key>of</key> array, if any.
function _ofInt(xml, subkey) {
  const idx = xml.indexOf('<key>of</key>');
  if (idx < 0) return null;
  const m = xml.slice(idx).match(new RegExp(`<key>${subkey}</key>\\s*<integer>(-?\\d+)</integer>`));
  return m ? parseInt(m[1], 10) : null;
}

function _freqFromUnit(fu) {
  if (fu == null) return 'UNKNOWN';
  if (fu & 4) return 'YEARLY';     // NSCalendarUnitYear
  if (fu & 8) return 'MONTHLY';    // NSCalendarUnitMonth
  if (fu & 512) return 'MONTHLY';  // NSCalendarUnitWeekdayOrdinal (nth weekday)
  if (fu & 256) return 'WEEKLY';   // NSCalendarUnitWeekday
  if (fu & 16) return 'DAILY';     // NSCalendarUnitDay
  return 'UNKNOWN';
}

function decodeRecurrenceRule(buf) {
  const xml = _toXml(buf);
  if (!xml) return { freq: 'UNKNOWN', interval: 1 };

  const freq = _freqFromUnit(_int(xml, 'fu'));
  const fa = _int(xml, 'fa');
  const interval = fa && fa > 0 ? fa : 1;

  const rule = { freq, interval };
  const wd = _ofInt(xml, 'wd');
  if (wd != null) rule.weekday = wd;     // 1=Sun … 7=Sat
  const dy = _ofInt(xml, 'dy');
  if (dy != null) rule.dayOfMonth = dy;
  return rule;
}

function describe(rule) {
  if (!rule || rule.freq === 'UNKNOWN') return 'repeats';
  const word = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[rule.freq];
  if (!word) return 'repeats';
  if (rule.interval === 1) return `every ${word}`;
  return `every ${rule.interval} ${word}s`;
}

module.exports = { decodeRecurrenceRule, describe };
