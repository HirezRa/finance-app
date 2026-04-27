import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';
import { LLMService } from '../llm/llm.service';
import { buildAbroadPromptLine } from '../../common/utils/foreign-currency';

export interface CategorySuggestion {
  transactionId: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  confidence: number;
  reasoning: string;
  description?: string;
  amount?: number;
  currentCategory?: string;
}

type CategoryRow = {
  id: string;
  name: string;
  nameHe: string;
  keywords: Prisma.JsonValue;
  isIncome: boolean;
};

function parseKeywordsField(raw: Prisma.JsonValue | null | undefined): string[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (v): v is string => typeof v === 'string' && v.trim() !== '',
    );
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

function parseOllamaJsonResponse(responseText: string): Record<string, unknown> {
  const trimmed = responseText.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fence ? fence[1].trim() : trimmed;
  const parsed = JSON.parse(inner) as Record<string, unknown>;
  return parsed;
}

function parseOllamaErrorHe(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('econnrefused')) {
    return 'לא ניתן להתחבר לשרת Ollama';
  }
  if (
    m.includes('etimedout') ||
    m.includes('timeout') ||
    m.includes('abort')
  ) {
    return 'תם הזמן — Ollama לא הגיב';
  }
  if (m.includes('enotfound')) {
    return 'כתובת Ollama לא נמצאה';
  }
  if (m.includes('fetch failed')) {
    return 'שגיאת רשת בפנייה ל-Ollama';
  }
  return message.length > 120 ? `${message.slice(0, 120)}…` : message;
}

const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appLogs: LogsService,
    private readonly llmService: LLMService,
  ) {}

  async categorizeTransactions(
    userId: string,
    transactionIds: string[],
    mode: 'uncategorized' | 'improve',
  ): Promise<CategorySuggestion[]> {
    if (!(await this.llmService.isAiConfiguredForUser(userId))) {
      throw new BadRequestException('מנוע AI אינו מוגדר');
    }

    if (transactionIds.length === 0) {
      return [];
    }

    this.appLogs.add('INFO', 'ollama', 'בקשת סיווג AI', {
      count: transactionIds.length,
      mode,
    });

    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { isSystem: true, userId: null }],
      },
      select: {
        id: true,
        name: true,
        nameHe: true,
        keywords: true,
        isIncome: true,
      },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        account: { userId },
      },
      include: {
        category: true,
      },
    });

    const results: CategorySuggestion[] = [];

    for (const tx of transactions) {
      try {
        this.appLogs.add('DEBUG', 'ollama', 'מעבד עסקה לסיווג', {
          transactionId: tx.id,
          descriptionPreview: (tx.description || '').slice(0, 80),
        });

        const currentCategory = tx.category?.nameHe || tx.category?.name;
        const baseFields = {
          description: tx.description,
          amount: Number(tx.amount),
          currentCategory,
        };

        if (mode === 'uncategorized') {
          const keywordMatch = this.classifyByKeywords(
            tx.description,
            tx.amount,
            categories,
          );
          if (keywordMatch) {
            results.push({
              transactionId: tx.id,
              suggestedCategoryId: keywordMatch.categoryId,
              suggestedCategoryName: keywordMatch.categoryName,
              confidence: 0.95,
              reasoning: 'זוהה לפי מילות מפתח',
              ...baseFields,
            });
            continue;
          }
        }

        const suggestion = await this.classifyTransaction(
          tx,
          categories,
          userId,
          mode,
        );

        if (suggestion) {
          results.push({
            ...suggestion,
            ...baseFields,
          });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to classify transaction ${tx.id}: ${msg}`);
        this.appLogs.add('ERROR', 'ollama', 'שגיאה בסיווג עסקה בודדת', {
          transactionId: tx.id,
          error: msg,
        });
      }
    }

    this.appLogs.add('INFO', 'ollama', 'סיווג אצווה הושלם', {
      requested: transactionIds.length,
      suggestionsReturned: results.length,
      mode,
    });

    return results;
  }

  private classifyByKeywords(
    description: string,
    amount: Prisma.Decimal,
    categories: CategoryRow[],
  ): { categoryId: string; categoryName: string } | null {
    const isExpense = Number(amount) < 0;
    const desc = description.toLowerCase();

    for (const cat of categories) {
      if (cat.name === 'uncategorized') continue;
      if (isExpense && cat.isIncome) continue;
      if (!isExpense && !cat.isIncome) continue;

      const kws = parseKeywordsField(cat.keywords);
      for (const keyword of kws) {
        const kw = keyword.toLowerCase();
        if (kw && desc.includes(kw)) {
          return {
            categoryId: cat.id,
            categoryName: cat.nameHe || cat.name,
          };
        }
      }
    }

    return null;
  }

  private async classifyTransaction(
    transaction: {
      id: string;
      description: string;
      amount: Prisma.Decimal;
      note: string | null;
      notes: string | null;
      isAbroad?: boolean;
      originalCurrency?: string | null;
      originalAmount?: Prisma.Decimal | null;
      exchangeRate?: Prisma.Decimal | null;
      category: {
        name: string;
        nameHe: string;
      } | null;
    },
    categories: CategoryRow[],
    userId: string,
    mode: 'uncategorized' | 'improve',
  ): Promise<Omit<
    CategorySuggestion,
    'description' | 'amount' | 'currentCategory'
  > | null> {
    const isExpense = Number(transaction.amount) < 0;
    const relevantCategories = categories.filter((c) => {
      if (c.name === 'uncategorized') return false;
      if (isExpense && c.isIncome) return false;
      if (!isExpense && !c.isIncome) return false;
      return true;
    });

    if (relevantCategories.length === 0) {
      this.logger.warn('No relevant categories for expense/income type');
      return null;
    }

    const categoriesList = relevantCategories
      .map((c, i) => {
        const kws = parseKeywordsField(c.keywords).slice(0, 5).join(', ');
        return `${i + 1}. ${c.nameHe} (${c.name}) - מילות מפתח: ${kws || '—'}`;
      })
      .join('\n');

    const transactionDesc = transaction.description || '';
    const transactionNote =
      transaction.note?.trim() ||
      transaction.notes?.trim() ||
      '';
    const transactionAmount = Math.abs(Number(transaction.amount));

    const currentCategoryHe =
      transaction.category?.nameHe ||
      transaction.category?.name ||
      'לא מסווג';

    const abroadLine = buildAbroadPromptLine({
      isAbroad: transaction.isAbroad,
      originalCurrency: transaction.originalCurrency,
      originalAmount: transaction.originalAmount,
      exchangeRate: transaction.exchangeRate,
    });

    const rulesBlock = `CATEGORIZATION RULES:
- Netflix, Spotify, Disney+, Apple TV = מנויים (subscriptions)
- Supermarkets (שופרסל, רמי לוי, ויקטורי, מגה, יוחננוף, Carrefour) = סופר ומכולת (groceries)
- Restaurants, cafes, food delivery (וולט, וולטס, Wolt) = מסעדות וקפה (restaurants)
- Gas stations (פז, סונול, דלק, Ten) = תחבורה (transportation)
- Pharmacies (סופר פארם, Be) = בריאות (health)
- Clothing stores (זארה, H&M, קסטרו) = ביגוד והנעלה (clothing)
- Electronics (KSP, באג, iDigital) = אלקטרוניקה (electronics)
- Bank fees, charges = עמלות בנק (fees)
- Transfers (bit, paybox, העברה) = העברות (transfer)
- Salary, wages = משכורת (salary)
- Rent payments = שכר דירה (rent)
- Insurance = ביטוח (insurance)
- Electricity (חברת חשמל) = חשבון חשמל (electricity)
- Water (מי X, תאגיד מים) = חשבון מים (water)
- Municipality (עירייה, ארנונה) = ארנונה (arnona)
- Pet stores, vets = חיות מחמד (pets)
- International / FX / travel / foreign online purchases: prefer travel, shopping, subscriptions, or closest match`;

    const prompt =
      mode === 'improve'
        ? `You are a financial transaction categorizer for Israeli expenses.

CURRENT TRANSACTION:
- Description: "${transactionDesc}"
- Amount: ${transactionAmount} ILS
- Note: "${transactionNote}"
- Type: ${isExpense ? 'EXPENSE' : 'INCOME'}
- CURRENT CATEGORY: "${currentCategoryHe}"
- Context: ${abroadLine}

AVAILABLE CATEGORIES (choose ONE, or use KEEP):
${categoriesList}

If the current category is already the best match, respond with category "KEEP".
Otherwise choose the most appropriate category (English \`name\` from the list above).

${rulesBlock}

Respond ONLY with valid JSON (no markdown, no explanation outside JSON):
{"category": "category_name_in_english_or_KEEP", "confidence": 0.0-1.0, "reasoning": "brief reason in Hebrew"}`
        : `You are a financial transaction categorizer for Israeli expenses.

TRANSACTION TO CATEGORIZE:
- Description: "${transactionDesc}"
- Amount: ${transactionAmount} ILS
- Note: "${transactionNote}"
- Type: ${isExpense ? 'EXPENSE' : 'INCOME'}
- Context: ${abroadLine}

AVAILABLE CATEGORIES (choose ONE):
${categoriesList}

${rulesBlock}

Analyze the transaction description and choose the MOST APPROPRIATE category.

Respond ONLY with valid JSON (no markdown, no explanation outside JSON):
{"category": "category_name_in_english", "confidence": 0.0-1.0, "reasoning": "brief reason in Hebrew"}`;

    const t0 = Date.now();
    this.appLogs.add('INFO', 'ollama', 'שליחת בקשת סיווג ל-LLM', {
      transactionId: transaction.id,
      mode,
      descriptionPreview: transactionDesc.slice(0, 100),
      amount: transactionAmount,
      isExpense,
      promptLength: prompt.length,
      categoriesInPrompt: relevantCategories.length,
    });
    this.appLogs.add('DEBUG', 'ollama', 'תוכן Prompt (קטוע)', {
      transactionId: transaction.id,
      promptPreview:
        prompt.length > 1500 ? `${prompt.slice(0, 1500)}…` : prompt,
    });

    let responseText: string;
    try {
      const llmRes = await this.llmService.completeForUser(userId, {
        messages: [{ role: 'user', content: prompt }],
        responseFormat: 'json',
        maxTokens: 150,
        temperature: 0.1,
      });
      responseText = (llmRes.content ?? '').trim();
    } catch (err: unknown) {
      const durationMs = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      this.appLogs.add('ERROR', 'ollama', 'כשל בקריאת LLM לסיווג', {
        transactionId: transaction.id,
        errorHe: parseOllamaErrorHe(msg),
        rawError: msg,
        durationMs,
      });
      return null;
    }

    this.logger.log(
      `LLM response for "${transactionDesc.slice(0, 80)}": ${responseText.slice(0, 300)}`,
    );

    const durationAfterHttp = Date.now() - t0;
    this.appLogs.add('DEBUG', 'ollama', 'תשובה גולמית מ-LLM (קטועה)', {
      transactionId: transaction.id,
      rawResponsePreview: responseText.slice(0, 600),
      durationMs: durationAfterHttp,
    });

    responseText = responseText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      const parsed = parseOllamaJsonResponse(responseText);
      const catRaw = parsed.category;
      if (typeof catRaw !== 'string') {
        this.logger.warn('No category in response');
        this.appLogs.add('WARN', 'ollama', 'אין שדה category בתשובת המודל', {
          transactionId: transaction.id,
          durationMs: Date.now() - t0,
          responsePreview: responseText.slice(0, 200),
        });
        return null;
      }

      if (catRaw === 'KEEP') {
        this.appLogs.add('INFO', 'ollama', 'המודל החזיר KEEP — ללא שינוי קטגוריה', {
          transactionId: transaction.id,
          durationMs: Date.now() - t0,
        });
        return null;
      }

      const lower = catRaw.toLowerCase();
      let matchedCategory = categories.find(
        (c) =>
          c.name.toLowerCase() === lower || c.nameHe === catRaw,
      );

      if (!matchedCategory) {
        this.logger.warn(`Category not found: ${catRaw}`);
        const partialMatch = categories.find(
          (c) =>
            c.name.toLowerCase().includes(lower) ||
            lower.includes(c.name.toLowerCase()),
        );
        if (partialMatch) {
          this.logger.log(`Partial match found: ${partialMatch.name}`);
          const confRaw = parsed.confidence;
          let confidence = 0.5;
          if (typeof confRaw === 'number' && !Number.isNaN(confRaw)) {
            confidence = Math.min(1, Math.max(0, confRaw)) * 0.8;
          } else {
            confidence = 0.4;
          }
          const reasoning =
            typeof parsed.reasoning === 'string' ? parsed.reasoning : '';
          this.appLogs.add('INFO', 'ollama', 'סיווג הושלם (התאמה חלקית)', {
            transactionId: transaction.id,
            category: partialMatch.nameHe || partialMatch.name,
            confidence,
            durationMs: Date.now() - t0,
            modelCategoryRaw: catRaw,
          });
          return {
            transactionId: transaction.id,
            suggestedCategoryId: partialMatch.id,
            suggestedCategoryName: partialMatch.nameHe || partialMatch.name,
            confidence,
            reasoning,
          };
        }
        this.appLogs.add('WARN', 'ollama', 'לא נמצאה קטגוריה תואמת לתשובת המודל', {
          transactionId: transaction.id,
          modelCategoryRaw: catRaw,
          durationMs: Date.now() - t0,
        });
        return null;
      }

      const confRaw = parsed.confidence;
      let confidence = 0.5;
      if (typeof confRaw === 'number' && !Number.isNaN(confRaw)) {
        confidence = Math.min(1, Math.max(0, confRaw));
      }
      const reasoning =
        typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

      this.appLogs.add('INFO', 'ollama', 'סיווג הושלם', {
        transactionId: transaction.id,
        category: matchedCategory.nameHe || matchedCategory.name,
        confidence,
        durationMs: Date.now() - t0,
      });

      return {
        transactionId: transaction.id,
        suggestedCategoryId: matchedCategory.id,
        suggestedCategoryName: matchedCategory.nameHe || matchedCategory.name,
        confidence,
        reasoning,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Failed to classify "${transactionDesc}": ${msg}`,
      );
      this.appLogs.add('ERROR', 'ollama', 'כשל בפרסור JSON מתשובת Ollama', {
        transactionId: transaction.id,
        error: msg,
        responsePreview: responseText.slice(0, 400),
        durationMs: Date.now() - t0,
      });
      return null;
    }
  }

  async getUncategorizedTransactions(
    userId: string,
    limit: number = 50,
  ): Promise<string[]> {
    this.logger.log(
      `=== Getting ONLY uncategorized transactions for user ${userId} ===`,
    );

    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (accounts.length === 0) {
      this.logger.log('No active accounts found');
      return [];
    }

    const accountIds = accounts.map((a) => a.id);
    this.logger.log(`Found ${accountIds.length} active accounts`);

    const uncategorizedCategory = await this.prisma.category.findFirst({
      where: {
        name: 'uncategorized',
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
    });

    this.logger.log(
      `Uncategorized category ID: ${uncategorizedCategory?.id || 'NOT FOUND'}`,
    );

    const transactionsWithNull = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        categoryId: null,
      },
      select: {
        id: true,
        description: true,
        date: true,
      },
    });

    this.logger.log(
      `Transactions with categoryId=NULL: ${transactionsWithNull.length}`,
    );

    let transactionsWithUncategorized: Array<{
      id: string;
      description: string;
      date: Date;
    }> = [];

    if (uncategorizedCategory) {
      transactionsWithUncategorized =
        await this.prisma.transaction.findMany({
          where: {
            accountId: { in: accountIds },
            categoryId: uncategorizedCategory.id,
          },
          select: {
            id: true,
            description: true,
            date: true,
          },
        });
      this.logger.log(
        `Transactions with uncategorized category id: ${transactionsWithUncategorized.length}`,
      );
    }

    const byId = new Map<
      string,
      { id: string; description: string; date: Date }
    >();
    for (const tx of [
      ...transactionsWithNull,
      ...transactionsWithUncategorized,
    ]) {
      if (!byId.has(tx.id)) {
        byId.set(tx.id, tx);
      }
    }

    const merged = Array.from(byId.values());
    merged.sort((a, b) => b.date.getTime() - a.date.getTime());
    const result = merged.slice(0, limit);

    this.logger.log(`=== TOTAL uncategorized (merged, limited): ${result.length} ===`);
    for (const tx of result) {
      this.logger.log(`  -> "${tx.description}"`);
    }

    return result.map((t) => t.id);
  }

  async countUncategorized(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return {
        withNullCategory: 0,
        withUncategorizedCategory: 0,
        uncategorizedCategoryId: null as string | null,
        total: 0,
      };
    }

    const withNull = await this.prisma.transaction.count({
      where: {
        accountId: { in: accountIds },
        categoryId: null,
      },
    });

    const uncategorizedCategory = await this.prisma.category.findFirst({
      where: {
        name: 'uncategorized',
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
    });

    let withUncategorized = 0;
    if (uncategorizedCategory) {
      withUncategorized = await this.prisma.transaction.count({
        where: {
          accountId: { in: accountIds },
          categoryId: uncategorizedCategory.id,
        },
      });
    }

    return {
      withNullCategory: withNull,
      withUncategorizedCategory: withUncategorized,
      uncategorizedCategoryId: uncategorizedCategory?.id ?? null,
      total: withNull + withUncategorized,
    };
  }

  async debugUncategorized(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const uncategorizedCategory = await this.prisma.category.findFirst({
      where: {
        name: 'uncategorized',
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accounts.map((a) => a.id) },
      },
      include: { category: true },
      take: 20,
      orderBy: { date: 'desc' },
    });

    return {
      uncategorizedCategoryId: uncategorizedCategory?.id ?? null,
      uncategorizedCategoryName: uncategorizedCategory?.name ?? null,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        description: tx.description,
        categoryId: tx.categoryId,
        categoryName: tx.category?.nameHe || tx.category?.name || 'NULL',
      })),
    };
  }

  async getTransactionsForImprovement(
    userId: string,
    limit: number = 50,
  ): Promise<string[]> {
    const uncategorized = await this.prisma.category.findFirst({
      where: {
        name: 'uncategorized',
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
    });

    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });
    if (accounts.length === 0) return [];

    const uncategorizedId = uncategorized?.id;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accounts.map((a) => a.id) },
        categoryId: { not: null },
        ...(uncategorizedId
          ? { NOT: { categoryId: uncategorizedId } }
          : {}),
      },
      take: limit,
      orderBy: { date: 'desc' },
      select: { id: true },
    });

    return transactions.map((t) => t.id);
  }

  async getOllamaConnectionStatus(userId: string): Promise<{
    enabled: boolean;
    url: string | null;
    model: string | null;
    reachable: boolean;
    modelsSample?: string[];
    errorHe?: string;
    modelListed?: boolean;
  }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    const hasUrl = Boolean(settings?.ollamaUrl?.trim());
    const enabled = Boolean(settings?.ollamaEnabled && hasUrl);
    if (!enabled) {
      return {
        enabled: false,
        url: settings?.ollamaUrl ?? null,
        model: settings?.ollamaModel ?? null,
        reachable: false,
        errorHe: 'Ollama לא מופעל או שחסר URL בהגדרות המשתמש',
      };
    }
    const url = settings!.ollamaUrl!.replace(/\/+$/, '');
    const model = settings!.ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL;
    try {
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return {
          enabled: true,
          url,
          model,
          reachable: false,
          errorHe: `שרת החזיר HTTP ${res.status}`,
        };
      }
      const body = (await res.json()) as { models?: { name: string }[] };
      const names = (body.models ?? []).map((m) => m.name);
      const modelBase = model.split(':')[0] ?? model;
      const modelListed = names.some(
        (n) => n === model || n.startsWith(modelBase),
      );
      return {
        enabled: true,
        url,
        model,
        reachable: true,
        modelsSample: names.slice(0, 20),
        modelListed,
        errorHe: modelListed
          ? undefined
          : `המודל "${model}" לא מופיע ברשימת המודלים בשרת`,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        enabled: true,
        url,
        model,
        reachable: false,
        errorHe: parseOllamaErrorHe(msg),
      };
    }
  }

  async testOllamaConnection(userId: string): Promise<{
    ok: boolean;
    messageHe?: string;
    models?: string[];
    testResponsePreview?: string;
  }> {
    this.appLogs.add('INFO', 'ollama', 'בדיקת חיבור ידנית — התחלה', {});
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!settings?.ollamaEnabled || !settings?.ollamaUrl?.trim()) {
      this.appLogs.add('WARN', 'ollama', 'בדיקת חיבור — Ollama לא מוגדר', {});
      return { ok: false, messageHe: 'Ollama לא מופעל או שחסר URL בהגדרות' };
    }
    const ollamaUrl = settings.ollamaUrl.replace(/\/+$/, '');
    const ollamaModel =
      settings.ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL;

    let names: string[] = [];
    try {
      const tagsRes = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!tagsRes.ok) {
        this.appLogs.add('ERROR', 'ollama', 'בדיקת חיבור — /api/tags נכשל', {
          status: tagsRes.status,
        });
        return {
          ok: false,
          messageHe: `לא ניתן לקרוא מודלים (HTTP ${tagsRes.status})`,
        };
      }
      const tagsJson = (await tagsRes.json()) as {
        models?: { name: string }[];
      };
      names = (tagsJson.models ?? []).map((m) => m.name);
      this.appLogs.add('INFO', 'ollama', 'בדיקת חיבור — /api/tags OK', {
        modelsCount: names.length,
        modelsSample: names.slice(0, 12),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLogs.add('ERROR', 'ollama', 'בדיקת חיבור — שגיאת רשת ב-/api/tags', {
        errorHe: parseOllamaErrorHe(msg),
        rawError: msg,
      });
      return { ok: false, messageHe: parseOllamaErrorHe(msg) };
    }

    const modelBase = ollamaModel.split(':')[0] ?? ollamaModel;
    const modelOk = names.some(
      (n) => n === ollamaModel || n.startsWith(modelBase),
    );
    if (!modelOk) {
      this.appLogs.add('WARN', 'ollama', 'בדיקת חיבור — המודל לא נמצא', {
        requestedModel: ollamaModel,
      });
      return {
        ok: false,
        models: names,
        messageHe: `המודל "${ollamaModel}" לא נמצא בשרת`,
      };
    }

    try {
      const genRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: 'Reply with exactly: OK',
          stream: false,
          options: { num_predict: 16, temperature: 0 },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!genRes.ok) {
        this.appLogs.add('ERROR', 'ollama', 'בדיקת חיבור — generate נכשל', {
          status: genRes.status,
        });
        return {
          ok: false,
          models: names,
          messageHe: `קריאת generate נכשלה (HTTP ${genRes.status})`,
        };
      }
      const genJson = (await genRes.json()) as { response?: string };
      const preview = (genJson.response ?? '').trim().slice(0, 80);
      this.appLogs.add('INFO', 'ollama', 'בדיקת חיבור — generate הצליח', {
        testResponsePreview: preview,
        model: ollamaModel,
      });
      return { ok: true, models: names, testResponsePreview: preview };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLogs.add('ERROR', 'ollama', 'בדיקת חיבור — שגיאה ב-generate', {
        errorHe: parseOllamaErrorHe(msg),
        rawError: msg,
      });
      return {
        ok: false,
        models: names,
        messageHe: parseOllamaErrorHe(msg),
      };
    }
  }

  async testOllamaCategorize(
    userId: string,
    description: string,
    amount: number,
    categoryFilter?: string[],
  ): Promise<
    | (Omit<
        CategorySuggestion,
        'description' | 'amount' | 'currentCategory'
      > & {
        description: string;
        amount: number;
      })
    | { error: string }
  > {
    this.appLogs.add('INFO', 'ollama', 'בדיקת קטגוריזציה ידנית', {
      descriptionPreview: description.slice(0, 80),
      amount,
      filterSize: categoryFilter?.length ?? 0,
    });

    if (!(await this.llmService.isAiConfiguredForUser(userId))) {
      return { error: 'מנוע AI לא מוגדר' };
    }

    let categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { isSystem: true, userId: null }],
      },
      select: {
        id: true,
        name: true,
        nameHe: true,
        keywords: true,
        isIncome: true,
      },
    });

    if (categoryFilter?.length) {
      const set = new Set(categoryFilter.map((c) => c.toLowerCase()));
      categories = categories.filter(
        (c) =>
          set.has(c.name.toLowerCase()) ||
          set.has((c.nameHe || '').toLowerCase()),
      );
    }

    if (categories.length === 0) {
      return {
        error: 'אין קטגוריות זמינות (אולי הסינון ריק או לא תואם)',
      };
    }

    const testId = `test-${randomUUID().slice(0, 8)}`;
    const suggestion = await this.classifyTransaction(
      {
        id: testId,
        description,
        amount: new Prisma.Decimal(amount),
        note: null,
        notes: null,
        isAbroad: false,
        originalCurrency: 'ILS',
        originalAmount: null,
        exchangeRate: null,
        category: null,
      },
      categories,
      userId,
      'uncategorized',
    );

    if (!suggestion) {
      return { error: 'לא התקבלה הצעה מהמודל' };
    }
    return {
      ...suggestion,
      description,
      amount,
    };
  }

  async applySuggestions(
    userId: string,
    suggestions: Array<{ transactionId: string; categoryId: string }>,
  ): Promise<number> {
    let updated = 0;

    for (const suggestion of suggestions) {
      const tx = await this.prisma.transaction.findFirst({
        where: {
          id: suggestion.transactionId,
          account: { userId },
        },
      });

      if (!tx) continue;

      await this.prisma.transaction.update({
        where: { id: suggestion.transactionId },
        data: { categoryId: suggestion.categoryId },
      });

      updated++;
    }

    return updated;
  }
}
