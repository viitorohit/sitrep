// Safe, fail-open filesystem helpers shared across command modules.
// Reading a missing file returns null (never throws) — every command
// decides for itself whether that's fatal or just "skip this section."

const fs = require('fs');
const path = require('path');

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}

function appendLine(filePath, line) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, line.endsWith('\n') ? line : line + '\n', 'utf8');
}

function readJsonIfExists(filePath) {
  const raw = readIfExists(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Malformed JSON is treated the same as "not found" — every caller
    // already has a fallback for null, and this helper must never throw
    // (Hard Law #5: fail-open, never block a developer's workflow).
    return null;
  }
}

function writeJson(filePath, data) {
  writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

module.exports = {
  readIfExists,
  exists,
  ensureDir,
  writeFile,
  appendLine,
  readJsonIfExists,
  writeJson,
};
