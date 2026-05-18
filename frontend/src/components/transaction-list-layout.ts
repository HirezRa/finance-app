/**
 * Shared column contract for transactions list header + rows (RTL).
 * Visual order (inline-start → end): avatar | content | amount | category | actions
 */
/** Row grid: see index.css `.transaction-row-grid` */
export const TRANSACTION_LIST_GRID_CLASS = 'transaction-row-grid';

/** Desktop table header — same column widths as rows */
export const TRANSACTION_LIST_HEADER_CLASS =
  'transaction-row-grid transaction-list-header hidden border-b bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground md:grid';

export const TXN_COL_AVATAR = 'txn-col-avatar shrink-0';
export const TXN_COL_CONTENT = 'txn-col-content content-cell min-w-0';
export const TXN_COL_AMOUNT = 'txn-col-amount amount-cell';
export const TXN_COL_CATEGORY = 'txn-col-category min-w-0';
export const TXN_COL_ACTIONS = 'txn-col-actions shrink-0 justify-self-center';
