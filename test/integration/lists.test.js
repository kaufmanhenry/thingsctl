'use strict';

require('./setup');

const inbox = require('../../src/commands/inbox');
const anytime = require('../../src/commands/anytime');
const someday = require('../../src/commands/someday');
const upcoming = require('../../src/commands/upcoming');
const due = require('../../src/commands/due');
const overdue = require('../../src/commands/overdue');
const evening = require('../../src/commands/evening');
const repeating = require('../../src/commands/repeating');
const projects = require('../../src/commands/projects');
const areas = require('../../src/commands/areas');
const tags = require('../../src/commands/tags');

describe('list commands against fixture', () => {
  test('inbox lists Inbox', () => {
    const out = inbox.run({ json: true });
    expect(out.map((t) => t.title).sort()).toEqual(['CSV edge case', 'Quick capture']);
  });

  test('anytime lists project-less Anytime', () => {
    const out = anytime.run({ json: true });
    const titles = out.map((t) => t.title).sort();
    expect(titles).toContain('Replace lightbulb');
  });

  test('someday lists Someday', () => {
    const out = someday.run({ json: true });
    expect(out.map((t) => t.title)).toEqual(['Learn Mandarin']);
  });

  test('upcoming lists future-scheduled tasks', () => {
    const out = upcoming.run({ json: true });
    expect(out.map((t) => t.title)).toEqual(['Future thing']);
  });

  test('due lists tasks with deadlines', () => {
    const out = due.run({ json: true });
    expect(out.map((t) => t.title).sort()).toEqual(['Deadline soon', 'Past due']);
  });

  test('overdue lists only past-deadline tasks', () => {
    const out = overdue.run({ json: true });
    expect(out.map((t) => t.title)).toEqual(['Past due']);
  });

  test('evening lists startBucket=1 tasks', () => {
    const out = evening.run({ json: true });
    expect(out.map((t) => t.title)).toEqual(['Read book']);
  });

  test('repeating lists tasks with rt1_recurrenceRule', () => {
    const out = repeating.run({ json: true });
    expect(out.map((t) => t.title)).toEqual(['Standup recurring']);
  });

  test('projects includes the seeded project with task count', () => {
    const out = projects.run({ json: true });
    const launch = out.find((p) => p.title === 'Launch');
    expect(launch).toBeDefined();
    expect(launch.taskCount).toBeGreaterThanOrEqual(1);
    expect(launch.area).toBe('Work');
  });

  test('areas includes Work and Home with counts', () => {
    const out = areas.run({ json: true });
    const titles = out.map((a) => a.title).sort();
    expect(titles).toEqual(['Home', 'Work']);
  });

  test('tags includes Deep, Errand, Urgent', () => {
    const out = tags.run({ json: true });
    expect(out.map((t) => t.title).sort()).toEqual(['Deep', 'Errand', 'Urgent']);
  });
});
