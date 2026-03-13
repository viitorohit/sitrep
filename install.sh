#!/bin/bash
# sitrep — AI-native project management
# Usage: curl -sL https://raw.githubusercontent.com/viitorohit/sitrep/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/viitorohit/sitrep/main"

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║   sitrep — AI-native project mgmt  ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# Create directories
mkdir -p .claude/commands
mkdir -p sitrep/history/sessions
mkdir -p sitrep/history/handoffs
mkdir -p sitrep/history/dashboards

# Download commands (9 total)
echo "  Downloading slash commands..."
curl -sL "$REPO/commands/session-start.md" -o .claude/commands/session-start.md
curl -sL "$REPO/commands/session-end.md" -o .claude/commands/session-end.md
curl -sL "$REPO/commands/sitrep.md" -o .claude/commands/sitrep.md
curl -sL "$REPO/commands/plan-update.md" -o .claude/commands/plan-update.md
curl -sL "$REPO/commands/capture.md" -o .claude/commands/capture.md
curl -sL "$REPO/commands/selfheal.md" -o .claude/commands/selfheal.md
curl -sL "$REPO/commands/handoff.md" -o .claude/commands/handoff.md
curl -sL "$REPO/commands/dashboard.md" -o .claude/commands/dashboard.md
curl -sL "$REPO/commands/pulse.md" -o .claude/commands/pulse.md

# Download templates if sitrep files don't exist
if [ ! -f "sitrep/MANIFEST.md" ]; then
  echo "  Creating MANIFEST.md..."
  curl -sL "$REPO/MANIFEST.md" -o sitrep/MANIFEST.md
fi

if [ ! -f "sitrep/PROJECT_PLAN.md" ]; then
  echo "  Creating PROJECT_PLAN.md template..."
  curl -sL "$REPO/templates/PROJECT_PLAN.md" -o sitrep/PROJECT_PLAN.md
fi

if [ ! -f "sitrep/STATUS_REPORT.md" ]; then
  echo "  Creating STATUS_REPORT.md template..."
  curl -sL "$REPO/templates/STATUS_REPORT.md" -o sitrep/STATUS_REPORT.md
fi

# Add gitignore entry
if [ -f ".gitignore" ]; then
  if ! grep -q "sitrep/.sitrep-active-session" .gitignore 2>/dev/null; then
    echo "sitrep/.sitrep-active-session" >> .gitignore
  fi
else
  echo "sitrep/.sitrep-active-session" > .gitignore
fi

echo ""
echo "  ══════════════════════════════════════"
echo "  ✅ sitrep v0.2.0 installed!"
echo ""
echo "  Files created:"
echo "    sitrep/MANIFEST.md"
echo "    sitrep/PROJECT_PLAN.md"
echo "    sitrep/STATUS_REPORT.md"
echo "    sitrep/history/ (sessions, handoffs, dashboards)"
echo "    .claude/commands/ (9 commands)"
echo ""
echo "  Next steps:"
echo "    1. Edit sitrep/PROJECT_PLAN.md with your project details"
echo "    2. Open Claude Code"
echo "    3. Type /session-start"
echo ""
echo "  Commands:"
echo "    /session-start   Orient at start of session"
echo "    /session-end     Update + commit at end"
echo "    /sitrep          Quick status check"
echo "    /capture         Add task mid-session"
echo "    /plan-update     Log scope changes"
echo "    /selfheal        Health check + auto-fix"
echo "    /handoff         Context package for handoff"
echo "    /dashboard       Visual MIS report"
echo "    /pulse           Session command status"
echo "  ══════════════════════════════════════"
echo ""
