'use strict';

// Cocoa epoch is 2001-01-01T00:00:00Z; Unix epoch is 1970-01-01T00:00:00Z.
// The COCOA_EPOCH_OFFSET helpers remain for any Cocoa-encoded column, but note:
// in the current Things schema the *timestamp* columns (stopDate, creationDate,
// userModificationDate) are plain Unix seconds, and the *calendar-date* columns
// (startDate, deadline) are NOT timestamps at all — they're bit-packed dates.
// See decodeThingsDate/encodeThingsDate below.
const COCOA_EPOCH_OFFSET = 978307200;

function cocoaToUnix(seconds) {
  if (seconds == null) return null;
  return seconds + COCOA_EPOCH_OFFSET;
}

function unixToCocoa(seconds) {
  if (seconds == null) return null;
  return seconds - COCOA_EPOCH_OFFSET;
}

function cocoaToDate(seconds) {
  if (seconds == null) return null;
  return new Date((seconds + COCOA_EPOCH_OFFSET) * 1000);
}

function unixToDate(seconds) {
  if (seconds == null || seconds < 1000000000) return null;
  return new Date(seconds * 1000);
}

function todayBounds(now = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  return {
    start: Math.floor(todayStart.getTime() / 1000),
    end: Math.floor(todayEnd.getTime() / 1000),
  };
}

function daysAgoUnix(days, now = new Date()) {
  const bounds = todayBounds(now);
  return bounds.start - days * 86400;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShortDate(unixSeconds) {
  const date = unixToDate(unixSeconds);
  if (!date) return null;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatIsoDate(unixSeconds) {
  const date = unixToDate(unixSeconds);
  if (!date) return null;
  return date.toISOString();
}

// Things stores calendar dates (startDate, deadline) as a bit-packed integer,
// NOT a timestamp:  (year << 16) | (month << 12) | (day << 7),  low 7 bits
// reserved. e.g. 2026-06-16 -> 132802560. Because the packing is year-major it
// is monotonic in real date order, so packed ints compare correctly (<, <=, >=).
function decodeThingsDate(packed) {
  if (packed == null || packed <= 0) return null;
  const day = (packed >> 7) & 0x1f;
  const month = (packed >> 12) & 0x0f;
  const year = packed >> 16;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function encodeThingsDate(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (y << 16) | (m << 12) | (d << 7);
}

// Midnight tonight, packed — the exclusive upper bound for "today or earlier".
function packedTomorrow(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return encodeThingsDate(d);
}

function formatThingsShortDate(packed) {
  const date = decodeThingsDate(packed);
  if (!date) return null;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function thingsDateToIso(packed) {
  const date = decodeThingsDate(packed);
  return date ? date.toISOString() : null;
}

module.exports = {
  COCOA_EPOCH_OFFSET,
  cocoaToUnix,
  unixToCocoa,
  cocoaToDate,
  unixToDate,
  todayBounds,
  daysAgoUnix,
  formatShortDate,
  formatIsoDate,
  decodeThingsDate,
  encodeThingsDate,
  packedTomorrow,
  formatThingsShortDate,
  thingsDateToIso,
};
