// GETSITREP-27: repo introspection for the plan-presence guard's draft
// PROJECT_PLAN.md generation. Deliberately shallow — infers only what's
// directly readable (name, description, dependencies-as-tech-stack), never
// invents phases/features/decisions. Fabricating those would be worse than
// leaving the template's own generic starter content in place.

const { execFileSync } = require('child_process');
const { readIfExists, readJsonIfExists } = require('./fs-helpers');
const path = require('path');

function detectProjectName(cwd) {
  const pkg = readJsonIfExists(path.join(cwd, 'package.json'));
  if (pkg && pkg.name) return pkg.name;

  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
    const match = remote.match(/([^/]+?)(\.git)?$/);
    if (match) return match[1];
  } catch {
    // no remote configured, or not a git repo — fall through
  }

  return path.basename(cwd);
}

function detectDescription(cwd) {
  const pkg = readJsonIfExists(path.join(cwd, 'package.json'));
  if (pkg && pkg.description) return pkg.description;

  const readme = readIfExists(path.join(cwd, 'README.md'));
  if (readme) {
    const lines = readme.split('\n').map((l) => l.trim());
    for (const line of lines) {
      if (line && !line.startsWith('#') && !line.startsWith('[') && !line.startsWith('!')) {
        return line;
      }
    }
  }

  return null;
}

// A short, best-effort tech-stack summary from whatever manifest files
// exist — not a full dependency audit, just enough to seed the template's
// "Tech Stack" line. Checks the most common ecosystems; anything else is
// left for the human to fill in.
function detectTechStack(cwd) {
  const pkg = readJsonIfExists(path.join(cwd, 'package.json'));
  if (pkg) {
    const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    if (deps.length > 0) return `Node.js${deps.length ? ` (${deps.slice(0, 5).join(', ')}${deps.length > 5 ? ', ...' : ''})` : ''}`;
    return 'Node.js';
  }
  if (readIfExists(path.join(cwd, 'requirements.txt')) || readIfExists(path.join(cwd, 'pyproject.toml'))) return 'Python';
  if (readIfExists(path.join(cwd, 'go.mod'))) return 'Go';
  if (readIfExists(path.join(cwd, 'Cargo.toml'))) return 'Rust';
  if (readIfExists(path.join(cwd, 'pom.xml')) || readIfExists(path.join(cwd, 'build.gradle'))) return 'Java';
  return null;
}

function detectOwner(cwd) {
  try {
    const name = execFileSync('git', ['config', 'user.name'], { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
    return name || null;
  } catch {
    return null;
  }
}

function introspectRepo(cwd = process.cwd()) {
  return {
    name: detectProjectName(cwd),
    description: detectDescription(cwd),
    techStack: detectTechStack(cwd),
    owner: detectOwner(cwd),
  };
}

module.exports = { introspectRepo };
