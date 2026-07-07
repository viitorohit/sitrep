// Single source of truth for the 8 canon commands (docs/specs/command-canon.md),
// shared by src/commands/index.js's registry check, selfheal's structure
// check, and the hash-manifest baseline — so the list can't drift between
// call sites the way two separately-maintained copies eventually would.

const CANON_COMMANDS = [
  'session-start', 'session-end', 'sitrep', 'capture',
  'plan-update', 'selfheal', 'handoff', 'dashboard',
];

module.exports = { CANON_COMMANDS };
