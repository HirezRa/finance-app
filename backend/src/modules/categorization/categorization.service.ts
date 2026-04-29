import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import { LogsService } from '../logs/logs.service';
import { VendorMappingService, VendorMatch } from './vendor-mapping.service';

export interface CategorizationResult {
  transactionId: string;
  description: string;
  amount: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  confidence: number;
  source: 'mapping' | 'historical' | 'ai' | 'none';
  aiReasoning?: string;
  matchedVendor?: string;
}

export interface CategorizationSummary {
  total: number;
  categorized: {
    mapping: number;
    historical: number;
    ai: number;
  };
  uncategorized: number;
  results: CategorizationResult[];
}

function categoryKeywords(k: unknown): string[] {
  if (k == null) return [];
  if (Array.isArray(k)) {
    return k.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);
  private readonly AI_BATCH_SIZE = 10;
  private readonly AI_BATCH_DELAY_MS = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LLMService,
    private readonly logsService: LogsService,
    private readonly vendorMappingService: VendorMappingService,
  ) {}

  private async uncategorizedCategoryId(
    userId: string,
  ): Promise<string | null> {
    const c = await this.prisma.category.findFirst({
      where: {
        name: 'uncategorized',
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      select: { id: true },
    });
    return c?.id ?? null;
  }

  private async activeAccountIds(userId: string): Promise<string[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  /** עסקאות ללא קטגוריה אמיתית (null או קטגוריית uncategorized) */
  private async needsCategoryWhere(
    userId: string,
  ): Promise<Prisma.TransactionWhereInput> {
    const accountIds = await this.activeAccountIds(userId);
    const uncId = await this.uncategorizedCategoryId(userId);
    const or: Prisma.TransactionWhereInput[] = [{ categoryId: null }];
    if (uncId) or.push({ categoryId: uncId });
    return {
      accountId: { in: accountIds },
      OR: or,
    };
  }

  async countUncategorized(userId: string): Promise<number> {
    const accountIds = await this.activeAccountIds(userId);
    if (accountIds.length === 0) return 0;
    const uncId = await this.uncategorizedCategoryId(userId);
    const or: Prisma.TransactionWhereInput[] = [{ categoryId: null }];
    if (uncId) or.push({ categoryId: uncId });
    return this.prisma.transaction.count({
      where: {
        accountId: { in: accountIds },
        OR: or,
      },
    });
  }

  async quickCategorize(
    userId: string,
    transactionIds?: string[],
  ): Promise<CategorizationSummary> {
    this.logsService.add('INFO', 'categorization', 'התחלת סיווג מהיר', {
      userId,
    });

    const baseWhere = await this.needsCategoryWhere(userId);
    const where: Prisma.TransactionWhereInput = transactionIds?.length
      ? {
          AND: [baseWhere, { id: { in: transactionIds } }],
        }
      : baseWhere;

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        id: true,
        description: true,
        amount: true,
      },
    });

    const results: CategorizationResult[] = [];
    let mappingCount = 0;
    let historicalCount = 0;

    for (const tx of transactions) {
      const match: VendorMatch | null =
        await this.vendorMappingService.findMatch(userId, tx.description);

      if (match) {
        results.push({
          transactionId: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          suggestedCategoryId: match.categoryId,
          suggestedCategoryName: match.categoryName,
          confidence: match.confidence,
          source: match.source,
          matchedVendor: match.matchedOriginal || match.normalizedName,
        });
        if (match.source === 'mapping') mappingCount++;
        else historicalCount++;
      } else {
        results.push({
          transactionId: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          suggestedCategoryId: null,
          suggestedCategoryName: null,
          confidence: 0,
          source: 'none',
        });
      }
    }

    this.logsService.add('INFO', 'categorization', 'סיווג מהיר הושלם', {
      total: transactions.length,
      mapping: mappingCount,
      historical: historicalCount,
      uncategorized: transactions.length - mappingCount - historicalCount,
    });

    return {
      total: transactions.length,
      categorized: {
        mapping: mappingCount,
        historical: historicalCount,
        ai: 0,
      },
      uncategorized: transactions.length - mappingCount - historicalCount,
      results,
    };
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private recomputeSummary(
    results: CategorizationResult[],
  ): Omit<CategorizationSummary, 'results'> & { results: CategorizationResult[] } {
    const mapping = results.filter(
      (r) => r.source === 'mapping' && r.suggestedCategoryId,
    ).length;
    const historical = results.filter(
      (r) => r.source === 'historical' && r.suggestedCategoryId,
    ).length;
    const ai = results.filter(
      (r) => r.source === 'ai' && r.suggestedCategoryId,
    ).length;
    const uncategorized = results.filter((r) => !r.suggestedCategoryId).length;
    return {
      total: results.length,
      categorized: { mapping, historical, ai },
      uncategorized,
      results,
    };
  }

  async aiCategorize(
    userId: string,
    transactionIds: string[],
  ): Promise<CategorizationResult[]> {
    this.logsService.add('INFO', 'categorization', 'התחלת סיווג AI', {
      userId,
      count: transactionIds.length,
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        account: { userId },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        originalCurrency: true,
        isAbroad: true,
      },
    });

    const categories = await this.prisma.category.findMany({
      where: {
        userId,
        NOT: { name: 'uncategorized' },
      },
      select: { id: true, name: true, nameHe: true, keywords: true },
    });

    const results: CategorizationResult[] = [];

    for (const tx of transactions) {
      try {
        const prompt = this.buildCategorizationPrompt(tx, categories);
        const response = await this.llmService.completeForUser(userId, {
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 200,
          temperature: 0.3,
          responseFormat: 'json',
        });

        const parsed = this.parseAIResponse(response.content, categories);

        results.push({
          transactionId: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          suggestedCategoryId: parsed.categoryId,
          suggestedCategoryName: parsed.categoryName,
          confidence: parsed.confidence,
          source: 'ai',
          aiReasoning: parsed.reasoning,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`aiCategorize tx ${tx.id}: ${msg}`);
        this.logsService.add('ERROR', 'categorization', 'שגיאת AI בסיווג', {
          transactionId: tx.id,
          error: msg,
        });
        results.push({
          transactionId: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          suggestedCategoryId: null,
          suggestedCategoryName: null,
          confidence: 0,
          source: 'none',
        });
      }
    }

    return results;
  }

  private buildBatchCategorizationPrompt(
    transactions: Array<{
      id: string;
      description: string;
      amount: { toString(): string };
      originalCurrency?: string | null;
      isAbroad?: boolean;
    }>,
    categories: Array<{
      id: string;
      name: string;
      nameHe: string;
      keywords?: unknown;
    }>,
  ): string {
    const categoryLines = categories
      .map((c, i) => {
        const label = c.nameHe || c.name;
        const kw = categoryKeywords(c.keywords);
        const kwStr = kw.length ? ` (${kw.slice(0, 3).join(', ')})` : '';
        return `${i + 1}. ${label}${kwStr} — name: ${c.name}`;
      })
      .join('\n');

    const txLines = transactions
      .map((tx, i) => {
        const isExpense = Number(tx.amount) < 0;
        const loc = tx.isAbroad ? 'מחו"ל' : 'בארץ';
        return `${i + 1}. transactionId: "${tx.id}" | תיאור: "${tx.description}" | סכום: ₪${Math.abs(Number(tx.amount)).toFixed(2)} | ${isExpense ? 'הוצאה' : 'הכנסה'} | ${loc}`;
      })
      .join('\n');

    return `אתה מסווג עסקאות פיננסיות ישראליות. ענה ב-JSON בלבד — מערך אובייקטים בלבד, ללא markdown.

קטגוריות (categoryNumber = המספר בשורה, בין 1 ל-${categories.length}):
${categoryLines}

עסקאות לסיווג:
${txLines}

החזר מערך JSON בלבד, בפורמט:
[
  {"transactionId":"<uuid>","categoryNumber":<מספר 1-${categories.length} או null>,"confidence":<0-1>,"reasoning":"<קצר בעברית>"}
]

חובה לכלול ערך עבור כל transactionId מהרשימה. אם לא ניתן לסווג — categoryNumber: null ו-confidence: 0.`;
  }

  private parseBatchAIResponse(
    content: string,
    transactionIds: string[],
    categories: Array<{ id: string; name: string; nameHe: string }>,
    transactions: Array<{
      id: string;
      description: string;
      amount: { toString(): string };
      originalCurrency?: string | null;
      isAbroad?: boolean;
    }>,
  ): CategorizationResult[] {
    const idSet = new Set(transactionIds);
    const byId = new Map(transactions.map((t) => [t.id, t]));
    const out: CategorizationResult[] = [];

    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (!match) {
        for (const tx of transactions) {
          out.push(this.fallbackNoneResult(tx));
        }
        return out;
      }
      const arr = JSON.parse(match[0]) as Array<{
        transactionId?: string;
        categoryNumber?: number | null;
        confidence?: number;
        reasoning?: string;
      }>;
      const mapFromAi = new Map<string, (typeof arr)[0]>();
      for (const row of arr) {
        if (row.transactionId && idSet.has(row.transactionId)) {
          mapFromAi.set(row.transactionId, row);
        }
      }
      for (const tx of transactions) {
        const row = mapFromAi.get(tx.id);
        if (!row) {
          out.push(this.fallbackNoneResult(tx));
          continue;
        }
        const num = row.categoryNumber;
        if (
          num != null &&
          num >= 1 &&
          num <= categories.length
        ) {
          const cat = categories[num - 1];
          out.push({
            transactionId: tx.id,
            description: tx.description,
            amount: Number(tx.amount),
            suggestedCategoryId: cat.id,
            suggestedCategoryName: cat.nameHe || cat.name,
            confidence: Math.min(Math.max(row.confidence ?? 0.6, 0), 1),
            source: 'ai',
            aiReasoning: row.reasoning || '',
          });
        } else {
          out.push(this.fallbackNoneResult(tx));
        }
      }
      return out;
    } catch {
      for (const tx of transactions) {
        out.push(this.fallbackNoneResult(tx));
      }
      return out;
    }
  }

  private fallbackNoneResult(tx: {
    id: string;
    description: string;
    amount: { toString(): string };
  }): CategorizationResult {
    return {
      transactionId: tx.id,
      description: tx.description,
      amount: Number(tx.amount),
      suggestedCategoryId: null,
      suggestedCategoryName: null,
      confidence: 0,
      source: 'none',
    };
  }

  private async categorizeBatchWithAi(
    userId: string,
    transactionIds: string[],
  ): Promise<CategorizationResult[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        account: { userId },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        originalCurrency: true,
        isAbroad: true,
      },
    });

    if (transactions.length === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { isSystem: true, userId: null }],
        NOT: { name: 'uncategorized' },
      },
      select: { id: true, name: true, nameHe: true, keywords: true },
    });

    if (categories.length === 0) {
      return transactions.map((tx) => this.fallbackNoneResult(tx));
    }

    const prompt = this.buildBatchCategorizationPrompt(transactions, categories);
    const response = await this.llmService.completeForUser(userId, {
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      temperature: 0.25,
      responseFormat: 'json',
    });

    return this.parseBatchAIResponse(
      response.content ?? '',
      transactionIds,
      categories,
      transactions,
    );
  }

  async categorizeWithAiBatched(
    userId: string,
    transactionIds: string[],
  ): Promise<{
    results: CategorizationResult[];
    batches: number;
    errors: string[];
  }> {
    const results: CategorizationResult[] = [];
    const errors: string[] = [];

    const configured = await this.llmService.isAiConfiguredForUser(userId);
    if (!configured) {
      this.logsService.add(
        'WARN',
        'categorization',
        'סיווג AI במנות — מנוע AI לא מוגדר למשתמש',
        { userId, count: transactionIds.length },
      );
      return { results: [], batches: 0, errors: ['AI not configured'] };
    }

    const batches = this.chunkArray(transactionIds, this.AI_BATCH_SIZE);
    this.logsService.add(
      'INFO',
      'categorization',
      `סיווג AI במנות: ${transactionIds.length} עסקאות, ${batches.length} מנות`,
      { batchSize: this.AI_BATCH_SIZE },
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        this.logsService.add(
          'DEBUG',
          'categorization',
          `מנה ${i + 1}/${batches.length}: ${batch.length} עסקאות`,
        );
        const batchRes = await this.categorizeBatchWithAi(userId, batch);
        results.push(...batchRes);
        if (i < batches.length - 1) {
          await this.delay(this.AI_BATCH_DELAY_MS);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`categorizeWithAiBatched batch ${i + 1}: ${msg}`);
        this.logsService.add(
          'ERROR',
          'categorization',
          `שגיאה במנה ${i + 1}/${batches.length}`,
          { error: msg },
        );
        errors.push(`Batch ${i + 1}: ${msg}`);
        for (const id of batch) {
          const tx = await this.prisma.transaction.findFirst({
            where: { id, account: { userId } },
            select: { id: true, description: true, amount: true },
          });
          if (tx) {
            results.push(this.fallbackNoneResult(tx));
          }
        }
      }
    }

    const categorized = results.filter(
      (r) => r.source === 'ai' && r.suggestedCategoryId,
    ).length;
    this.logsService.add(
      'INFO',
      'categorization',
      `סיווג AI במנות הושלם: ${categorized}/${transactionIds.length} סווגו`,
    );

    return { results, batches: batches.length, errors };
  }

  async categorizeSmart(
    userId: string,
    transactionIds?: string[],
  ): Promise<
    CategorizationSummary & {
      aiUsed: boolean;
      aiBatches: number;
      aiErrors?: string[];
    }
  > {
    this.logsService.add('INFO', 'categorization', 'התחלת סיווג חכם (מהיר + AI במנות)', {
      userId,
      filterCount: transactionIds?.length,
    });

    const quickResult = await this.quickCategorize(userId, transactionIds);
    const uncategorizedIds = quickResult.results
      .filter((r) => r.source === 'none')
      .map((r) => r.transactionId);

    if (uncategorizedIds.length === 0) {
      return {
        ...quickResult,
        aiUsed: false,
        aiBatches: 0,
      };
    }

    const aiOutcome = await this.categorizeWithAiBatched(userId, uncategorizedIds);
    if (
      aiOutcome.batches === 0 &&
      aiOutcome.errors.some((e) => e.includes('AI not configured'))
    ) {
      return {
        ...quickResult,
        aiUsed: false,
        aiBatches: 0,
        ...(aiOutcome.errors.length ? { aiErrors: aiOutcome.errors } : {}),
      };
    }

    const aiById = new Map(
      aiOutcome.results.map((r) => [r.transactionId, r]),
    );
    const mergedResults = quickResult.results.map(
      (r) => aiById.get(r.transactionId) ?? r,
    );
    const summary = this.recomputeSummary(mergedResults);

    this.logsService.add('INFO', 'categorization', 'סיווג חכם הושלם', {
      aiBatches: aiOutcome.batches,
      aiErrorCount: aiOutcome.errors.length,
      uncategorizedAfter: summary.uncategorized,
    });

    return {
      ...summary,
      aiUsed: true,
      aiBatches: aiOutcome.batches,
      ...(aiOutcome.errors.length > 0
        ? { aiErrors: aiOutcome.errors }
        : {}),
    };
  }

  /** תאימות לאחור — מחזיר תוצאה ללא שדות aiUsed/aiBatches */
  async fullCategorize(userId: string): Promise<CategorizationSummary> {
    const s = await this.categorizeSmart(userId);
    return {
      total: s.total,
      categorized: s.categorized,
      uncategorized: s.uncategorized,
      results: s.results,
    };
  }

  async applyCategorizationResults(
    userId: string,
    results: Array<{
      transactionId: string;
      categoryId: string;
      source: string;
    }>,
  ): Promise<{ applied: number; failed: number }> {
    let applied = 0;
    let failed = 0;

    for (const result of results) {
      try {
        const exists = await this.prisma.transaction.findFirst({
          where: { id: result.transactionId, account: { userId } },
          select: { id: true, description: true },
        });
        if (!exists) {
          failed++;
          continue;
        }

        await this.prisma.transaction.update({
          where: { id: result.transactionId },
          data: { categoryId: result.categoryId },
        });

        const mapSource = (
          s: string,
        ): 'manual' | 'ai' | 'historical' => {
          if (s === 'ai') return 'ai';
          if (s === 'historical') return 'historical';
          return 'manual';
        };

        const src = mapSource(result.source);
        const conf = src === 'ai' ? 0.8 : 1.0;

        await this.vendorMappingService.saveMapping(
          userId,
          exists.description,
          result.categoryId,
          src,
          conf,
        );

        applied++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logsService.add('ERROR', 'categorization', 'שגיאה בהחלת סיווג', {
          transactionId: result.transactionId,
          error: msg,
        });
        failed++;
      }
    }

    this.logsService.add('INFO', 'categorization', 'סיווגים הוחלו', {
      applied,
      failed,
    });
    return { applied, failed };
  }

  private buildCategorizationPrompt(
    tx: {
      description: string;
      amount: { toString(): string };
      originalCurrency?: string | null;
      isAbroad?: boolean;
    },
    categories: Array<{
      id: string;
      name: string;
      nameHe: string;
      keywords?: unknown;
    }>,
  ): string {
    const isExpense = Number(tx.amount) < 0;
    const locationInfo = tx.isAbroad ? 'עסקה מחו"ל' : 'עסקה בארץ';

    const categoryList = categories
      .map((c, i) => {
        const label = c.nameHe || c.name;
        const kw = categoryKeywords(c.keywords);
        const kwStr = kw.length ? ` (${kw.slice(0, 3).join(', ')})` : '';
        return `${i + 1}. ${label}${kwStr}`;
      })
      .join('\n');

    return `אתה מסווג עסקאות פיננסיות. ענה בפורמט JSON בלבד.

עסקה:
- תיאור: "${tx.description}"
- סכום: ₪${Math.abs(Number(tx.amount)).toFixed(2)} (${isExpense ? 'הוצאה' : 'הכנסה'})
- מיקום: ${locationInfo}

קטגוריות זמינות:
${categoryList}

ענה בפורמט JSON:
{
  "categoryNumber": <מספר הקטגוריה 1-${categories.length}>,
  "confidence": <0.0-1.0>,
  "reasoning": "<הסבר קצר בעברית>"
}

אם לא ניתן לזהות, החזר:
{
  "categoryNumber": null,
  "confidence": 0,
  "reasoning": "לא ניתן לזהות"
}`;
  }

  private parseAIResponse(
    content: string,
    categories: Array<{ id: string; name: string; nameHe: string }>,
  ): {
    categoryId: string | null;
    categoryName: string | null;
    confidence: number;
    reasoning: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          categoryId: null,
          categoryName: null,
          confidence: 0,
          reasoning: 'תשובה לא תקינה',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        categoryNumber?: number | null;
        confidence?: number;
        reasoning?: string;
      };
      const categoryNum = parsed.categoryNumber;

      if (
        categoryNum != null &&
        categoryNum >= 1 &&
        categoryNum <= categories.length
      ) {
        const category = categories[categoryNum - 1];
        return {
          categoryId: category.id,
          categoryName: category.nameHe || category.name,
          confidence: Math.min(
            Math.max(parsed.confidence ?? 0.5, 0),
            1,
          ),
          reasoning: parsed.reasoning || '',
        };
      }

      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        reasoning: parsed.reasoning || 'לא זוהה',
      };
    } catch {
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        reasoning: 'שגיאה בפענוח',
      };
    }
  }
}
