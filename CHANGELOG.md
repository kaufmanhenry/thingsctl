# Changelog

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
