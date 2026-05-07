/** Marks errors for which a terminal sync_fail was already written (avoid duplicate worker logs). */
const SYNC_FAIL_LOGGED = Symbol.for('finance.syncFailLogged');

export function markSyncFailureLogged(err: unknown): void {
  if (err !== null && typeof err === 'object') {
    (err as Record<symbol, boolean>)[SYNC_FAIL_LOGGED] = true;
  }
}

export function wasSyncFailureLogged(err: unknown): boolean {
  return !!(
    err !== null &&
    typeof err === 'object' &&
    (err as Record<symbol, boolean>)[SYNC_FAIL_LOGGED] === true
  );
}
