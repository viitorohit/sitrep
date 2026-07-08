// Static registry of the 8 canon commands (docs/specs/command-canon.md),
// plus `init` (GETSITREP-17) and `nudge-check` (GETSITREP-35) — CLI-only
// utility commands, not among the 8 slash commands, same relationship
// install.sh always had to the canon. Explicit map, not a directory scan —
// the command set is fixed by the spec, not by whatever files happen to sit
// in this folder.

const sessionStart = require('./session-start');
const sessionEnd = require('./session-end');
const sitrep = require('./sitrep');
const capture = require('./capture');
const planUpdate = require('./plan-update');
const selfheal = require('./selfheal');
const handoff = require('./handoff');
const dashboard = require('./dashboard');
const init = require('./init');
const nudgeCheck = require('./nudge-check');

const registry = {
  'session-start': sessionStart,
  'session-end': sessionEnd,
  sitrep,
  capture,
  'plan-update': planUpdate,
  selfheal,
  handoff,
  dashboard,
  init,
  'nudge-check': nudgeCheck,
};

// Cheap self-check against typos: each module's declared name must match
// the key it's registered under.
for (const [key, mod] of Object.entries(registry)) {
  if (mod.name !== key) {
    throw new Error(`Command registry mismatch: key "${key}" maps to module named "${mod.name}"`);
  }
}

module.exports = registry;
