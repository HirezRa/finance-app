import { LogsService } from './logs.service';

describe('LogsService — sync trace invariants', () => {
  let svc: LogsService;

  beforeEach(() => {
    svc = new LogsService();
    svc.clear();
  });

  it('hasTerminalSyncForRun is false after sync_start only', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    svc.add('INFO', 'sync', 'sync_start', { syncRunId: id });
    expect(svc.hasTerminalSyncForRun(id)).toBe(false);
  });

  it('hasTerminalSyncForRun is true after sync_end', () => {
    const id = '22222222-2222-2222-2222-222222222222';
    svc.add('INFO', 'sync', 'sync_start', { syncRunId: id });
    svc.add('INFO', 'sync', 'sync_end', { syncRunId: id, status: 'success' });
    expect(svc.hasTerminalSyncForRun(id)).toBe(true);
  });

  it('hasTerminalSyncForRun is true after sync_fail', () => {
    const id = '33333333-3333-3333-3333-333333333333';
    svc.add('ERROR', 'sync', 'sync_fail', {
      syncRunId: id,
      errorKind: 'unknown',
      errorStage: 'test',
    });
    expect(svc.hasTerminalSyncForRun(id)).toBe(true);
  });

  it('exportTrace filters by syncRunId and returns totalMatched', () => {
    svc.add('INFO', 'sync', 'sync_start', { syncRunId: 'aaa' });
    svc.add('INFO', 'sync', 'sync_end', { syncRunId: 'bbb' });
    const { logs, totalMatched } = svc.exportTrace({ syncRunId: 'bbb' });
    expect(totalMatched).toBe(1);
    expect(logs.every((e) => e.meta?.['syncRunId'] === 'bbb')).toBe(true);
  });

  it('exportTrace preset=diagnostic keeps sync WARN|ERROR only', () => {
    svc.add('DEBUG', 'api', 'x', {});
    svc.add('INFO', 'sync', 'sync_start', { syncRunId: 'z' });
    svc.add('WARN', 'sync', 'sync_end', { syncRunId: 'z', status: 'partial' });
    svc.add('ERROR', 'scraper', 'yahav: timeout', {});
    const { logs, totalMatched } = svc.exportTrace({ preset: 'diagnostic' });
    expect(totalMatched).toBe(2);
    expect(logs.every((e) => e.level === 'WARN' || e.level === 'ERROR')).toBe(
      true,
    );
    expect(logs.every((e) => ['sync', 'scraper', 'version', 'update'].includes(e.category))).toBe(true);
  });

  it('buildErrorFingerprint differs when selectorPrimary differs', () => {
    const a = svc.buildErrorFingerprint({
      errorKind: 'ui_selector_timeout',
      errorStage: 'fetch_transactions',
      message: 'timeout',
      selectorPrimary: '#a',
    });
    const b = svc.buildErrorFingerprint({
      errorKind: 'ui_selector_timeout',
      errorStage: 'fetch_transactions',
      message: 'timeout',
      selectorPrimary: '#b',
    });
    expect(a).not.toBe(b);
  });
});
