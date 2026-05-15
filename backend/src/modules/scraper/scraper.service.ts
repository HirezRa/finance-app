import { Injectable, Logger } from '@nestjs/common';
import {
  CompanyTypes,
  createScraper,
  ScraperOptions,
} from 'israeli-bank-scrapers';
import type { ScraperCredentials } from 'israeli-bank-scrapers';
import {
  AccountType,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScraperConfigService } from './scraper-config.service';
import { N8nWebhookService } from '../alerts/n8n-webhook.service';
import { OllamaCategorizerService } from './ollama-categorizer.service';
import { createHash } from 'crypto';
import { computeSalaryEffectiveDateForBankDate } from '../../common/utils/salary-effective-date';
import {
  getIsraelDayOfMonth,
  getIsraelYearMonth,
  isStrictIsoDateOnly,
} from '../../common/utils/israel-calendar';
import { normalizeScraperDateFromRaw } from '../../common/utils/scraper-date-normalize';
import { LogsService } from '../logs/logs.service';
import { shortenSyncErrorMessage } from '../../common/utils/sync-error-message';
import {
  markSyncFailureLogged,
  wasSyncFailureLogged,
} from '../logs/sync-fail-marked';
import type {
  ProviderType,
  SyncLifecycleEventMeta,
  SyncStage,
  SyncStatus,
  SyncTraceContext,
} from '../logs/logs.types';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  private mapInstitutionTypeToProviderType(input: string | undefined): ProviderType {
    if (input === 'bank') return 'bank';
    if (input === 'card') return 'credit_card';
    return 'other';
  }

  private truncateBrowserConsoleErrors(raw: unknown): unknown[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 25).map((x) => {
      if (x !== null && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        const text = String(o.text ?? o.message ?? '').slice(0, 400);
        return { type: String(o.type ?? 'error'), text };
      }
      return { type: 'unknown', text: String(x).slice(0, 200) };
    });
  }

  private createLifecycle(params: {
    stage: SyncStage;
    status: SyncStatus;
    startedAt: Date;
    endedAt?: Date;
    attempt: number;
    retryCount: number;
    timeoutMs?: number;
    maxRetries?: number;
    extra?: Omit<
      SyncLifecycleEventMeta,
      | 'stage'
      | 'status'
      | 'startedAt'
      | 'endedAt'
      | 'durationMs'
      | 'attempt'
      | 'retryCount'
      | 'timeoutMs'
      | 'maxRetries'
    >;
  }): SyncLifecycleEventMeta {
    const endedAt = params.endedAt ?? new Date();
    return {
      stage: params.stage,
      status: params.status,
      startedAt: params.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - params.startedAt.getTime(),
      attempt: params.attempt,
      retryCount: params.retryCount,
      timeoutMs: params.timeoutMs,
      maxRetries: params.maxRetries,
      ...params.extra,
    };
  }

  private classifyScraperError(
    errorType: string,
    errorMessage: string,
  ): 'auth' | 'timeout' | 'blocked' | 'parse' | 'network' | 'unknown' {
    const type = errorType?.toLowerCase() || '';
    const msg = errorMessage?.toLowerCase() || '';
    if (
      type.includes('invalid_password') ||
      type.includes('change_password') ||
      msg.includes('password')
    ) {
      return 'auth';
    }
    if (type.includes('timeout') || msg.includes('timeout')) {
      return 'timeout';
    }
    if (
      type.includes('blocked') ||
      msg.includes('blocked') ||
      msg.includes('captcha')
    ) {
      return 'blocked';
    }
    if (
      msg.includes('parse') ||
      msg.includes('unexpected') ||
      msg.includes('waiting for selector')
    ) {
      return 'parse';
    }
    if (
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return 'network';
    }
    return 'unknown';
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ScraperConfigService,
    private readonly n8nWebhook: N8nWebhookService,
    private readonly ollamaCategorizer: OllamaCategorizerService,
    private readonly appLogs: LogsService,
  ) {}

  getSupportedInstitutions() {
    return [
      { id: 'hapoalim', name: 'בנק הפועלים', type: 'bank', fields: ['userCode', 'password'] },
      { id: 'leumi', name: 'בנק לאומי', type: 'bank', fields: ['username', 'password'] },
      { id: 'discount', name: 'בנק דיסקאונט', type: 'bank', fields: ['id', 'password', 'num'] },
      { id: 'mercantile', name: 'בנק מרכנתיל', type: 'bank', fields: ['id', 'password', 'num'] },
      { id: 'mizrahi', name: 'מזרחי טפחות', type: 'bank', fields: ['username', 'password'] },
      { id: 'otsarHahayal', name: 'אוצר החייל', type: 'bank', fields: ['username', 'password'] },
      { id: 'union', name: 'בנק איגוד', type: 'bank', fields: ['username', 'password'] },
      { id: 'beinleumi', name: 'הבינלאומי', type: 'bank', fields: ['username', 'password'] },
      { id: 'massad', name: 'בנק מסד', type: 'bank', fields: ['username', 'password'] },
      { id: 'yahav', name: 'בנק יהב', type: 'bank', fields: ['username', 'password', 'nationalID'] },
      {
        id: 'oneZero',
        name: 'OneZero',
        type: 'bank',
        fields: ['email', 'password', 'phoneNumber', 'otpCodeRetriever', 'otpLongTermToken'],
      },
      { id: 'pagi', name: 'פגי', type: 'bank', fields: ['username', 'password'] },
      { id: 'isracard', name: 'ישראכרט', type: 'card', fields: ['id', 'card6Digits', 'password'] },
      { id: 'visaCal', name: 'ויזה כאל', type: 'card', fields: ['username', 'password'] },
      { id: 'max', name: 'מקס', type: 'card', fields: ['username', 'password'] },
      { id: 'amex', name: 'אמריקן אקספרס', type: 'card', fields: ['id', 'card6Digits', 'password'] },
      { id: 'behatsdaa', name: 'בהצדעה', type: 'card', fields: ['id', 'password'] },
    ];
  }

  /**
   * Duplicates historically came from: (1) hash without bank id / weak text normalization
   * so re-scrapes looked "new"; (2) rare parallel syncs racing before DB commit (mitigated by
   * unique scraperHash + composite unique + P2002). (3) bank changing description slightly —
   * composite unique still catches identical rows; near-misses rely on hash + secondary findFirst.
   */
  private normalizeTxnText(s: string | undefined | null): string {
    return String(s ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u200f\u200e]/g, '');
  }

  /** מטבע מקורי, סימון חו"ל ושער המרה משוער (חיוב בשקלים / סכום מקורי). */
  private resolveForeignCurrencyFields(
    txn: Record<string, unknown>,
    chargedAmountIls: number,
  ): {
    originalAmount: Prisma.Decimal | null;
    originalCurrency: string;
    exchangeRate: Prisma.Decimal | null;
    isAbroad: boolean;
  } {
    const currency =
      String(txn.originalCurrency ?? 'ILS').trim().toUpperCase() || 'ILS';
    const origRaw = txn.originalAmount;
    const hasOrig =
      origRaw !== undefined &&
      origRaw !== null &&
      Number.isFinite(Number(origRaw));
    const originalAmount = hasOrig
      ? new Prisma.Decimal(Number(origRaw))
      : null;
    const isAbroad = currency !== 'ILS';
    let exchangeRate: Prisma.Decimal | null = null;
    if (
      isAbroad &&
      originalAmount &&
      !originalAmount.equals(0) &&
      Number.isFinite(chargedAmountIls)
    ) {
      const denom = originalAmount.abs().toNumber();
      if (denom > 0) {
        const rate = Math.abs(chargedAmountIls) / denom;
        if (Number.isFinite(rate) && rate > 0) {
          exchangeRate = new Prisma.Decimal(rate);
        }
      }
    }
    if (!isAbroad) {
      return {
        originalAmount: null,
        originalCurrency: 'ILS',
        exchangeRate: null,
        isAbroad: false,
      };
    }
    return {
      originalAmount,
      originalCurrency: currency,
      exchangeRate,
      isAbroad: true,
    };
  }

  /**
   * תאריך סקרייפר ללוח ישראל + תחילת יום אזרחי — ראו {@link normalizeScraperDateFromRaw}.
   */
  private resolveScraperDateSemantics(rawDate: string): {
    ymdIso: string;
    dayStart: Date;
    dayEnd: Date;
    dateForRow: Date;
  } {
    return normalizeScraperDateFromRaw(rawDate, (m) => this.logger.warn(m));
  }

  /** @param dateStrIsraelYmd מתוך {@link resolveScraperDateSemantics} (לוח ישראל). */
  private buildTransactionHash(
    accountId: string,
    txn: Record<string, unknown>,
    dateStrIsraelYmd: string,
  ): string {
    const normalizedDesc = this.normalizeTxnText(
      String(txn.description ?? txn.memo ?? ''),
    );

    const amount =
      txn.chargedAmount !== undefined && txn.chargedAmount !== null
        ? Number(txn.chargedAmount)
        : txn.amount !== undefined && txn.amount !== null
          ? Number(txn.amount)
          : 0;
    const amountStr = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';

    const idRaw = txn.referenceNumber ?? txn.identifier;
    const bankId =
      idRaw === null || idRaw === undefined || idRaw === '' ? '' : String(idRaw);

    const hashInput = `${accountId}|${dateStrIsraelYmd}|${amountStr}|${normalizedDesc}|${bankId}`;
    this.logger.debug(`Hash input: ${hashInput}`);

    return createHash('sha256').update(hashInput).digest('hex');
  }

  /** effectiveDate = תאריך מוזז לחודש הבא למשכורת בטווח ימים (לוח ישראלי); אחרת null (דשבורד משתמש ב-date) */
  private async calculateEffectiveDate(
    userId: string,
    txnDate: Date,
    categoryId: string | null,
    salaryStart: number,
    salaryEnd: number,
    category: { isIncome: boolean } | null,
  ): Promise<Date | null> {
    if (!categoryId || !category?.isIncome) {
      return null;
    }
    const effective = computeSalaryEffectiveDateForBankDate(
      txnDate,
      true,
      salaryStart,
      salaryEnd,
    );
    if (effective) {
      this.logger.log(
        `Salary ${txnDate.toISOString()} -> effectiveDate ${effective.toISOString()} (user ${userId})`,
      );
    }
    return effective;
  }

  /** התאמת pending לאותה עסקה ב-completed (לפי חודש-יום ישראלי, לא שנה מלאה). */
  private generatePendingMatchHash(
    accountId: string,
    date: Date,
    amount: number,
    description: string,
  ): string {
    const normalizedDesc = this.normalizeDescriptionForPendingMatch(description);
    const { month } = getIsraelYearMonth(date);
    const day = getIsraelDayOfMonth(date);
    const monthDay = `${month}-${day}`;
    const roundedAmount = Math.round(Number.isFinite(amount) ? amount : 0);
    const input = `${accountId}|${monthDay}|${roundedAmount}|${normalizedDesc}`;
    return createHash('md5').update(input).digest('hex').substring(0, 16);
  }

  private normalizeDescriptionForPendingMatch(desc: string): string {
    return (desc || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u200f\u200e]/g, '')
      .toLowerCase()
      .substring(0, 50);
  }

  /** מילות מפתח לזיהוי חיוב אגרגטיבי של חברת אשראי בשורת חשבון בנק */
  private readonly CREDIT_CARD_CHARGE_KEYWORDS = [
    'ישראכרט',
    'isracard',
    'כרטיסי אשראי',
    'מקס איט',
    'max it',
    'ויזה כאל',
    'visa cal',
    'לאומי קארד',
    'leumi card',
    'אמריקן אקספרס',
    'american express',
    'פרימיום אקספרס',
    'דיינרס',
    'diners',
  ];

  private isCreditCardChargeFromBankLine(description: string): boolean {
    const lowerDesc = (description || '').toLowerCase();
    return this.CREDIT_CARD_CHARGE_KEYWORDS.some((keyword) =>
      lowerDesc.includes(keyword.toLowerCase()),
    );
  }

  private determineTransactionType(txn: Record<string, unknown>): TransactionType {
    const installments = txn.installments as
      | { number?: number; total?: number }
      | undefined;
    const totalInst =
      installments?.total !== undefined && installments.total !== null
        ? Number(installments.total)
        : NaN;
    if (Number.isFinite(totalInst) && totalInst > 1) {
      return TransactionType.INSTALLMENTS;
    }

    const rawDesc = String(txn.description ?? txn.memo ?? '');
    const desc = rawDesc.toLowerCase();

    if (desc.includes('זיכוי') || desc.includes('החזר') || desc.includes('refund')) {
      return TransactionType.REFUND;
    }

    if (
      desc.includes('משיכה') ||
      desc.includes('מזומן') ||
      desc.includes('כספומט') ||
      desc.includes('atm')
    ) {
      return TransactionType.CASH;
    }

    if (
      desc.includes('העברה') ||
      desc.includes('transfer') ||
      desc.includes('bit') ||
      desc.includes('paybox')
    ) {
      return TransactionType.TRANSFER;
    }

    if (desc.includes('עמלה') || desc.includes('דמי ניהול') || desc.includes('fee')) {
      return TransactionType.FEE;
    }

    if (desc.includes('ריבית') || desc.includes('interest')) {
      return TransactionType.INTEREST;
    }

    const typeStr = String(txn.type ?? 'normal').toLowerCase();
    if (typeStr === 'installments') {
      return TransactionType.INSTALLMENTS;
    }

    return TransactionType.NORMAL;
  }

  private resolveTransactionTypeAndInstallments(txn: Record<string, unknown>): {
    type: TransactionType;
    installmentNumber: number | null;
    installmentTotal: number | null;
  } {
    const installments = txn.installments as
      | { number?: number; total?: number }
      | undefined;
    const rawNum = (v: unknown): number | null => {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const installmentNumber = rawNum(installments?.number);
    const installmentTotal = rawNum(installments?.total);

    let type = this.determineTransactionType(txn);

    const typeStr = String(txn.type ?? 'normal').toLowerCase();
    if (
      typeStr === 'installments' &&
      installmentTotal !== null &&
      installmentTotal > 1
    ) {
      type = TransactionType.INSTALLMENTS;
    }

    return { type, installmentNumber, installmentTotal };
  }

  private computeBankCreditCardChargeExclusion(params: {
    accountType: AccountType;
    rawDescriptionForMatch: string;
    amount: number;
    autoExcludeEnabled: boolean;
  }): { isExcludedFromCashFlow: boolean; note: string | null } {
    if (!params.autoExcludeEnabled) {
      return { isExcludedFromCashFlow: false, note: null };
    }
    if (params.accountType !== AccountType.BANK) {
      return { isExcludedFromCashFlow: false, note: null };
    }
    if (!Number.isFinite(params.amount) || params.amount >= 0) {
      return { isExcludedFromCashFlow: false, note: null };
    }
    if (!this.isCreditCardChargeFromBankLine(params.rawDescriptionForMatch)) {
      return { isExcludedFromCashFlow: false, note: null };
    }
    return {
      isExcludedFromCashFlow: true,
      note: 'חיוב אשראי - לא נספר בתקציב (נספר דרך חברת האשראי)',
    };
  }

  private isSimilarDescription(desc1: string, desc2: string): boolean {
    if (!desc1 || !desc2) return false;
    if (desc1.includes(desc2) || desc2.includes(desc1)) {
      return true;
    }
    const words1 = new Set(desc1.split(' ').filter((w) => w.length > 2));
    const words2 = new Set(desc2.split(' ').filter((w) => w.length > 2));
    if (words1.size === 0 || words2.size === 0) return false;
    let matches = 0;
    for (const word of words1) {
      if (words2.has(word)) matches++;
    }
    const similarity = matches / Math.max(words1.size, words2.size);
    return similarity >= 0.7;
  }

  private async findMatchingPendingTransaction(
    accountId: string,
    txn: Record<string, unknown>,
  ): Promise<string | null> {
    const amount = Number(
      txn.chargedAmount !== undefined && txn.chargedAmount !== null
        ? txn.chargedAmount
        : txn.amount !== undefined && txn.amount !== null
          ? txn.amount
          : 0,
    );
    const rawDateStr = String(txn.date ?? '').trim();
    if (!rawDateStr) return null;
    const parsedProbe = new Date(rawDateStr);
    const head10 = rawDateStr.slice(0, 10);
    if (Number.isNaN(parsedProbe.getTime()) && !isStrictIsoDateOnly(head10)) {
      return null;
    }
    const sem = this.resolveScraperDateSemantics(rawDateStr);
    const description = String(txn.description || txn.memo || '').trim();
    const matchHash = this.generatePendingMatchHash(
      accountId,
      sem.dateForRow,
      amount,
      description,
    );

    const pendingByHash = await this.prisma.transaction.findFirst({
      where: {
        accountId,
        status: TransactionStatus.PENDING,
        pendingMatchHash: matchHash,
      },
    });
    if (pendingByHash) return pendingByHash.id;

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const dateStart = new Date(sem.dayStart.getTime() - threeDaysMs);
    const dateEnd = new Date(sem.dayEnd.getTime() + threeDaysMs);

    const amountMin = amount * 0.95;
    const amountMax = amount * 1.05;
    const normalizedDesc = this.normalizeDescriptionForPendingMatch(description);

    const candidates = await this.prisma.transaction.findMany({
      where: {
        accountId,
        status: TransactionStatus.PENDING,
        date: { gte: dateStart, lte: dateEnd },
        amount: {
          gte: new Prisma.Decimal(amountMin),
          lte: new Prisma.Decimal(amountMax),
        },
      },
    });

    for (const candidate of candidates) {
      const candidateDesc = this.normalizeDescriptionForPendingMatch(candidate.description);
      if (this.isSimilarDescription(normalizedDesc, candidateDesc)) {
        return candidate.id;
      }
    }

    return null;
  }

  private getAccountType(institutionId: string): 'BANK' | 'CREDIT_CARD' {
    const creditCardCompanies = ['isracard', 'visaCal', 'max', 'amex', 'behatsdaa'];
    return creditCardCompanies.includes(institutionId) ? 'CREDIT_CARD' : 'BANK';
  }

  private async findOrCreateAccount(
    userId: string,
    institutionId: string,
    institutionName: string,
    accountNumber: string,
  ) {
    const num = accountNumber || 'default';
    let account = await this.prisma.account.findFirst({
      where: {
        userId,
        institutionId,
        accountNumber: num,
      },
    });

    if (!account) {
      account = await this.prisma.account.create({
        data: {
          userId,
          institutionId,
          institutionName,
          accountNumber: num,
          accountType: this.getAccountType(institutionId),
        },
      });
      this.logger.log(`Created new account: ${num} for ${institutionId}`);
      this.appLogs.add('INFO', 'account', 'נוצר חשבון חדש מסנכרון', {
        institutionId,
        accountNumber: num,
      });
    }

    return account;
  }

  /** Read balance from scraper account objects (field names vary by institution). */
  private extractScraperBalance(account: Record<string, unknown>): number | null {
    const nested = account.summary as Record<string, unknown> | undefined;
    const candidates: unknown[] = [
      account.balance,
      account.accountBalance,
      account.currentBalance,
      nested?.balance,
      nested?.currentBalance,
    ];
    for (const c of candidates) {
      if (c === null || c === undefined || c === '') continue;
      const n = typeof c === 'number' ? c : Number(c);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  private async updateAccountBalance(
    accountId: string,
    balance: number | null | undefined,
  ): Promise<void> {
    if (balance === null || balance === undefined) {
      this.logger.debug(`No balance to persist for account ${accountId}`);
      return;
    }
    this.logger.log(`Updating account ${accountId} balance to ${balance}`);
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        balance: new Prisma.Decimal(balance),
        lastSyncAt: new Date(),
      },
    });
  }

  async runScraper(
    configId: string,
    userId: string,
    jobId: string,
    syncRunId: string,
    queueMeta?: {
      queueName: string;
      enqueueTs?: string;
      dequeueTs?: string;
      waitMs?: number;
      maxRetries?: number;
      jobTimeoutMs?: number;
      attempt?: number;
    },
  ) {
    const config = await this.configService.getDecryptedConfig(configId, userId);

    const institutionMeta = this.getSupportedInstitutions().find(
      (i) => i.id === config.companyId,
    );
    const displayName =
      config.companyDisplayName || institutionMeta?.name || config.companyId;
    const providerType = this.mapInstitutionTypeToProviderType(institutionMeta?.type);
    const traceBase: SyncTraceContext = this.appLogs.createSyncTraceContext({
      syncRunId,
      jobId,
      configId,
      userId,
      providerId: config.companyId,
      providerType,
      providerName: displayName,
      queueName: queueMeta?.queueName,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    this.logger.log(
      `Starting scraper for ${config.companyId} (config: ${configId}), startDate: ${startDate.toISOString()}`,
    );
    const syncT0 = Date.now();
    const syncStart = new Date();
    const attemptNo = queueMeta?.attempt ?? 1;
    const retryCount = Math.max(0, attemptNo - 1);
    const jobTimeoutMs = queueMeta?.jobTimeoutMs ?? 5 * 60 * 1000;

    this.appLogs.logSyncLifecycle(
      'INFO',
      'sync_start',
      traceBase,
      this.createLifecycle({
        stage: 'sync_start',
        status: 'success',
        startedAt: syncStart,
        endedAt: syncStart,
        attempt: attemptNo,
        retryCount,
        timeoutMs: jobTimeoutMs,
        maxRetries: queueMeta?.maxRetries,
        extra: {
          queue: queueMeta
            ? {
                queueName: queueMeta.queueName,
                enqueueTs: queueMeta.enqueueTs,
                dequeueTs: queueMeta.dequeueTs,
                waitMs: queueMeta.waitMs,
                maxRetries: queueMeta.maxRetries,
                jobTimeoutMs: queueMeta.jobTimeoutMs,
              }
            : undefined,
          runtime: this.appLogs.getSyncRuntimeInfo(),
          dataWindow: {
            from: startDate.toISOString(),
            to: new Date().toISOString(),
          },
        },
      }),
    );

    const supported = this.getSupportedInstitutions().some((i) => i.id === config.companyId);
    if (!supported) {
      const err = new Error(`Unsupported companyId: ${config.companyId}`);
      const shortMsg = shortenSyncErrorMessage(err.message);
      const errorFingerprint = this.appLogs.buildErrorFingerprint({
        errorKind: 'dependency_error',
        errorStage: 'unsupported_provider',
        providerId: config.companyId,
        message: err.message,
      });
      this.appLogs.logSyncFailure(
        'sync_fail',
        traceBase,
        this.createLifecycle({
          stage: 'sync_fail',
          status: 'failure',
          startedAt: syncStart,
          attempt: attemptNo,
          retryCount,
          timeoutMs: jobTimeoutMs,
          maxRetries: queueMeta?.maxRetries,
          extra: {
            queue: queueMeta
              ? {
                  queueName: queueMeta.queueName,
                  enqueueTs: queueMeta.enqueueTs,
                  dequeueTs: queueMeta.dequeueTs,
                  waitMs: queueMeta.waitMs,
                  maxRetries: queueMeta.maxRetries,
                  jobTimeoutMs: queueMeta.jobTimeoutMs,
                }
              : undefined,
            runtime: this.appLogs.getSyncRuntimeInfo(),
            dataWindow: {
              from: startDate.toISOString(),
              to: new Date().toISOString(),
            },
          },
        }),
        {
          errorKind: 'dependency_error',
          errorStage: 'unsupported_provider',
          isRetryable: false,
          errorMessage: shortMsg,
          errorFingerprint,
        },
      );
      markSyncFailureLogged(err);
      await this.configService.updateSyncStatus(configId, 'error', err.message);
      throw err;
    }
    this.appLogs.add('INFO', 'scraper', `מתחיל סנכרון: ${displayName}`, {
      scraperConfigId: configId,
      companyId: config.companyId,
    });

    const options: ScraperOptions = {
      companyId: config.companyId as CompanyTypes,
      startDate,
      combineInstallments: false,
      showBrowser: false,
      verbose: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-zygote',
        '--disable-namespace-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };

    try {
      const providerStart = new Date();
      this.appLogs.logSyncLifecycle(
        'INFO',
        'provider_start',
        traceBase,
        this.createLifecycle({
          stage: 'provider_start',
          status: 'success',
          startedAt: providerStart,
          endedAt: providerStart,
          attempt: attemptNo,
          retryCount,
        }),
      );

      const authStepStart = new Date();
      this.appLogs.logSyncLifecycle(
        'INFO',
        'step_start',
        traceBase,
        this.createLifecycle({
          stage: 'step_start',
          status: 'success',
          startedAt: authStepStart,
          endedAt: authStepStart,
          attempt: attemptNo,
          retryCount,
          extra: { step: 'auth_start' },
        }),
      );

      const scraper = createScraper(options);
      const result = await scraper.scrape(
        config.credentials as unknown as ScraperCredentials,
      );

      this.appLogs.logSyncLifecycle(
        'INFO',
        'step_success',
        traceBase,
        this.createLifecycle({
          stage: 'step_success',
          status: 'success',
          startedAt: authStepStart,
          attempt: attemptNo,
          retryCount,
          extra: { step: 'auth_success' },
        }),
      );
      for (const flowStep of [
        'post_auth_navigation',
        'open_accounts_overview',
        'open_account_details',
        'apply_filters/date_range',
        'fetch_transactions',
      ] as const) {
        const stepStart = new Date();
        this.appLogs.logSyncLifecycle(
          'INFO',
          'step_success',
          traceBase,
          this.createLifecycle({
            stage: 'step_success',
            status: 'success',
            startedAt: stepStart,
            endedAt: stepStart,
            attempt: attemptNo,
            retryCount,
            extra: { step: flowStep },
          }),
        );
      }

      this.logger.log(
        `Scraper raw result: ${JSON.stringify({
          success: result.success,
          errorType: result.errorType,
          errorMessage: result.errorMessage,
          accountsCount: result.accounts?.length,
          accounts: result.accounts?.map((a) => ({
            accountNumber: a.accountNumber,
            balance: a.balance,
            txnsCount: a.txns?.length,
            firstTxnDate: a.txns?.[0]?.date,
            lastTxnDate: a.txns?.length
              ? a.txns?.[a.txns.length - 1]?.date
              : undefined,
          })),
        })}`,
      );

      if (!result.success) {
        const resultMeta = result as unknown as Record<string, unknown>;
        const errMsg =
          result.errorMessage || String(result.errorType || '') || 'Scrape failed';
        const shortMsg = shortenSyncErrorMessage(errMsg);
        const errorKind = this.appLogs.classifyErrorKindFromStrings(
          String(result.errorType ?? ''),
          errMsg,
        );
        const classified = this.classifyScraperError(
          String(result.errorType ?? ''),
          result.errorMessage ?? '',
        );
        const selectorPrimary =
          typeof resultMeta.selectorPrimary === 'string'
            ? resultMeta.selectorPrimary
            : undefined;
        const waitTimeoutMs =
          typeof resultMeta.waitTimeoutMs === 'number'
            ? resultMeta.waitTimeoutMs
            : typeof resultMeta.timeout === 'number'
              ? resultMeta.timeout
              : undefined;

        const rawStack =
          typeof resultMeta.stack === 'string' ? resultMeta.stack : undefined;
        const stackHeadFromScraper = rawStack
          ? rawStack.split('\n').slice(0, 15).join('\n')
          : undefined;
        const errorCause =
          typeof resultMeta.errorCause === 'string'
            ? resultMeta.errorCause
            : typeof resultMeta.stageLabel === 'string'
              ? resultMeta.stageLabel
              : undefined;

        const consoleArr = resultMeta.browserConsoleErrors;
        const netArr = resultMeta.failedNetworkRequests;
        const selAltArr = resultMeta.selectorAlternatives;
        const scraperDiagnosticsEmpty =
          (!Array.isArray(consoleArr) || consoleArr.length === 0) &&
          (!Array.isArray(netArr) || netArr.length === 0) &&
          (!Array.isArray(selAltArr) || selAltArr.length === 0);

        this.appLogs.logScraperIssue(
          displayName,
          classified,
          result.errorMessage || errMsg,
          { errorType: result.errorType, configId },
        );
        this.appLogs.add('ERROR', 'sync', `סנכרון נכשל: ${displayName} — ${shortMsg}`, {
          companyId: config.companyId,
          configId,
          errorType: result.errorType,
          durationMs: Date.now() - syncT0,
          errorFull: errMsg,
        });
        const errorFingerprint = this.appLogs.buildErrorFingerprint({
          errorKind,
          errorStage: 'fetch_transactions',
          providerId: config.companyId,
          code: String(result.errorType ?? ''),
          message: errMsg,
          selectorPrimary,
        });
        this.appLogs.logSyncFailure(
          'step_fail',
          traceBase,
          this.createLifecycle({
            stage: 'step_fail',
            status: 'failure',
            startedAt: authStepStart,
            attempt: attemptNo,
            retryCount,
            extra: { step: 'fetch_transactions' },
          }),
          {
            errorKind,
            errorStage: 'fetch_transactions',
            isRetryable: true,
            errorCode: String(result.errorType ?? ''),
            errorMessage: shortMsg,
            errorFull: errMsg,
            errorCause,
            errorFingerprint,
            stackHead: stackHeadFromScraper,
          },
          {
            runtime: this.appLogs.getSyncRuntimeInfo(),
            pageUrl: this.appLogs.maskUrl(
              typeof resultMeta.url === 'string'
                ? (resultMeta.url as string)
                : undefined,
            ),
            frameUrl: this.appLogs.maskUrl(
              typeof resultMeta.frameUrl === 'string'
                ? (resultMeta.frameUrl as string)
                : undefined,
            ),
            documentReadyState: resultMeta.documentReadyState,
            selectorPrimary,
            selectorAlternatives: resultMeta.selectorAlternatives ?? [],
            selectorStats: resultMeta.selectorStats,
            waitTimeoutMs,
            screenshotArtifactId: resultMeta.screenshotArtifactId,
            screenshotPath: resultMeta.screenshotPath,
            htmlSnapshotPath: resultMeta.htmlSnapshotPath,
            browserConsoleErrors: this.truncateBrowserConsoleErrors(
              resultMeta.browserConsoleErrors,
            ),
            failedNetworkRequests: Array.isArray(resultMeta.failedNetworkRequests)
              ? (resultMeta.failedNetworkRequests as unknown[]).slice(0, 30)
              : [],
            ...(scraperDiagnosticsEmpty
              ? {
                  scraperDiagnosticsHint:
                    'אין נתוני Puppeteer מהסקרייפר (console/network/selectors). ניתן להריץ עם DEBUG=israeli-bank-scrapers:* או לשדרג את israeli-bank-scrapers לאיסוף אבחון.',
                }
              : {}),
          },
        );

        this.appLogs.logSyncFailure(
          'provider_fail',
          traceBase,
          this.createLifecycle({
            stage: 'provider_fail',
            status: 'failure',
            startedAt: providerStart,
            attempt: attemptNo,
            retryCount,
            extra: {
              dataWindow: {
                from: startDate.toISOString(),
                to: new Date().toISOString(),
              },
            },
          }),
          {
            errorKind,
            errorStage: 'scraper_returned_failure',
            isRetryable: true,
            errorCode: String(result.errorType ?? ''),
            errorMessage: shortMsg,
            errorFull: errMsg,
            errorFingerprint: this.appLogs.buildErrorFingerprint({
              errorKind,
              errorStage: 'provider_scrape_failed',
              providerId: config.companyId,
              code: String(result.errorType ?? ''),
              message: errMsg,
              selectorPrimary,
            }),
            stackHead: stackHeadFromScraper,
          },
        );

        const terminalErr = new Error(errMsg);
        this.appLogs.logSyncFailure(
          'sync_fail',
          traceBase,
          this.createLifecycle({
            stage: 'sync_fail',
            status: 'failure',
            startedAt: syncStart,
            attempt: attemptNo,
            retryCount,
            timeoutMs: jobTimeoutMs,
            maxRetries: queueMeta?.maxRetries,
            extra: {
              queue: queueMeta
                ? {
                    queueName: queueMeta.queueName,
                    enqueueTs: queueMeta.enqueueTs,
                    dequeueTs: queueMeta.dequeueTs,
                    waitMs: queueMeta.waitMs,
                    runMs: Date.now() - syncT0,
                    maxRetries: queueMeta.maxRetries,
                    jobTimeoutMs: queueMeta.jobTimeoutMs,
                  }
                : undefined,
              dataWindow: {
                from: startDate.toISOString(),
                to: new Date().toISOString(),
              },
            },
          }),
          {
            errorKind,
            errorStage: 'fetch_transactions',
            isRetryable: true,
            errorCode: String(result.errorType ?? ''),
            errorMessage: shortMsg,
            errorFull: errMsg,
            errorFingerprint: this.appLogs.buildErrorFingerprint({
              errorKind,
              errorStage: 'sync_terminal_scrape',
              providerId: config.companyId,
              code: String(result.errorType ?? ''),
              message: errMsg,
              selectorPrimary,
            }),
            stackHead: stackHeadFromScraper,
          },
        );
        markSyncFailureLogged(terminalErr);
        await this.configService.updateSyncStatus(configId, 'error', errMsg);
        throw terminalErr;
      }

      let newTransactionsCount = 0;
      let updatedAccountsCount = 0;
      let accountsFailed = 0;
      let transactionsFetched = 0;
      let transactionsParsed = 0;
      let transactionsPersisted = 0;
      let duplicatesSkipped = 0;

      const rawAccounts = result.accounts ?? [];

      for (const account of rawAccounts) {
        const accountStart = new Date();
        const accountRef = this.appLogs.maskIdentifier(account.accountNumber);
        const accountRefHash = this.appLogs.accountRefHash(
          userId,
          config.companyId,
          String(account.accountNumber ?? ''),
        );
        const accountTrace: SyncTraceContext = {
          ...traceBase,
          accountRef,
          accountRefHash,
        };
        this.appLogs.logSyncLifecycle(
          'INFO',
          'account_start',
          accountTrace,
          this.createLifecycle({
            stage: 'account_start',
            status: 'success',
            startedAt: accountStart,
            endedAt: accountStart,
            attempt: attemptNo,
            retryCount,
          }),
        );
        try {
          this.logger.log(
            `Processing account: ${account.accountNumber}, balance: ${account.balance}, txns: ${account.txns?.length ?? 0}`,
          );

          const dbAccount = await this.findOrCreateAccount(
            userId,
            config.companyId,
            displayName,
            account.accountNumber,
          );

          updatedAccountsCount++;

          const balanceRaw = this.extractScraperBalance(account as Record<string, unknown>);
          await this.updateAccountBalance(dbAccount.id, balanceRaw);
          if (balanceRaw !== null) {
            this.logger.log(`Updated balance for ${account.accountNumber}: ${balanceRaw}`);
          } else {
            await this.prisma.account.update({
              where: { id: dbAccount.id },
              data: { lastSyncAt: new Date() },
            });
          }

          const txns = account.txns ?? [];
          transactionsFetched += txns.length;
          if (txns.length > 0) {
            const flowStepStart = new Date();
            this.appLogs.logSyncLifecycle(
              'INFO',
              'step_start',
              accountTrace,
              this.createLifecycle({
                stage: 'step_start',
                status: 'success',
                startedAt: flowStepStart,
                endedAt: flowStepStart,
                attempt: attemptNo,
                retryCount,
                extra: { step: 'parse_transactions' },
              }),
            );
            const normStart = new Date();
            this.appLogs.logSyncLifecycle(
              'INFO',
              'step_success',
              accountTrace,
              this.createLifecycle({
                stage: 'step_success',
                status: 'success',
                startedAt: normStart,
                endedAt: normStart,
                attempt: attemptNo,
                retryCount,
                extra: { step: 'normalize_transactions' },
              }),
            );
            const { created, updated, skipped } = await this.processTransactions(
              dbAccount.id,
              userId,
              txns,
            );
            transactionsParsed += txns.length;
            transactionsPersisted += created + updated;
            duplicatesSkipped += skipped;
            newTransactionsCount += created + updated;
            this.appLogs.logSyncLifecycle(
              'INFO',
              'step_success',
              accountTrace,
              this.createLifecycle({
                stage: 'step_success',
                status: 'success',
                startedAt: flowStepStart,
                attempt: attemptNo,
                retryCount,
                extra: { step: 'persist_results' },
              }),
            );
            this.logger.log(
              `Processed ${txns.length} txns, ${created} created, ${updated} updated`,
            );
          }
          this.appLogs.logSyncLifecycle(
            'INFO',
            'account_end',
            accountTrace,
            this.createLifecycle({
              stage: 'account_end',
              status: 'success',
              startedAt: accountStart,
              attempt: attemptNo,
              retryCount,
            }),
          );
        } catch (accountError: unknown) {
          accountsFailed++;
          const message =
            accountError instanceof Error ? accountError.message : String(accountError);
          const errorKind = this.appLogs.classifyErrorKindFromUnknown(
            accountError,
            message,
          );
          const prismaCode = this.appLogs.prismaErrorCodeFromUnknown(accountError);
          const errorFingerprint = this.appLogs.buildErrorFingerprint({
            errorKind,
            errorStage: 'persist_transactions',
            providerId: config.companyId,
            code: prismaCode,
            message,
          });
          const stackHead =
            accountError instanceof Error
              ? accountError.stack?.split('\n').slice(0, 15).join('\n')
              : undefined;
          this.appLogs.logSyncFailure(
            'step_fail',
            accountTrace,
            this.createLifecycle({
              stage: 'step_fail',
              status: 'failure',
              startedAt: accountStart,
              attempt: attemptNo,
              retryCount,
              extra: { step: 'persist_results' },
            }),
            {
              errorKind,
              errorStage: 'persist_transactions',
              isRetryable: true,
              errorCode: prismaCode,
              errorMessage: shortenSyncErrorMessage(message),
              errorFull: message,
              errorFingerprint,
              stackHead,
              ...(process.env.NODE_ENV === 'development' &&
              accountError instanceof Error
                ? { fullStack: accountError.stack }
                : {}),
            },
            {
              db: {
                ...this.appLogs.parseDatabaseUrlForLog(process.env.DATABASE_URL),
                prismaErrorCode: prismaCode,
                errorClass:
                  accountError instanceof Error ? accountError.name : 'UnknownError',
                reconnectAttempts: 0,
              },
            },
          );
          this.appLogs.logSyncFailure(
            'account_fail',
            accountTrace,
            this.createLifecycle({
              stage: 'account_fail',
              status: 'failure',
              startedAt: accountStart,
              attempt: attemptNo,
              retryCount,
            }),
            {
              errorKind,
              errorStage: 'account_persist',
              isRetryable: true,
              errorCode: prismaCode,
              errorMessage: shortenSyncErrorMessage(message),
              errorFull: message,
              errorFingerprint: this.appLogs.buildErrorFingerprint({
                errorKind,
                errorStage: 'account_fail',
                providerId: config.companyId,
                code: prismaCode,
                message,
              }),
              stackHead,
            },
          );
        }
      }

      await this.configService.updateSyncStatus(configId, 'success');
      const partialSync = accountsFailed > 0;
      const finalStatus: SyncStatus =
        updatedAccountsCount === 0 && accountsFailed > 0
          ? 'failure'
          : partialSync
            ? 'partial'
            : 'success';

      this.logger.log(
        `Scraper completed: ${newTransactionsCount} new transactions, ${updatedAccountsCount} accounts`,
      );
      this.appLogs.add('INFO', 'sync', `סנכרון הושלם: ${displayName}`, {
        newTransactionsCount,
        updatedAccountsCount,
        companyId: config.companyId,
        durationMs: Date.now() - syncT0,
      });
      this.appLogs.logScraperSuccess(
        displayName,
        updatedAccountsCount,
        newTransactionsCount,
      );
      this.appLogs.logSyncLifecycle(
        partialSync ? 'WARN' : 'INFO',
        'provider_end',
        traceBase,
        this.createLifecycle({
          stage: 'provider_end',
          status: finalStatus,
          startedAt: syncStart,
          attempt: attemptNo,
          retryCount,
          timeoutMs: jobTimeoutMs,
          maxRetries: queueMeta?.maxRetries,
          extra: {
            transactionsFetched,
            transactionsParsed,
            transactionsPersisted,
            duplicatesSkipped,
            accountsTotal: rawAccounts.length,
            accountsSucceeded: updatedAccountsCount,
            accountsFailed,
            partialSync,
            dataWindow: {
              from: startDate.toISOString(),
              to: new Date().toISOString(),
            },
          },
        }),
      );
      this.appLogs.logSyncLifecycle(
        partialSync ? 'WARN' : 'INFO',
        'sync_end',
        traceBase,
        this.createLifecycle({
          stage: 'sync_end',
          status: finalStatus,
          startedAt: syncStart,
          attempt: attemptNo,
          retryCount,
          timeoutMs: jobTimeoutMs,
          maxRetries: queueMeta?.maxRetries,
          extra: {
            transactionsFetched,
            transactionsParsed,
            transactionsPersisted,
            duplicatesSkipped,
            accountsTotal: rawAccounts.length,
            accountsSucceeded: updatedAccountsCount,
            accountsFailed,
            partialSync,
            dataWindow: {
              from: startDate.toISOString(),
              to: new Date().toISOString(),
            },
            queue: queueMeta
              ? {
                  queueName: queueMeta.queueName,
                  enqueueTs: queueMeta.enqueueTs,
                  dequeueTs: queueMeta.dequeueTs,
                  waitMs: queueMeta.waitMs,
                  runMs: Date.now() - syncT0,
                  maxRetries: queueMeta.maxRetries,
                  jobTimeoutMs: queueMeta.jobTimeoutMs,
                }
              : undefined,
          },
        }),
      );

      if (newTransactionsCount > 0) {
        void this.n8nWebhook.sendSyncCompleteAlert(
          userId,
          displayName,
          newTransactionsCount,
        );
      }

      return {
        success: true,
        newTransactionsCount,
        updatedAccountsCount,
        accountsFailed,
        partialSync,
      };
    } catch (error: unknown) {
      if (wasSyncFailureLogged(error)) {
        await this.configService.updateSyncStatus(
          configId,
          'error',
          error instanceof Error ? error.message : String(error),
        );
        void this.n8nWebhook.sendSyncErrorAlert(
          userId,
          displayName,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const stackHead = stack?.split('\n').slice(0, 15).join('\n') ?? undefined;
      const shortMsg = shortenSyncErrorMessage(message);
      const errorKind = this.appLogs.classifyErrorKindFromUnknown(error, message);
      const prismaCode = this.appLogs.prismaErrorCodeFromUnknown(error);
      const errorFingerprint = this.appLogs.buildErrorFingerprint({
        errorKind,
        errorStage: 'sync_uncaught',
        providerId: config.companyId,
        code: prismaCode,
        message,
      });
      this.logger.error(`Scraper error: ${message}`, stack);
      this.appLogs.logScraperIssue(
        displayName,
        'unknown',
        message,
        { stack: stackHead, configId },
      );
      this.appLogs.add(
        'ERROR',
        'sync',
        `שגיאה בסנכרון ${displayName}: ${shortMsg}`,
        {
          configId,
          companyId: config.companyId,
          durationMs: Date.now() - syncT0,
          errorFull: message,
          stackHead,
        },
      );
      this.appLogs.logSyncFailure(
        'provider_fail',
        traceBase,
        this.createLifecycle({
          stage: 'provider_fail',
          status: 'failure',
          startedAt: syncStart,
          attempt: attemptNo,
          retryCount,
          timeoutMs: jobTimeoutMs,
          maxRetries: queueMeta?.maxRetries,
          extra: {
            dataWindow: {
              from: startDate.toISOString(),
              to: new Date().toISOString(),
            },
          },
        }),
        {
          errorKind,
          errorStage: 'provider_uncaught',
          isRetryable: true,
          errorCode: prismaCode,
          errorMessage: shortMsg,
          errorFull: message,
          errorFingerprint: this.appLogs.buildErrorFingerprint({
            errorKind,
            errorStage: 'provider_uncaught',
            providerId: config.companyId,
            code: prismaCode,
            message,
          }),
          stackHead,
          ...(process.env.NODE_ENV === 'development' ? { fullStack: stack } : {}),
        },
      );
      this.appLogs.logSyncFailure(
        'sync_fail',
        traceBase,
        this.createLifecycle({
          stage: 'sync_fail',
          status: 'failure',
          startedAt: syncStart,
          attempt: attemptNo,
          retryCount,
          timeoutMs: jobTimeoutMs,
          maxRetries: queueMeta?.maxRetries,
          extra: {
            queue: queueMeta
              ? {
                  queueName: queueMeta.queueName,
                  enqueueTs: queueMeta.enqueueTs,
                  dequeueTs: queueMeta.dequeueTs,
                  waitMs: queueMeta.waitMs,
                  runMs: Date.now() - syncT0,
                  maxRetries: queueMeta.maxRetries,
                  jobTimeoutMs: queueMeta.jobTimeoutMs,
                }
              : undefined,
            dataWindow: {
              from: startDate.toISOString(),
              to: new Date().toISOString(),
            },
          },
        }),
        {
          errorKind,
          errorStage: 'sync_uncaught',
          isRetryable: true,
          errorCode: prismaCode,
          errorMessage: shortMsg,
          errorFull: message,
          errorFingerprint,
          stackHead,
          ...(process.env.NODE_ENV === 'development' ? { fullStack: stack } : {}),
        },
        {
          db: {
            ...this.appLogs.parseDatabaseUrlForLog(process.env.DATABASE_URL),
            prismaErrorCode: prismaCode,
            errorClass: error instanceof Error ? error.name : 'UnknownError',
            reconnectAttempts: 0,
          },
        },
      );
      markSyncFailureLogged(error);
      await this.configService.updateSyncStatus(configId, 'error', message);
      void this.n8nWebhook.sendSyncErrorAlert(userId, displayName, message);
      throw error;
    }
  }

  private parseKeywordsField(raw: Prisma.JsonValue | null | undefined): string[] {
    if (raw === null || raw === undefined) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    }
    if (typeof raw === 'string') {
      return raw.trim() ? [raw] : [];
    }
    if (typeof raw === 'object') {
      return Object.values(raw as Record<string, unknown>).filter(
        (v): v is string => typeof v === 'string' && v.trim() !== '',
      );
    }
    return [];
  }

  private async autoCategorize(
    userId: string,
    description: string,
  ): Promise<string | null> {
    if (!description || description.trim() === '') {
      return null;
    }

    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      select: {
        id: true,
        keywords: true,
        nameHe: true,
      },
    });

    const descLower = description.toLowerCase();

    for (const category of categories) {
      const keywordsArray = this.parseKeywordsField(category.keywords);

      for (const keyword of keywordsArray) {
        if (descLower.includes(keyword.toLowerCase())) {
          this.logger.debug(
            `Auto-categorized "${description}" to "${category.nameHe}" (keyword: ${keyword})`,
          );
          return category.id;
        }
      }
    }

    const ollamaId = await this.ollamaCategorizer.categorizeTransaction(userId, description);
    if (ollamaId) {
      this.logger.debug(`OLLAMA categorized "${description}" -> ${ollamaId}`);
    }
    return ollamaId;
  }

  private async processTransactions(
    accountId: string,
    userId: string,
    transactions: unknown[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    this.logger.log(`Processing ${transactions.length} transactions for account ${accountId}`);

    const userSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    const salaryStart = userSettings?.salaryStartDay ?? 25;
    const salaryEnd = userSettings?.salaryEndDay ?? 31;
    const autoExcludeCcCharges =
      userSettings?.excludeCreditCardChargesFromBudget !== false;

    const accountRow = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { accountType: true },
    });
    const accountTypeForCc = accountRow?.accountType ?? AccountType.BANK;

    for (const raw of transactions) {
      try {
        const txn = raw as Record<string, unknown>;
        const rawDate = String(txn.date ?? '');
        const sem = this.resolveScraperDateSemantics(rawDate);

        const amount =
          txn.chargedAmount !== undefined && txn.chargedAmount !== null
            ? Number(txn.chargedAmount)
            : txn.amount !== undefined && txn.amount !== null
              ? Number(txn.amount)
              : 0;

        const idRaw = txn.referenceNumber ?? txn.identifier;
        const identifier =
          idRaw === null || idRaw === undefined || idRaw === '' ? '' : String(idRaw);
        const memo = txn.memo !== undefined && txn.memo !== null ? String(txn.memo) : '';
        const descForCategorize = String(txn.description ?? txn.memo ?? '');
        const normalizedDesc = this.normalizeTxnText(
          String(txn.description ?? txn.memo ?? ''),
        );
        const description = normalizedDesc || 'ללא תיאור';

        const statusStr = String(txn.status ?? 'completed').toLowerCase();
        const status: TransactionStatus =
          statusStr === 'pending' ? TransactionStatus.PENDING : TransactionStatus.COMPLETED;

        const scraperHash = this.buildTransactionHash(accountId, txn, sem.ymdIso);

        const existingByHash = await this.prisma.transaction.findUnique({
          where: { scraperHash },
        });

        if (existingByHash) {
          if (
            existingByHash.status === TransactionStatus.PENDING &&
            status === TransactionStatus.COMPLETED
          ) {
            const amtDec = new Prisma.Decimal(Number.isFinite(amount) ? amount : 0);
            const processedDateRaw = txn.processedDate;
            const processedDate =
              processedDateRaw !== undefined && processedDateRaw !== null
                ? new Date(String(processedDateRaw))
                : new Date();

            let effectiveDate = existingByHash.effectiveDate;
            if (existingByHash.categoryId) {
              const category = await this.prisma.category.findUnique({
                where: { id: existingByHash.categoryId },
                select: { isIncome: true },
              });
              effectiveDate = await this.calculateEffectiveDate(
                userId,
                existingByHash.date,
                existingByHash.categoryId,
                salaryStart,
                salaryEnd,
                category,
              );
            }

            const rawDescCc = String(txn.description ?? txn.memo ?? '').trim();
            const ccEx = this.computeBankCreditCardChargeExclusion({
              accountType: accountTypeForCc,
              rawDescriptionForMatch: rawDescCc,
              amount,
              autoExcludeEnabled: autoExcludeCcCharges,
            });
            const txResolvedHash = this.resolveTransactionTypeAndInstallments(txn);
            const fcHash = this.resolveForeignCurrencyFields(txn, amount);
            if (fcHash.isAbroad) {
              this.appLogs.add('DEBUG', 'sync', 'עסקת מחו"ל (השלמת pending לפי hash)', {
                descriptionPreview: description.slice(0, 60),
                originalAmount: fcHash.originalAmount?.toString(),
                originalCurrency: fcHash.originalCurrency,
                exchangeRate: fcHash.exchangeRate?.toString(),
              });
            }

            await this.prisma.transaction.update({
              where: { id: existingByHash.id },
              data: {
                status: TransactionStatus.COMPLETED,
                processedDate,
                amount: amtDec,
                effectiveDate,
                description,
                type: txResolvedHash.type,
                installmentNumber: txResolvedHash.installmentNumber,
                installmentTotal: txResolvedHash.installmentTotal,
                scraperIdentifier: identifier || null,
                bankIdentifier: identifier || null,
                rawData: txn as unknown as Prisma.InputJsonValue,
                originalAmount: fcHash.originalAmount,
                originalCurrency: fcHash.originalCurrency,
                exchangeRate: fcHash.exchangeRate,
                isAbroad: fcHash.isAbroad,
                ...(ccEx.isExcludedFromCashFlow
                  ? { isExcludedFromCashFlow: true, note: ccEx.note }
                  : {}),
              },
            });
            updated++;
            this.logger.log(`Updated pending -> completed (same hash): ${description}`);
          } else {
            skipped++;
            this.appLogs.add('DEBUG', 'sync', 'duplicate_skipped_existing_scraper_hash', {
              accountId,
              descriptionPreview: description.slice(0, 80),
              existingTransactionId: existingByHash.id,
              incomingStatus: status,
              existingStatus: existingByHash.status,
            });
          }
          continue;
        }

        if (status === TransactionStatus.COMPLETED) {
          const pendingId = await this.findMatchingPendingTransaction(accountId, txn);
          if (pendingId) {
            const pendingRow = await this.prisma.transaction.findUnique({
              where: { id: pendingId },
            });
            if (!pendingRow) {
              skipped++;
              continue;
            }

            const amtDec = new Prisma.Decimal(Number.isFinite(amount) ? amount : 0);
            const processedDateRaw = txn.processedDate;
            const processedDate =
              processedDateRaw !== undefined && processedDateRaw !== null
                ? new Date(String(processedDateRaw))
                : new Date();

            let effectiveDate: Date | null = pendingRow.effectiveDate;
            if (pendingRow.categoryId) {
              const category = await this.prisma.category.findUnique({
                where: { id: pendingRow.categoryId },
                select: { isIncome: true },
              });
              effectiveDate = await this.calculateEffectiveDate(
                userId,
                pendingRow.date,
                pendingRow.categoryId,
                salaryStart,
                salaryEnd,
                category,
              );
            }

            const rawDescCcPending = String(txn.description ?? txn.memo ?? '').trim();
            const ccExPending = this.computeBankCreditCardChargeExclusion({
              accountType: accountTypeForCc,
              rawDescriptionForMatch: rawDescCcPending,
              amount,
              autoExcludeEnabled: autoExcludeCcCharges,
            });
            const txResolvedPending = this.resolveTransactionTypeAndInstallments(txn);
            const fcPending = this.resolveForeignCurrencyFields(txn, amount);
            if (fcPending.isAbroad) {
              this.appLogs.add('DEBUG', 'sync', 'עסקת מחו"ל (התאמת pending)', {
                descriptionPreview: description.slice(0, 60),
                originalAmount: fcPending.originalAmount?.toString(),
                originalCurrency: fcPending.originalCurrency,
                exchangeRate: fcPending.exchangeRate?.toString(),
              });
            }

            await this.prisma.transaction.update({
              where: { id: pendingId },
              data: {
                status: TransactionStatus.COMPLETED,
                scraperHash,
                processedDate,
                amount: amtDec,
                description,
                effectiveDate,
                type: txResolvedPending.type,
                installmentNumber: txResolvedPending.installmentNumber,
                installmentTotal: txResolvedPending.installmentTotal,
                scraperIdentifier: identifier || null,
                bankIdentifier: identifier || null,
                pendingMatchHash: this.generatePendingMatchHash(
                  accountId,
                  pendingRow.date,
                  amount,
                  description,
                ),
                rawData: txn as unknown as Prisma.InputJsonValue,
                originalAmount: fcPending.originalAmount,
                originalCurrency: fcPending.originalCurrency,
                exchangeRate: fcPending.exchangeRate,
                isAbroad: fcPending.isAbroad,
                ...(ccExPending.isExcludedFromCashFlow
                  ? { isExcludedFromCashFlow: true, note: ccExPending.note }
                  : {}),
              },
            });
            updated++;
            this.logger.log(`Matched pending -> completed: ${description}`);
            continue;
          }
        }

        const amtDec = new Prisma.Decimal(Number.isFinite(amount) ? amount : 0);
        const duplicateSoft = await this.prisma.transaction.findFirst({
          where: {
            accountId,
            date: { gte: sem.dayStart, lte: sem.dayEnd },
            amount: { gte: amtDec.minus(0.01), lte: amtDec.plus(0.01) },
            description,
            status: TransactionStatus.COMPLETED,
          },
        });

        if (duplicateSoft) {
          this.logger.warn(`Potential duplicate skipped (same day/amount/description): ${description}`);
          skipped++;
          continue;
        }

        const categoryId = await this.autoCategorize(
          userId,
          descForCategorize || memo || '',
        );

        const category = categoryId
          ? await this.prisma.category.findUnique({
              where: { id: categoryId },
              select: { isIncome: true },
            })
          : null;

        const {
          type: transactionType,
          installmentNumber,
          installmentTotal,
        } = this.resolveTransactionTypeAndInstallments(txn);

        const processedDateRaw = txn.processedDate;
        const fc = this.resolveForeignCurrencyFields(txn, amount);
        if (fc.isAbroad) {
          this.appLogs.add('DEBUG', 'sync', 'עסקת מחו"ל זוהתה', {
            descriptionPreview: description.slice(0, 60),
            originalAmount: fc.originalAmount?.toString(),
            originalCurrency: fc.originalCurrency,
            chargedAmountIls: amount,
            exchangeRate: fc.exchangeRate?.toString(),
          });
        }

        const dateForRow = sem.dateForRow;
        const effectiveDate = await this.calculateEffectiveDate(
          userId,
          dateForRow,
          categoryId,
          salaryStart,
          salaryEnd,
          category,
        );

        const pendingMatchHash = this.generatePendingMatchHash(
          accountId,
          dateForRow,
          Number(amtDec),
          description,
        );

        const rawDescCcNew = String(txn.description ?? txn.memo ?? '').trim();
        const ccExNew = this.computeBankCreditCardChargeExclusion({
          accountType: accountTypeForCc,
          rawDescriptionForMatch: rawDescCcNew,
          amount,
          autoExcludeEnabled: autoExcludeCcCharges,
        });

        await this.prisma.transaction.create({
          data: {
            accountId,
            type: transactionType,
            status,
            date: dateForRow,
            effectiveDate,
            processedDate:
              processedDateRaw !== undefined && processedDateRaw !== null
                ? new Date(String(processedDateRaw))
                : null,
            amount: amtDec,
            originalAmount: fc.originalAmount,
            originalCurrency: fc.originalCurrency,
            exchangeRate: fc.exchangeRate,
            isAbroad: fc.isAbroad,
            description,
            memo: memo || null,
            installmentNumber,
            installmentTotal,
            scraperIdentifier: identifier || null,
            bankIdentifier: identifier || null,
            pendingMatchHash,
            scraperHash,
            rawData: txn as unknown as Prisma.InputJsonValue,
            categoryId,
            isExcludedFromCashFlow: ccExNew.isExcludedFromCashFlow,
            ...(ccExNew.note ? { note: ccExNew.note } : {}),
          },
        });

        created++;

        if (ccExNew.isExcludedFromCashFlow) {
          this.logger.log(`Excluded credit card charge from cash flow: ${description}`);
        }

        if (created <= 5) {
          this.logger.log(
            `Created txn: ${description}, amount: ${amount}, categoryId: ${categoryId ?? 'null'}, status: ${status}`,
          );
        }
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          this.logger.debug('Duplicate transaction skipped (unique constraint)');
          skipped++;
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error processing transaction: ${msg}`);
      }
    }

    return { created, updated, skipped };
  }
}
