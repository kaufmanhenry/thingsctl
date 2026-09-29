# Changelog

## 2.1.1

No code changes. This is the first release published from CI through npm
trusted publishing (OIDC) rather than from a laptop with a long-lived token,
and so the first one carrying a provenance attestation — a cryptographic record
of which workflow, commit and repository built the tarball, which anyone can
verify with `npm audit signatures`.

Cutting it deliberately rather than waiting for the next code change: the
pipeline had never actually run, and the failure mode of finding that out later
is the one that already lost 2.0.4 (merged, never published).

## 2.1.0

Writes could report success for changes that never happened. 2.0.4 fixed one
command; this finishes the job, verifies every write against the database, adds
re-parenting, and closes a credential leak found on the way.

- **`complete`, `move` and `tag` still no-opped on projects.** 2.0.4 routed
  `update` to `things:///update-project` but left the other three building
  `things:///update`, which Things ignores for a project uuid. `open` still
  exits 0, so `thingsctl complete <project>` printed `✓ Completed` while the row
  stayed `status = 0`. All write commands now route by entity type, and headings
  are refused outright rather than dispatched into a command that cannot apply.
- **Success is now verified against the database, not assumed.** `open` exiting
  0 only means macOS handed the URL to Things. Writes poll the row until the
  change is visible and report a clear failure otherwise. This is what turned
  the routing bug from an error into a lie. Timeout is overridable with
  `THINGSCTL_VERIFY_TIMEOUT_MS` (the URL scheme can cold-launch Things, which
  takes longer than the 3s default); the MCP server defaults to 1200ms because
  the wait is synchronous and blocks its event loop. Bulk `complete` now shares
  one budget instead of spending the full timeout on every id.
- **Security: the auth token leaked into error output.** macOS `open` echoes the
  whole failing URL, `auth-token` included, and that text was spliced into
  `ThingsUrlError` — which the CLI prints to stderr and the MCP server returns
  as tool output, i.e. into a model transcript. The token is now redacted before
  it can reach any sink.
- **Security: `%` in an id matched every task.** `resolveTaskId` interpolated
  the id straight into a `LIKE` pattern, so `complete '%' --yes-first` resolved
  to an arbitrary row. Wildcards are escaped now. This mattered more once
  `update` could relocate work rather than only complete it.
- **`--completed false` completed the task instead of reopening it.** The CLI
  parser yields the string `'false'`, which is truthy, so the flag sent the
  opposite of what it says. Booleans are normalised once, up front.
- **Added: move a to-do or project to a different parent.** Previously
  impossible through the tool. `update --list` / `--list-id` moves a to-do into
  a project or area, `update --area` / `--area-id` moves a project into an area,
  and the move is verified against the row rather than against "something
  changed". Passing the wrong pair for the type is refused with an explanation.
- `tag` now tells the truth when a tag does not exist. Things silently drops an
  `add-tags` naming a tag it has never seen; that used to print a checkmark.
- `things_move`'s description said "moving it to...", which read as a re-parent
  when it only ever rescheduled. Fixed, along with its success string, which
  said "Moved" while its failure string said "did not reschedule".
- `thingsctl update --help` was missing every flag added here; the CLI keeps a
  hand-curated flag allowlist, so a new option has to be registered in four
  places. Documented; consolidating that is left as follow-up.

New: `src/lib/verify.js`, `url.buildUpdateProjectUrl` (from 2.0.4),
`db.openFresh`, `exec.redactToken`. 129 tests, up from 79 at 2.0.3.

## 2.0.4

Fix `update` silently no-opping on projects. Things applies the `update`
command to to-dos only; a project needs the separate `update-project` command,
so renaming or editing a project reported success but changed nothing.

- **Project updates now route to `update-project`.** `update` (and the
  `things_update` MCP tool) reads the resolved entity type and, when it is a
  project (`TMTask.type === 1`), issues `things:///update-project` instead of
  `things:///update`. A new `buildUpdateProjectUrl` builder backs this.

Unit test added for the new endpoint builder.

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
