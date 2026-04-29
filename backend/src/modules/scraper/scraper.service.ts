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
} from '../../common/utils/israel-calendar';
import { LogsService } from '../logs/logs.service';
import { shortenSyncErrorMessage } from '../../common/utils/sync-error-message';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

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
    if (msg.includes('parse') || msg.includes('unexpected')) {
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

  private generateTransactionHash(
    accountId: string,
    txn: Record<string, unknown>,
  ): string {
    const normalizedDesc = this.normalizeTxnText(
      String(txn.description ?? txn.memo ?? ''),
    );

    const rawDate = String(txn.date ?? '');
    const parsedDate = new Date(rawDate);
    const dateStr = Number.isNaN(parsedDate.getTime())
      ? rawDate.slice(0, 10)
      : parsedDate.toISOString().split('T')[0];

    const amount =
      txn.chargedAmount !== undefined && txn.chargedAmount !== null
        ? Number(txn.chargedAmount)
        : txn.amount !== undefined && txn.amount !== null
          ? Number(txn.amount)
          : 0;
    const amountStr = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';

    const idRaw = txn.identifier ?? txn.referenceNumber;
    const bankId =
      idRaw === null || idRaw === undefined || idRaw === '' ? '' : String(idRaw);

    const hashInput = `${accountId}|${dateStr}|${amountStr}|${normalizedDesc}|${bankId}`;
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
    const date = new Date(String(txn.date ?? ''));
    const description = String(txn.description || txn.memo || '').trim();
    const matchHash = this.generatePendingMatchHash(accountId, date, amount, description);

    const pendingByHash = await this.prisma.transaction.findFirst({
      where: {
        accountId,
        status: TransactionStatus.PENDING,
        pendingMatchHash: matchHash,
      },
    });
    if (pendingByHash) return pendingByHash.id;

    const dateStart = new Date(date.getTime());
    dateStart.setUTCDate(dateStart.getUTCDate() - 3);
    const dateEnd = new Date(date.getTime());
    dateEnd.setUTCDate(dateEnd.getUTCDate() + 3);

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

  async runScraper(configId: string, userId: string) {
    const config = await this.configService.getDecryptedConfig(configId, userId);

    const supported = this.getSupportedInstitutions().some((i) => i.id === config.companyId);
    if (!supported) {
      this.appLogs.add('ERROR', 'sync', `סנכרון נחסם: מוסד לא נתמך (${config.companyId})`, {
        configId,
        companyId: config.companyId,
      });
      throw new Error(`Unsupported companyId: ${config.companyId}`);
    }

    const institutionMeta = this.getSupportedInstitutions().find((i) => i.id === config.companyId);
    const displayName =
      config.companyDisplayName || institutionMeta?.name || config.companyId;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    this.logger.log(
      `Starting scraper for ${config.companyId} (config: ${configId}), startDate: ${startDate.toISOString()}`,
    );
    const syncT0 = Date.now();
    this.appLogs.add('INFO', 'sync', `סנכרון התחיל: ${displayName}`, {
      companyId: config.companyId,
      configId,
    });
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
      const scraper = createScraper(options);
      const result = await scraper.scrape(
        config.credentials as unknown as ScraperCredentials,
      );

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
        const errMsg =
          result.errorMessage || String(result.errorType || '') || 'Scrape failed';
        const shortMsg = shortenSyncErrorMessage(errMsg);
        const classified = this.classifyScraperError(
          String(result.errorType ?? ''),
          result.errorMessage ?? '',
        );
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
        await this.configService.updateSyncStatus(configId, 'error', errMsg);
        throw new Error(errMsg);
      }

      let newTransactionsCount = 0;
      let updatedAccountsCount = 0;

      const rawAccounts = result.accounts ?? [];

      for (const account of rawAccounts) {
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
        if (txns.length > 0) {
          const { created, updated } = await this.processTransactions(
            dbAccount.id,
            userId,
            txns,
          );
          newTransactionsCount += created + updated;
          this.logger.log(
            `Processed ${txns.length} txns, ${created} created, ${updated} updated`,
          );
        }
      }

      await this.configService.updateSyncStatus(configId, 'success');

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
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const stackHead =
        stack?.split('\n').slice(0, 5).join('\n') ?? undefined;
      const shortMsg = shortenSyncErrorMessage(message);
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
        const parsedDate = new Date(rawDate);
        const dateStr = Number.isNaN(parsedDate.getTime())
          ? rawDate.slice(0, 10)
          : parsedDate.toISOString().split('T')[0];

        const amount =
          txn.chargedAmount !== undefined && txn.chargedAmount !== null
            ? Number(txn.chargedAmount)
            : txn.amount !== undefined && txn.amount !== null
              ? Number(txn.amount)
              : 0;

        const idRaw = txn.identifier ?? txn.referenceNumber;
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

        const scraperHash = this.generateTransactionHash(accountId, txn);

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
        const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
        const duplicateSoft = await this.prisma.transaction.findFirst({
          where: {
            accountId,
            date: { gte: dayStart, lte: dayEnd },
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

        const dateForRow = Number.isNaN(parsedDate.getTime()) ? new Date(rawDate) : parsedDate;
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
