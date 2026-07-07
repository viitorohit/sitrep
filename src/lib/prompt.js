// GETSITREP-18: minimal readline wrapper for init's wizard prompts.
// Zero-dependency (readline is a Node builtin, explicitly allowed per the
// project's Coding Standards).
//
// Non-interactive fallback: every ask* function resolves immediately to its
// default when stdin isn't a TTY (CI, piped input, the test harness) — never
// prompts, never hangs waiting for input that will never arrive. This is
// the same fail-open-toward-automation posture as lib/input.js's isTTY check.

const readline = require('readline');

function isInteractive() {
  return Boolean(process.stdin.isTTY);
}

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function question(rl, text) {
  return new Promise((resolve) => rl.question(text, resolve));
}

// options: [{ value, label }]. Returns the chosen `value`.
async function askChoice(rl, { question: promptText, options, defaultValue }) {
  if (!isInteractive()) return defaultValue;

  const defaultIndex = options.findIndex((o) => o.value === defaultValue);
  const lines = options.map((o, i) => `  [${i + 1}] ${o.label}${i === defaultIndex ? ' (default)' : ''}`);
  const answer = (await question(rl, `${promptText}\n${lines.join('\n')}\n> `)).trim();

  if (!answer) return defaultValue;
  const index = parseInt(answer, 10) - 1;
  return options[index] ? options[index].value : defaultValue;
}

// Comma-separated numbers, e.g. "1,3". Returns an array of chosen `value`s.
async function askMultiChoice(rl, { question: promptText, options, defaultValues }) {
  if (!isInteractive()) return defaultValues;

  const lines = options.map((o, i) => `  [${i + 1}] ${o.label}`);
  const answer = (await question(rl, `${promptText} (comma-separated, e.g. 1,3)\n${lines.join('\n')}\n> `)).trim();

  if (!answer) return defaultValues;
  const chosen = answer
    .split(',')
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => options[i])
    .map((i) => options[i].value);
  return chosen.length ? chosen : defaultValues;
}

async function askText(rl, { question: promptText, defaultValue }) {
  if (!isInteractive()) return defaultValue || '';
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await question(rl, `${promptText}${suffix}: `)).trim();
  return answer || defaultValue || '';
}

async function askYesNo(rl, { question: promptText, defaultValue = true }) {
  if (!isInteractive()) return defaultValue;
  const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
  const answer = (await question(rl, `${promptText}${suffix}: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === 'y' || answer === 'yes';
}

module.exports = { createInterface, isInteractive, askChoice, askMultiChoice, askText, askYesNo };
