# Structured Logging Guide (Sync / Scraper)

## Schema version

- `meta.schemaVersion`: **2** (current). Older JSONL lines may omit this field — treat as **1** for migration.
- **Migration:** legacy entries remain valid; new fields (`accountRefHash`, `credit_card`, `sync_fail` / `provider_fail` / `account_fail` messages) appear only on new events.

## Policy & retention

- **Format:** one JSON object per line in `logs/app-logs.jsonl`; API returns the same shape.
- **message:** short, stable event name (`sync_start`, `sync_end`, `sync_fail`, `step_fail`, …); details live in `meta`.
- **Timestamp:** `ts` is ISO 8601 UTC.
- **Forbidden:** passwords, OTP, tokens, cookies, raw `Authorization` headers, full account numbers, full national IDs.
- **Sanitization:** `LogsService` masks sensitive keys, strips URL query/hash for URL-like strings, and caps oversized `meta` (`metaTruncated`, ~48KB JSON).
- **Retention (current implementation):** up to **1000** newest entries in memory and on disk; **JWT-protected** `GET /api/v1/logs` and `GET /api/v1/logs/export`. Tune `MAX_LOGS` in code if you need a different cap.

## Correlation (required on sync events)

| Field | Description |
|--------|-------------|
| `syncRunId` | UUID per sync run |
| `jobId` | Bull job id |
| `configId` | Scraper config id |
| `userId` | User id |
| `providerId` | Institution id (e.g. leumi) |
| `providerType` | `bank` \| `credit_card` \| `other` |
| `providerName` | Display name |
| `accountRef` | Masked account suffix (`***1234`) when scoped to an account |
| `accountRefHash` | SHA-256 prefix (24 hex) over `userId\|providerId\|accountNumber` — not reversible to full number |
| `requestId` / `traceparent` | Optional, if gateway injects them |

## Lifecycle (mandatory closure)

Every `syncRunId` that emitted **`sync_start`** must end with exactly one of:

- **`sync_end`** — `status`: `success` \| `partial` \| `failure`
- **`sync_fail`** — terminal failure with `errorKind` / `errorStage`

Intermediate events:

- `provider_start` → `provider_end` **or** `provider_fail`
- `account_start` → `account_end` **or** `account_fail` (multi-account)
- `step_start` → `step_success` **or** `step_fail`

## Queue / job (`meta.queue`)

- `queueName`, `enqueueTs`, `dequeueTs`, `waitMs`, `runMs`
- `maxRetries`, `jobTimeoutMs` (Bull `attempts` / `timeout`)
- `attempt`, `retryCount` on lifecycle meta

## Runtime (repeat on `sync_fail`)

- `appVersion`, `scraperPackageVersion`, `scraperPackageSource`
- `scraperGitSha`, `nodeVersion`, `nodeEnv`
- `browserEngine`, `browserVersion`, `osPlatform`, `containerImageDigest` (optional env)

## Business metrics (`sync_end` / `provider_end`)

- `transactionsFetched`, `transactionsParsed`, `transactionsPersisted`, `duplicatesSkipped`
- `accountsTotal`, `accountsSucceeded`, `accountsFailed`, `partialSync`
- `dataWindow`: `{ from, to }` ISO UTC

## Error taxonomy (`errorKind`)

`auth_failed` | `otp_required_or_failed` | `mfa_timeout` | `ui_selector_timeout` | `ui_element_not_interactable` | `navigation_timeout` | `network_error` | `rate_limited` | `parse_error` | `data_validation_error` | `db_unavailable` | `db_query_error` | `dependency_error` | `unknown`

Required on ERROR sync events:

- `errorKind`, `errorStage` (short string, e.g. `persist_transactions`, `fetch_transactions`)
- `isRetryable`, `errorMessage`, `errorFingerprint`
- `errorCode` when available (e.g. Prisma code)
- `stackHead` (5–15 lines); `fullStack` only in development / secured DEBUG

**Fingerprint:** stable hash over `errorKind`, `errorStage`, `providerId`, `errorCode`, message prefix, and **`selectorPrimary`** (UI failures).

## UI automation (`step_fail` on scrape)

- `pageUrl`, `frameUrl` (sanitized)
- `documentReadyState`
- `selectorPrimary`, `selectorAlternatives[]`, `selectorStats`
- `waitTimeoutMs`
- `screenshotArtifactId`, `screenshotPath`, `htmlSnapshotPath` (internal paths — not public URLs)
- `browserConsoleErrors[]` (type + truncated text)
- `failedNetworkRequests[]` (sanitized url, method, status, resourceType)

## DB / Prisma (`sync_fail` / `step_fail`)

- `db.dbHost`, `db.dbPort` (parsed from `DATABASE_URL`, no password)
- `db.prismaErrorCode`, `db.errorClass`, `db.reconnectAttempts`
- `poolState` — reserved for future use when exposed by the driver

## Export API

`GET /api/v1/logs/export?syncRunId=&providerId=&from=&to=&limit=`  
Returns `{ logs, totalMatched }` — all in-buffer events matching filters (same `syncRunId` for a full trace).

---

## Example JSON

### a) `sync_success` (excerpt)

```json
{"id":"…","ts":"2026-05-07T14:10:00.001Z","level":"INFO","category":"sync","message":"sync_end","meta":{"schemaVersion":2,"syncRunId":"9f3e9a8d-6f2f-48c2-95dc-bae8fba8f890","jobId":"2211","configId":"cfg_1","userId":"usr_1","providerId":"leumi","providerType":"bank","providerName":"בנק לאומי","stage":"sync_end","status":"success","attempt":1,"retryCount":0,"transactionsFetched":213,"transactionsParsed":213,"transactionsPersisted":205,"duplicatesSkipped":8,"accountsTotal":3,"accountsSucceeded":3,"accountsFailed":0,"partialSync":false,"dataWindow":{"from":"2026-02-07T00:00:00.000Z","to":"2026-05-07T14:10:00.001Z"}}}
```

### b) `partial_sync`

```json
{"id":"…","ts":"2026-05-07T14:15:44.120Z","level":"WARN","category":"sync","message":"sync_end","meta":{"schemaVersion":2,"syncRunId":"5ac99603-3320-46f7-8584-e9ecf26c3a47","jobId":"2212","configId":"cfg_2","userId":"usr_1","providerId":"hapoalim","providerType":"bank","providerName":"בנק הפועלים","stage":"sync_end","status":"partial","accountsTotal":2,"accountsSucceeded":1,"accountsFailed":1,"partialSync":true,"transactionsPersisted":108}}
```

### c) `ui_selector_timeout` (`step_fail` + `provider_fail` + `sync_fail` chain)

```json
{"level":"ERROR","category":"sync","message":"step_fail","meta":{"schemaVersion":2,"syncRunId":"…","providerId":"max","providerType":"credit_card","stage":"step_fail","step":"fetch_transactions","errorKind":"ui_selector_timeout","errorStage":"fetch_transactions","selectorPrimary":"#tx-table","waitTimeoutMs":30000,"browserConsoleErrors":[{"type":"error","text":"…"}]}}
```

```json
{"level":"ERROR","category":"sync","message":"sync_fail","meta":{"schemaVersion":2,"syncRunId":"…","stage":"sync_fail","errorKind":"ui_selector_timeout","errorStage":"fetch_transactions","runtime":{"appVersion":"2.0.34","scraperPackageVersion":"github:HirezRa/israeli-bank-scrapers#hirez-v1.0.12"}}}
```

### d) `db_unavailable`

```json
{"level":"ERROR","category":"sync","message":"sync_fail","meta":{"schemaVersion":2,"syncRunId":"…","stage":"sync_fail","errorKind":"db_unavailable","errorStage":"sync_uncaught","db":{"dbHost":"db","dbPort":5432,"prismaErrorCode":"P1001","errorClass":"PrismaClientKnownRequestError","reconnectAttempts":0}}}
```

## Suggested queries

- Full trace: `GET /logs/export?syncRunId=<uuid>`
- Failures: `GET /logs?category=sync&level=ERROR`
- By provider: `GET /logs/export?providerId=leumi&from=2026-05-01T00:00:00.000Z`

## Tests

- `backend/npm test` — invariants: terminal event after `sync_start`, export filter, fingerprint sensitivity to selector.
