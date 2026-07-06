// Skeleton only — GETSITREP-9. Real file logic is GETSITREP-10.
//
// Automatic (hook-fired) per docs/specs/command-canon.md. Per Hard Law #5,
// this command must never fail or block on unexpected input — unlike the
// six Intentional commands, unrecognized args here become a warning folded
// into `message` with ok: true, not a failure. Do not "fix" this to match
// the other stubs' error behavior.

const { parseArgs } = require('../lib/args');
const { ok } = require('../lib/result');

const SPEC = {};

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  const warning = parsed.ok ? '' : ` (ignored: ${parsed.errors.join('; ')})`;
  return ok('session-start', parsed.values, `session-start: parsed successfully — logic migration is GETSITREP-10${warning}`);
}

module.exports = { name: 'session-start', execute };
