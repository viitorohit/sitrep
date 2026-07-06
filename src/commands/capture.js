// Skeleton only — GETSITREP-9. Real file logic is GETSITREP-10.
// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Usage: capture <description> [--phase N] [--future]
// --phase and --future are mutually exclusive.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');

const SPEC = {
  freeText: true,
  flags: {
    phase: { type: 'value', pattern: /^\d+$/ },
    future: { type: 'boolean' },
  },
  mutuallyExclusive: [['phase', 'future']],
};

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('capture', parsed.values, parsed.errors.join('; '));
  }
  return ok('capture', parsed.values, 'capture: parsed successfully — logic migration is GETSITREP-10');
}

module.exports = { name: 'capture', execute };
