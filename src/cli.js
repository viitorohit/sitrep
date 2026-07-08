// Dispatch: resolves the command, handles help/no-args/unknown-command,
// wraps execute() in a try/catch backstop, sets the process exit code.
// Never lets a raw stack trace reach the user — every path funnels through
// render() (see lib/render.js), which is the seam GETSITREP-12's future
// byte-identical-across-adapters test harness hooks into.

const registry = require('./commands');
const { ok, fail } = require('./lib/result');
const { render } = require('./lib/render');

const COMMAND_NAMES = Object.keys(registry);

// GETSITREP-55: single source of truth for each command's usage line, used
// both by the top-level `getsitrep --help` listing and by per-command
// `getsitrep <command> --help` (see commandHelpResult below) — one string
// per command, never duplicated between the two call sites.
// `nudge-check` is deliberately omitted from VISIBLE_COMMANDS (hook-fired
// only, not a human-facing command) but still has an entry here so
// `getsitrep nudge-check --help` still answers instead of erroring.
const COMMAND_HELP = {
  'session-start': 'session-start              Orient at session open (automatic)',
  'session-end': 'session-end                Close out the session (automatic)',
  sitrep: 'sitrep                     Quick status check',
  capture: 'capture <desc> [--phase N | --future]   Add a task to plan + status',
  'plan-update': 'plan-update                Apply plan changes',
  selfheal:
    'selfheal [deep]            Health check + auto-fix\n' +
    '  selfheal lock|unlock|diff|restore --file <name> [--force]   Act on a drifted command MD',
  handoff: 'handoff [human|ai]         Generate a context package (default: ai)',
  dashboard: 'dashboard                  Generate the visual MIS report',
  report:
    'report [--phase N | --ticket ID | --model NAME] [--plan-data <json>]   Cost-to-outcome summary (from the persisted cost rollup)',
  plan: "plan [--phase N] [--plan-data <json>]        Read-only view of the plan (all phases, or one phase's content)",
  progress: 'progress [--plan-data <json>]                Quick, source-agnostic progress readout',
  init: 'init [--yes] [--plan <native|jira|openspec|speckit|none>] [--cost <manual|ccusage|none>] [--tools <list>] [--force]   One-time onboarding wizard (not a slash command)',
  'nudge-check': 'nudge-check                Mid-session opportunity nudge (hook-fired, not meant for manual use)',
};

const VISIBLE_COMMANDS = [
  'session-start',
  'session-end',
  'sitrep',
  'capture',
  'plan-update',
  'selfheal',
  'handoff',
  'dashboard',
  'report',
  'plan',
  'progress',
  'init',
];

function helpResult() {
  const lines = ['Usage: getsitrep <command> [args]', '', 'Commands:', ...VISIBLE_COMMANDS.map((name) => `  ${COMMAND_HELP[name]}`)].join(
    '\n'
  );
  return ok('help', {}, lines);
}

// GETSITREP-55: `getsitrep <command> --help`/`-h` prints this instead of
// running the command — see the interception in run() below, which checks
// for --help/-h BEFORE calling execute(), so a help probe can never trigger
// a real mutation (this is what would have caught the GETSITREP-54 incident
// at the source, before session-end's own logic ever ran).
function commandHelpResult(commandName) {
  const usage = COMMAND_HELP[commandName] || `${commandName}  (no additional usage documented)`;
  return ok(commandName, {}, `Usage: getsitrep ${usage}`);
}

function unknownCommandResult(commandName) {
  return fail(
    'cli',
    { command: commandName },
    `Unrecognized command: "${commandName}". Valid commands: ${COMMAND_NAMES.join(', ')}`
  );
}

// async: the only command that needs it today is `init` (GETSITREP-17's
// readline wizard prompts, a builtin Node module that's inherently
// callback/promise-based) — every other command's execute() still returns
// a plain object, and `await`-ing a non-Promise value just resolves to it
// immediately, so this is a backward-compatible generalization, not a
// behavior change for the 8 canon commands.
async function run(argv) {
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

  // Only the immediate next token, not a scan of the whole array — some
  // commands (capture) accept free-form text that could legitimately
  // contain "--help"/"-h" as a substring of the description itself; this
  // still catches the exact incident pattern (`session-end --help`) without
  // that false-positive risk. A --help/-h appearing deeper in the args
  // (e.g. after --data) instead hits the parseArgs-error refusal added to
  // session-end/dashboard below — still safe, just without the nice text.
  if (rest[0] === '--help' || rest[0] === '-h') {
    const result = commandHelpResult(commandName);
    render(result);
    process.exitCode = 0;
    return;
  }

  let result;
  try {
    result = await command.execute(rest);
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
