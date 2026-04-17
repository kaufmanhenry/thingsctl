'use strict';

const { emit } = require('./lib/output');
const { colors } = require('./lib/format');
const help = require('./help');
const commands = require('./commands');

// Tiny argv parser tuned for the historical thingsctl flag style:
// `--flag` takes the next token as a value unless that token starts with `--`.
// Single-letter aliases that we already used: -v, -V, -h.
function parseArgs(argv) {
  const out = { command: null, args: [], options: {} };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--') {
      i++;
      while (i < argv.length) out.args.push(argv[i++]);
      break;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out.options[key] = argv[i + 1];
        i += 2;
      } else {
        out.options[key] = true;
        i++;
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1);
      out.options[key] = true;
      i++;
    } else if (!out.command) {
      out.command = a;
      i++;
    } else {
      out.args.push(a);
      i++;
    }
  }
  return out;
}

function _commonOpts(o) {
  return {
    json: !!o.json,
    verbose: !!(o.verbose || o.v),
    compact: !!o.compact,
    ids: !!o.ids,
    limit: o.limit ? parseInt(o.limit, 10) : undefined,
    tag: o.tag, area: o.area, project: o.project,
    decode: !!o.decode,
    'yes-first': !!o['yes-first'],
  };
}

function dispatch(parsed) {
  const o = parsed.options;
  const opts = _commonOpts(o);
  const name = parsed.command;
  const mod = commands.get(name);
  if (!mod) {
    process.stderr.write(`${colors.red('Unknown command:')} ${name}\n`);
    help.printGlobal();
    process.exit(1);
  }

  switch (name) {
    case 'today': case 'inbox': case 'anytime': case 'someday':
    case 'upcoming': case 'due': case 'overdue': case 'evening':
    case 'logbook': case 'projects': case 'areas': case 'tags':
    case 'stats':
      return mod.run(opts);

    case 'repeating':
      return mod.run(opts);

    case 'project':
      return mod.run(parsed.args.join(' '), opts);

    case 'search':
      return mod.run(parsed.args.join(' '), opts);

    case 'show':
      return mod.run(parsed.args[0], opts);

    case 'add':
      return mod.run(parsed.args.join(' '), {
        notes: o.notes, when: o.when, deadline: o.deadline,
        tags: o.tags, list: o.list, project: o.project,
        area: o.area, heading: o.heading, checklist: o.checklist,
      });

    case 'update':
      return mod.run(parsed.args[0], {
        title: o.title, notes: o.notes,
        'append-notes': o['append-notes'], 'prepend-notes': o['prepend-notes'],
        when: o.when, deadline: o.deadline, 'add-tags': o['add-tags'],
        completed: o.completed, canceled: o.canceled,
        'yes-first': opts['yes-first'],
      });

    case 'complete':
      if (parsed.args.length === 0) throw new Error('Task id(s) required');
      return mod.run(parsed.args.length > 1 ? parsed.args : parsed.args[0], {
        'yes-first': opts['yes-first'],
      });

    case 'move':
      return mod.run(parsed.args[0], { to: o.to, 'yes-first': opts['yes-first'] });

    case 'tag':
      return mod.run(parsed.args[0], { add: o.add, remove: o.remove, 'yes-first': opts['yes-first'] });

    case 'export':
      return mod.run(parsed.args[0], { format: o.format, name: parsed.args[1] });

    case 'review':
      return mod.run({ days: o.days, json: opts.json });

    case 'watch':
      return mod.run({ interval: o.interval, events: o.events, once: !!o.once });

    case 'template':
    case 'clone':
      return mod.run(parsed.args.join(' '), {
        name: o.name, area: o.area, 'dry-run': !!o['dry-run'],
      });

    case 'config':
      return mod.run(parsed.args, opts);
  }
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    help.printGlobal();
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-V') {
    const pkg = require('../package.json');
    process.stdout.write(`thingsctl v${pkg.version}\n`);
    return 0;
  }

  const parsed = parseArgs(argv);

  if (parsed.options.help || parsed.options.h) {
    if (!help.printCommand(parsed.command)) help.printGlobal();
    return 0;
  }

  try {
    const result = dispatch(parsed);
    if (parsed.command !== 'watch') {
      emit(result, { json: !!parsed.options.json });
    }
    return 0;
  } catch (e) {
    process.stderr.write(`${colors.red('Error:')} ${e.message}\n`);
    return 1;
  } finally {
    require('./lib/db').close();
  }
}

module.exports = { parseArgs, dispatch, main };
