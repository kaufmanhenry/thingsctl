# Changelog

## 2.0.3

Fix recurring tasks across `someday` and `repeating`. Two bugs, both from the same
wrong-format assumption as 2.0.2: the code expected an older recurrence encoding
that current Things no longer writes.

- **Repeating-task templates leaked into `someday`.** Things stores a repeating
  to-do's template with `start = 2` (the same value as Someday) but hides it from
  the Someday list, surfacing only the generated instances. `someday` (and the
  `stats` someday count) listed every template, so a bank of recurring chores and
  calls showed up as phantom Someday tasks. Both now exclude rows that carry a
  recurrence rule, matching the app.
- **Recurrence rules never decoded.** `repeating` reported every task as
  `freq: UNKNOWN` because the decoder sniffed for binary-plist `frequency` /
  `interval` keys, but current Things writes an **XML plist** (`fu` =
  NSCalendarUnit unit, `fa` = interval, `of` = weekday / day-of-month). Rewrote the
  decoder to parse it, so cadences read correctly (`every week`, `every 2 weeks`,
  `every month`, `every 2 days`).
- **`repeating` next-instance was always null.** `rt1_nextInstanceStartDate` is a
  bit-packed calendar date (like `startDate`), not Unix seconds, but the code gated
  it on `>= 1000000000`, which packed dates never satisfy. Now decoded with
  `thingsDateToIso` / `formatThingsShortDate`.

Fixture rebuilt to emit real recurrence-rule XML plus a Someday-template row;
regression tests added for the someday exclusion, frequency decoding, and
next-instance date.

## 2.0.2

Fix date decoding across every list and stat. The previous releases misread the
Things SQLite schema, which made several commands return wrong or empty results
on real databases (tests passed only because the fixture encoded dates the same
wrong way).

- **`startDate` / `deadline` are bit-packed calendar dates**, not Unix seconds
  (`2026-06-16` → `132802560`). Added `decodeThingsDate` / `encodeThingsDate` and
  repointed every read. This fixes scheduled-date display in `show`, `export`,
  `review`, and the `→`/`📅` markers.
- **`today` membership is now scheduled-date based.** Previously a task was
  considered "in Today" when `todayIndex > 0`, but that flag marks recurrence
  *templates* Things hides — real Today rows carry a negative `todayIndex`. Today
  now lists Anytime to-dos scheduled for today or earlier (overdue-scheduled roll
  in), matching the app.
- **`due` / `overdue` / `upcoming` were silently empty** (they gated deadlines on
  `> 1000000000`, which packed dates never satisfy). Now corrected.
- **`someday`** no longer swallows dated tasks; dated items surface under
  `upcoming` as Things intends.
- **`stopDate` / `creationDate` / `userModificationDate` are Unix seconds**, not
  Cocoa. `stats.completedToday` previously counted *all* completed tasks ever;
  `logbook` and `review` rendered completion dates ~56 years in the future. Both
  fixed.
- Rebuilt the test fixture with the real Things encodings and added a
  recurrence-template regression test so this class of bug can't reappear.
