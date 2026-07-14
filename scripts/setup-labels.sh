#!/usr/bin/env bash
# Create the standard issue labels for TargetVision. Idempotent (--force
# updates an existing label instead of erroring). Requires the GitHub CLI
# authenticated against this repo: `gh auth login`.
set -euo pipefail

create() {
  gh label create "$1" --color "$2" --description "$3" --force
}

create "bug"           "d73a4a" "Something isn't working"
create "enhancement"   "a2eeef" "New feature or improvement"
create "priority:high" "b60205" "Fix soon"
create "priority:low"  "0e8a16" "Nice to have"
create "claude"        "5319e7" "Hand off to Claude Code / @claude"

echo "Labels created/updated."
