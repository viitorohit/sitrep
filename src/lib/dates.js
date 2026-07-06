// Shared date helper — was independently duplicated in capture.js,
// plan-update.js, and session-end.js.
function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { today };
