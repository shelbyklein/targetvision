#!/usr/bin/env bash
# Post-publish smoke test — run this after every deploy to verify the live site.
#
# Usage:
#   ./health-check.sh https://targetvision.example.com
#   BASE_URL=https://targetvision.example.com ./health-check.sh
#
# The script exits non-zero if any critical route returns a 5xx error,
# so it can be wired into CI or a post-publish hook.

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <BASE_URL>" >&2
  echo "  e.g. $0 https://targetvision.example.com" >&2
  exit 1
fi

exec pnpm --filter @workspace/scripts run health-check "$BASE_URL"
