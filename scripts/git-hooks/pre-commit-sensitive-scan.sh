#!/usr/bin/env bash
# Local pre-commit: staged sensitive-data checks (see SKILL.md).
# Requires: Git Bash on Windows. Optional: gitleaks in PATH for full parity with CI.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "Running staged sensitive-data scan..."

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect \
    --staged \
    --config .gitleaks.toml \
    --redact \
    --verbose
else
  echo "WARN: gitleaks not found in PATH — skipping gitleaks protect (install: https://github.com/gitleaks/gitleaks)"
fi

# Exclude skills/ — security SKILL docs contain example regexes that trip naive greps.
STAGED_DIFF="$(git diff --cached --unified=0 -- . ':(exclude)skills' || true)"
# Only inspect added lines (+); removals (-) still contain old literals and would block cleanup commits.
STAGED_TEXT="$(echo "$STAGED_DIFF" | grep '^+' | grep -v '^+++' || true)"

echo "$STAGED_TEXT" | grep -Eiq -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' && {
  echo "Blocked: private key material detected."
  exit 1
}

echo "$STAGED_TEXT" | grep -Eiq '\b(?:10|127|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}\b' && {
  echo "Blocked: private/internal IP detected."
  exit 1
}

# Word boundaries avoid GITHUB_TOKEN:/trufflesecurity-style false positives.
echo "$STAGED_TEXT" | grep -Eiq '\b(password|passwd|secret|token|api_key|client_secret)\b\s*[:=]' && {
  echo "Blocked: possible hardcoded credential assignment."
  exit 1
}

echo "Sensitive-data scan passed."
