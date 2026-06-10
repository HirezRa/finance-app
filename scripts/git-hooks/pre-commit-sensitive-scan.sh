#!/usr/bin/env bash
# Local pre-commit: staged sensitive-data checks (see SKILL.md).
# Requires: Git Bash on Windows. Optional: gitleaks in PATH for full parity with CI.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "Running staged sensitive-data scan..."

# Block data-export filenames before content scan (CSV/SQL dumps may contain real transactions).
STAGED_NAMES="$(git diff --cached --name-only --diff-filter=ACMR || true)"
if [ -n "$STAGED_NAMES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      *.csv|*.tsv|*.xlsx|*.dump|*.sql.gz)
        echo "Blocked: data-export file staged ($f). Use local-only paths or add to .gitignore."
        exit 1
        ;;
    esac
    case "$f" in
      scripts/tmp-*)
        echo "Blocked: scratch query file staged ($f). Keep under scripts/tmp-* local-only."
        exit 1
        ;;
    esac
  done <<< "$STAGED_NAMES"
fi

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect \
    --staged \
    --config .gitleaks.toml \
    --redact \
    --verbose
else
  echo "WARN: gitleaks not found in PATH — skipping gitleaks protect (install: https://github.com/gitleaks/gitleaks)"
fi

# Exclude gitleaks config/ignore — legitimate regexes contain keywords like password/secret.
STAGED_DIFF="$(git diff --cached --unified=0 -- . \
  ':(exclude).gitleaks.toml' \
  ':(exclude).gitleaksignore' \
  ':(exclude)backend/scraper-overlays/**' \
  ':(exclude)scripts/git-hooks/pre-commit-sensitive-scan.sh' \
  ':(exclude)scripts/verify-public-docs-safety.cjs' \
  || true)"
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

# Platform / infra fingerprints (not .local — finance-app.local is a legit placeholder).
echo "$STAGED_TEXT" | grep -Eiq '\b(LXC|Proxmox|pve)\b|pct exec|\.(lan|corp|internal)\b' && {
  echo "Blocked: platform/infrastructure fingerprint detected (LXC/Proxmox/pct/internal host)."
  exit 1
}

echo "Sensitive-data scan passed."
