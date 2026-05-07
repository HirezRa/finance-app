# Structured Logging Guide

## Policy
- Logs are JSON-only (`app-logs.jsonl`), one object per line.
- `message` stays short and stable; details go under `meta`.
- Timestamp is UTC ISO8601 in `ts`.
- Forbidden in logs: passwords, OTP, tokens, cookies, raw authorization headers, full account numbers, full national IDs.
- Sensitive fields are sanitized automatically by `LogsService`.

## Core Schema
```json
{
  "id": "uuid",
  "ts": "2026-05-07T14:20:01.177Z",
  "level": "INFO|WARN|ERROR|DEBUG",
  "category": "sync|account|scraper|...",
  "message": "sync_start|step_success|step_fail|sync_end|...",
  "meta": {
    "syncRunId": "uuid",
    "jobId": "bull-job-id",
    "configId": "scraper-config-id",
    "userId": "user-id",
    "providerId": "companyId",
    "providerType": "bank|credit-card|other",
    "providerName": "display-name",
    "accountRef": "***1234",
    "tenantId": "optional",
    "workspaceId": "optional",
    "stage": "sync_start|provider_start|account_start|step_start|step_success|step_fail|account_end|provider_end|sync_end",
    "step": "auth_start|auth_success|post_auth_navigation|open_accounts_overview|open_account_details|apply_filters/date_range|fetch_transactions|parse_transactions|normalize_transactions|persist_results",
    "status": "success|failure|partial",
    "startedAt": "utc-iso",
    "endedAt": "utc-iso",
    "durationMs": 0,
    "attempt": 1,
    "retryCount": 0,
    "timeoutMs": 300000
  }
}
```

## Error Taxonomy
`errorKind` enum:
- `auth_failed`
- `otp_required_or_failed`
- `mfa_timeout`
- `ui_selector_timeout`
- `ui_element_not_interactable`
- `navigation_timeout`
- `network_error`
- `rate_limited`
- `parse_error`
- `data_validation_error`
- `db_unavailable`
- `db_query_error`
- `dependency_error`
- `unknown`

All failures must include:
- `errorKind`, `errorStage`, `isRetryable`
- `errorCode` (if known), `errorMessage`, `errorFingerprint`
- `stackHead` (short)
- `fullStack` only in secure DEBUG/development mode

## Validation
- Critical sync lifecycle events are validated by `LogsService.assertCriticalSyncFields()`.
- Mandatory keys checked for each critical event: `syncRunId`, `jobId`, `configId`, `userId`, `providerId`, `providerType`, `providerName`, `stage`, `status`, `startedAt`, `endedAt`, `durationMs`.
- If missing fields are found, an internal warning is emitted (`Critical sync log missing fields`).

## Example Traces
### 1) Full sync success (multi-account)
```json
{"id":"1","ts":"2026-05-07T14:10:00.001Z","level":"INFO","category":"sync","message":"sync_end","meta":{"syncRunId":"9f3e9a8d-6f2f-48c2-95dc-bae8fba8f890","jobId":"2211","configId":"cfg_1","userId":"usr_1","providerId":"leumi","providerType":"bank","providerName":"בנק לאומי","stage":"sync_end","status":"success","startedAt":"2026-05-07T14:09:18.200Z","endedAt":"2026-05-07T14:10:00.001Z","durationMs":41801,"attempt":1,"retryCount":0,"transactionsFetched":213,"transactionsParsed":213,"transactionsPersisted":205,"duplicatesSkipped":8,"accountsTotal":3,"accountsSucceeded":3,"accountsFailed":0,"partialSync":false}}
```

### 2) Partial sync
```json
{"id":"2","ts":"2026-05-07T14:15:44.120Z","level":"WARN","category":"sync","message":"sync_end","meta":{"syncRunId":"5ac99603-3320-46f7-8584-e9ecf26c3a47","jobId":"2212","configId":"cfg_2","userId":"usr_1","providerId":"hapoalim","providerType":"bank","providerName":"בנק הפועלים","stage":"sync_end","status":"partial","startedAt":"2026-05-07T14:14:58.514Z","endedAt":"2026-05-07T14:15:44.120Z","durationMs":45606,"attempt":1,"retryCount":0,"transactionsFetched":144,"transactionsParsed":112,"transactionsPersisted":108,"duplicatesSkipped":4,"accountsTotal":2,"accountsSucceeded":1,"accountsFailed":1,"partialSync":true}}
```

### 3) `ui_selector_timeout`
```json
{"id":"3","ts":"2026-05-07T14:20:01.177Z","level":"ERROR","category":"sync","message":"step_fail","meta":{"syncRunId":"f9e1e9c9-bbf8-4b1a-8441-2175f4d9e329","jobId":"2213","configId":"cfg_3","userId":"usr_2","providerId":"max","providerType":"credit-card","providerName":"מקס","stage":"step_fail","step":"fetch_transactions","status":"failure","startedAt":"2026-05-07T14:19:31.010Z","endedAt":"2026-05-07T14:20:01.177Z","durationMs":30167,"attempt":1,"retryCount":0,"errorKind":"ui_selector_timeout","errorStage":"fetch_transactions","isRetryable":true,"errorCode":"WAITING_FOR_SELECTOR","errorMessage":"selector timeout","errorFingerprint":"244a1249f5cdfd0b","selectorPrimary":"#transactions-table","selectorAlternatives":[".transactions","[data-testid='tx-table']"],"selectorStats":{"foundCount":0,"visibleCount":0},"browserConsoleErrors":[{"type":"error","text":"Cannot read property ..."}],"failedNetworkRequests":[],"screenshotPath":"logs/snapshots/run-f9e1/step-fail.png","htmlSnapshotPath":"logs/snapshots/run-f9e1/step-fail.html"}}
```

### 4) `db_unavailable`
```json
{"id":"4","ts":"2026-05-07T14:25:50.002Z","level":"ERROR","category":"sync","message":"step_fail","meta":{"syncRunId":"2cd3f0c3-a2df-4ce1-b204-a96bc0ab450e","jobId":"2214","configId":"cfg_4","userId":"usr_3","providerId":"isracard","providerType":"credit-card","providerName":"ישראכרט","stage":"sync_end","status":"failure","startedAt":"2026-05-07T14:25:20.010Z","endedAt":"2026-05-07T14:25:50.002Z","durationMs":29992,"attempt":1,"retryCount":0,"errorKind":"db_unavailable","errorStage":"sync_end","isRetryable":true,"errorMessage":"database unavailable","errorFingerprint":"af2b7f4f881823f6","stackHead":"PrismaClientInitializationError: ...","db":{"host":"postgresql://db:5432","errorClass":"PrismaClientInitializationError","reconnectAttempts":0}}}
```

## Suggested Queries
- Find full trace by run:
  - `q=syncRunId:<uuid>`
- Find top failures:
  - `category=sync&level=ERROR`
  - Group by `meta.errorKind`, then by `meta.providerId`
- Find partial sync runs:
  - `category=sync&q=partialSync`
- Find provider/account hotspots:
  - `q=providerId:<id>`
  - `q=accountRef:***1234`
