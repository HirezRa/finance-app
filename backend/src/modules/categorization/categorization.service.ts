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
          id: { in: transactionIds },
          account: { userId },
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

  async fullCategorize(userId: string): Promise<CategorizationSummary> {
    const quickResult = await this.quickCategorize(userId);
    const uncategorizedIds = quickResult.results
      .filter((r) => r.source === 'none')
      .map((r) => r.transactionId);

    if (uncategorizedIds.length === 0) return quickResult;

    const aiResults = await this.aiCategorize(userId, uncategorizedIds);
    for (const aiResult of aiResults) {
      const idx = quickResult.results.findIndex(
        (r) => r.transactionId === aiResult.transactionId,
      );
      if (idx !== -1) {
        quickResult.results[idx] = aiResult;
      }
    }

    quickResult.categorized.mapping = quickResult.results.filter(
      (r) => r.source === 'mapping' && r.suggestedCategoryId,
    ).length;
    quickResult.categorized.historical = quickResult.results.filter(
      (r) => r.source === 'historical' && r.suggestedCategoryId,
    ).length;
    quickResult.categorized.ai = quickResult.results.filter(
      (r) => r.source === 'ai' && r.suggestedCategoryId,
    ).length;
    quickResult.uncategorized = quickResult.results.filter(
      (r) => !r.suggestedCategoryId,
    ).length;

    return quickResult;
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
