// Dispatch: resolves the command, handles help/no-args/unknown-command,
// wraps execute() in a try/catch backstop, sets the process exit code.
// Never lets a raw stack trace reach the user — every path funnels through
// render() (see lib/render.js), which is the seam GETSITREP-12's future
// byte-identical-across-adapters test harness hooks into.

const registry = require('./commands');
const { ok, fail } = require('./lib/result');
const { render } = require('./lib/render');

const COMMAND_NAMES = Object.keys(registry);

function helpResult() {
  const lines = [
    'Usage: getsitrep <command> [args]',
    '',
    'Commands:',
    '  session-start              Orient at session open (automatic)',
    '  session-end                Close out the session (automatic)',
    '  sitrep                     Quick status check',
    '  capture <desc> [--phase N | --future]   Add a task to plan + status',
    '  plan-update                Apply plan changes',
    '  selfheal [deep]            Health check + auto-fix',
    '  handoff [human|ai]         Generate a context package (default: ai)',
    '  dashboard                  Generate the visual MIS report',
  ].join('\n');
  return ok('help', {}, lines);
}

function unknownCommandResult(commandName) {
  return fail(
    'cli',
    { command: commandName },
    `Unrecognized command: "${commandName}". Valid commands: ${COMMAND_NAMES.join(', ')}`
  );
}

function run(argv) {
  const [commandName, ...rest] = argv;

  if (!commandName || commandName === '--help' || commandName === '-h' || commandName === 'help') {
    const result = helpResult();
    render(result);
    process.exitCode = 0;
    return;
  }

  const command = registry[commandName];
  if (!command) {
    const result = unknownCommandResult(commandName);
    render(result);
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = command.execute(rest);
  } catch (err) {
    if (process.env.GETSITREP_DEBUG === '1') {
      console.error(err.stack);
    }
    result = fail(commandName, {}, `Unexpected error in ${commandName} (set GETSITREP_DEBUG=1 for details)`);
  }

  render(result);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { run };
