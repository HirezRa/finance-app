#!/usr/bin/env sh
# מיישר את עותק הפריסה על origin/main (מוחק שינויים מקומיים לא ממוזגים).
# שימוש: על השרת ב־/opt/finance-app אחרי git fetch, כש־git pull מתלונן על divergent branches.
#
#   sh scripts/sync-repo-to-origin.sh
#   FINANCE_REPO_ROOT=/opt/finance-app sh scripts/sync-repo-to-origin.sh
#
set -e
REPO="${FINANCE_REPO_ROOT:-/opt/finance-app}"
cd "$REPO" || exit 1
REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${GIT_BRANCH:-main}"
echo "Fetching $REMOTE $BRANCH ..."
git fetch "$REMOTE" "$BRANCH"
git checkout "$BRANCH"
echo "Reset hard to $REMOTE/$BRANCH (local uncommitted / divergent commits on this clone are discarded)"
git reset --hard "$REMOTE/$BRANCH"
echo "OK at $(git rev-parse --short HEAD)"
