// Shared "read structured JSON input" helper for the commands that need
// LLM-interpreted session context (session-end, plan-update) rather than
// simple CLI flags. Source is --data '<json>' if given, otherwise stdin
// (only read if stdin isn't an interactive TTY, so a bare invocation from
// a terminal never hangs waiting for input that will never arrive).

const fs = require('fs');

// Returns { ok, data, error }. Never throws.
function readJsonInput(dataFlagValue) {
  let raw = dataFlagValue;

  if (raw === undefined) {
    if (process.stdin.isTTY) {
      return { ok: false, error: 'no --data provided and no piped stdin input' };
    }
    try {
      raw = fs.readFileSync(0, 'utf8').trim();
    } catch (err) {
      return { ok: false, error: `failed to read stdin: ${err.message}` };
    }
  }

  if (!raw) {
    return { ok: false, error: 'no --data provided and stdin was empty' };
  }

  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: `invalid JSON input: ${err.message}` };
  }
}

module.exports = { readJsonInput };
