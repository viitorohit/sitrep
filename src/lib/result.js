// Structured result shape shared by every command module and by cli.js's
// help/unknown-command paths. `data` is a reserved slot for GETSITREP-10's
// real computed output — always null in this skeleton (GETSITREP-9).

function ok(command, args, message, data = null) {
  return { ok: true, command, args, message, data };
}

function fail(command, args, message) {
  return { ok: false, command, args, message, data: null };
}

module.exports = { ok, fail };
