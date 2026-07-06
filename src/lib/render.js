// The only module allowed to touch stdout/stderr. Every path in cli.js —
// help text, unknown-command, real command results — funnels through
// render() so a future adapter-output or JSON renderer (GETSITREP-12) can
// swap in without touching any command module or cli.js's dispatch logic.

function render(result) {
  if (result.message.includes('\n')) {
    // Multi-line message (e.g. top-level help text) — print as-is, no prefix.
    console.log(result.message);
    return;
  }

  const prefix = result.ok ? '✓' : '✗';
  const line = `[${result.command}] ${prefix} ${result.message}`;

  if (result.ok) {
    console.log(line);
  } else {
    console.error(line);
  }

  if (result.args && Object.keys(result.args).length > 0) {
    const stream = result.ok ? console.log : console.error;
    stream(`  args: ${JSON.stringify(result.args)}`);
  }
}

module.exports = { render };
