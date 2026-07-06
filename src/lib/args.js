// Dependency-free argument parser shared by all 8 command stubs.
//
// Expresses three argument shapes from one declarative `spec`:
//   - no args at all                        (spec = {})
//   - GNU-style --flag [value], with optional mutual exclusion
//   - a single bare positional keyword       (spec.positional)
//
// Returns { ok, values, errors } — a parse-result, distinct from the
// command's final structured result (see lib/result.js).

function parseArgs(argv, spec = {}) {
  const values = {};
  const errors = [];
  const freeTextParts = [];
  let positionalConsumed = false;

  if (spec.flags) {
    for (const name of Object.keys(spec.flags)) {
      if (spec.flags[name].type === 'boolean') values[name] = false;
    }
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token.startsWith('--')) {
      const flagName = token.slice(2);
      const flagSpec = spec.flags && spec.flags[flagName];

      if (!flagSpec) {
        errors.push(`Unknown flag: --${flagName}`);
        continue;
      }

      if (flagSpec.type === 'boolean') {
        values[flagName] = true;
        continue;
      }

      // type === 'value'
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        errors.push(`--${flagName} requires a value`);
        continue;
      }
      if (flagSpec.pattern && !flagSpec.pattern.test(next)) {
        errors.push(`--${flagName} has an invalid value: "${next}"`);
        i++;
        continue;
      }
      values[flagName] = next;
      i++;
      continue;
    }

    // Not a --flag token.
    if (spec.positional && !positionalConsumed) {
      if (spec.positional.oneOf.includes(token)) {
        values[spec.positional.name] = token;
        positionalConsumed = true;
      } else {
        errors.push(
          `Unrecognized value "${token}" — expected one of: ${spec.positional.oneOf.join(', ')}`
        );
      }
      continue;
    }

    if (spec.freeText) {
      freeTextParts.push(token);
      continue;
    }

    errors.push(`Unexpected argument: "${token}"`);
  }

  if (spec.freeText) {
    values.description = freeTextParts.join(' ').trim();
  }

  if (spec.positional && !positionalConsumed) {
    values[spec.positional.name] = spec.positional.default;
  }

  if (spec.mutuallyExclusive) {
    for (const pair of spec.mutuallyExclusive) {
      const [a, b] = pair;
      if (values[a] && values[b]) {
        errors.push(`--${a} and --${b} are mutually exclusive`);
      }
    }
  }

  return { ok: errors.length === 0, values, errors };
}

module.exports = { parseArgs };
