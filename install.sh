#!/bin/bash
# sitrep — AI-native project management
# Usage: curl -sL https://raw.githubusercontent.com/getsitrep/sitrep/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/viitorohit/sitrep/main"

echo "=== Installing sitrep ==="
echo ""

# Create directories
mkdir -p .claude/commands
mkdir -p sitrep

# Download commands
echo "Downloading slash commands..."
curl -sL "$REPO/commands/session-start.md" -o .claude/commands/session-start.md
curl -sL "$REPO/commands/session-end.md" -o .claude/commands/session-end.md
curl -sL "$REPO/commands/sitrep.md" -o .claude/commands/sitrep.md
curl -sL "$REPO/commands/plan-update.md" -o .claude/commands/plan-update.md
curl -sL "$REPO/commands/doctor.md" -o .claude/commands/doctor.md

# Download templates if sitrep files don't exist
if [ ! -f "sitrep/PROJECT_PLAN.md" ]; then
  echo "Creating PROJECT_PLAN.md template..."
  curl -sL "$REPO/templates/PROJECT_PLAN.md" -o sitrep/PROJECT_PLAN.md
fi

if [ ! -f "sitrep/STATUS_REPORT.md" ]; then
  echo "Creating STATUS_REPORT.md template..."
  curl -sL "$REPO/templates/STATUS_REPORT.md" -o sitrep/STATUS_REPORT.md
fi

echo ""
echo "=== sitrep installed ==="
echo ""
echo "Files created:"
echo "  .claude/commands/session-start.md"
echo "  .claude/commands/session-end.md"
echo "  .claude/commands/sitrep.md"
echo "  .claude/commands/plan-update.md"
echo "  .claude/commands/doctor.md"
echo "  sitrep/PROJECT_PLAN.md"
echo "  sitrep/STATUS_REPORT.md"
echo ""
echo "Next steps:"
echo "  1. Edit sitrep/PROJECT_PLAN.md with your project details"
echo "  2. Edit sitrep/STATUS_REPORT.md with your current status"
echo "  3. Open Claude Code and type /session-start"
echo ""
echo "Commands available:"
echo "  /session-start  — orient at start of session"
echo "  /session-end    — update + commit at end of session"
echo "  /sitrep         — quick status check"
echo "  /plan-update    — log scope changes"
echo "  /doctor         — health check + auto-fix"
echo ""
