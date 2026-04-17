'use strict';

// Cocoa epoch is 2001-01-01T00:00:00Z; Unix epoch is 1970-01-01T00:00:00Z.
// Things stores some timestamps as Cocoa seconds (stopDate, creationDate,
// userModificationDate) and others as Unix seconds (startDate, deadline).
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
};
