import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async categorizeTransactions(
    userId: string,
    transactionIds: string[],
    mode: 'uncategorized' | 'improve',
  ): Promise<CategorySuggestion[]> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.ollamaEnabled || !settings.ollamaUrl?.trim()) {
      throw new BadRequestException('Ollama is not configured');
    }

    const ollamaUrl = settings.ollamaUrl.replace(/\/+$/, '');
    const ollamaModel = settings.ollamaModel?.trim() || 'llama3';

    if (transactionIds.length === 0) {
      return [];
    }

    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { isSystem: true, userId: null }],
      },
      select: {
        id: true,
        name: true,
        nameHe: true,
        keywords: true,
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

    const txById = new Map(transactions.map((t) => [t.id, t]));
    const results: Omit<
      CategorySuggestion,
      'description' | 'amount' | 'currentCategory'
    >[] = [];

    for (const tx of transactions) {
      try {
        const suggestion = await this.classifyTransaction(
          tx,
          categories,
          ollamaUrl,
          ollamaModel,
          mode,
        );

        if (suggestion) {
          results.push(suggestion);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to classify transaction ${tx.id}: ${msg}`);
      }
    }

    return results.map((r) => {
      const tx = txById.get(r.transactionId);
      return {
        ...r,
        description: tx?.description ?? undefined,
        amount: tx ? Number(tx.amount) : undefined,
        currentCategory: tx?.category?.nameHe || tx?.category?.name,
      };
    });
  }

  private async classifyTransaction(
    transaction: {
      id: string;
      description: string;
      amount: Prisma.Decimal;
      note: string | null;
      notes: string | null;
      category: {
        name: string;
        nameHe: string;
      } | null;
    },
    categories: {
      id: string;
      name: string;
      nameHe: string;
      keywords: Prisma.JsonValue;
    }[],
    ollamaUrl: string,
    ollamaModel: string,
    mode: 'uncategorized' | 'improve',
  ): Promise<Omit<
    CategorySuggestion,
    'description' | 'amount' | 'currentCategory'
  > | null> {
    const categoriesList = categories
      .filter((c) => c.name !== 'uncategorized')
      .map((c) => {
        const kws = parseKeywordsField(c.keywords).join(', ');
        return `- ${c.nameHe} (${c.name}): מילות מפתח: ${kws || '—'}`;
      })
      .join('\n');

    const noteText =
      transaction.note?.trim() ||
      transaction.notes?.trim() ||
      'אין';

    const currentCategory =
      transaction.category?.nameHe ||
      transaction.category?.name ||
      'לא מסווג';

    const prompt =
      mode === 'improve'
        ? `אתה מומחה לסיווג עסקאות פיננסיות.

העסקה הנוכחית:
- תיאור: ${transaction.description}
- סכום: ${transaction.amount} ₪
- הערות: ${noteText}
- קטגוריה נוכחית: ${currentCategory}

הקטגוריות האפשריות:
${categoriesList}

האם הסיווג הנוכחי "${currentCategory}" הוא הטוב ביותר?
אם יש קטגוריה מתאימה יותר, החזר אותה (שדה category = השם באנגלית name מהרשימה).
אם הסיווג הנוכחי טוב, החזר "KEEP" בשדה category.

החזר תשובה בפורמט JSON בלבד:
{"category": "שם_הקטגוריה_באנגלית_או_KEEP", "confidence": 0.0, "reasoning": "הסבר קצר"}`
        : `אתה מומחה לסיווג עסקאות פיננסיות.

העסקה:
- תיאור: ${transaction.description}
- סכום: ${transaction.amount} ₪
- הערות: ${noteText}

הקטגוריות האפשריות:
${categoriesList}

בחר את הקטגוריה המתאימה ביותר לעסקה זו (שדה category = השם באנגלית name מהרשימה).

החזר תשובה בפורמט JSON בלבד:
{"category": "שם_הקטגוריה_באנגלית", "confidence": 0.0, "reasoning": "הסבר קצר"}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 90_000);

    let response: Response;
    try {
      response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    const responseText = data.response ?? '';
    if (!responseText.trim()) {
      return null;
    }

    try {
      const parsed = parseOllamaJsonResponse(responseText);
      const catRaw = parsed.category;
      if (typeof catRaw !== 'string') {
        return null;
      }
      if (catRaw === 'KEEP') {
        return null;
      }

      const norm = (s: string) => s.toLowerCase().trim();
      const catNorm = norm(catRaw);

      let matchedCategory = categories.find(
        (c) => norm(c.name) === catNorm || norm(c.nameHe) === catNorm,
      );
      if (!matchedCategory) {
        matchedCategory = categories.find(
          (c) =>
            catNorm.includes(norm(c.name)) ||
            norm(c.name).includes(catNorm) ||
            catNorm.includes(norm(c.nameHe)) ||
            norm(c.nameHe).includes(catNorm),
        );
      }

      if (!matchedCategory) {
        this.logger.warn(`Category not found: ${catRaw}`);
        return null;
      }

      const confRaw = parsed.confidence;
      let confidence = 0.5;
      if (typeof confRaw === 'number' && !Number.isNaN(confRaw)) {
        confidence = Math.min(1, Math.max(0, confRaw));
      }

      const reasoning =
        typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

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
        `Failed to parse Ollama response: ${responseText.slice(0, 500)} — ${msg}`,
      );
      return null;
    }
  }

  async getUncategorizedTransactions(
    userId: string,
    limit: number = 50,
  ): Promise<string[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (accounts.length === 0) {
      return [];
    }

    const accountIds = accounts.map((a) => a.id);

    const uncategorizedCategory = await this.prisma.category.findFirst({
      where: {
        OR: [
          { userId, name: 'uncategorized' },
          { isSystem: true, name: 'uncategorized', userId: null },
        ],
      },
    });

    const whereConditions: Prisma.TransactionWhereInput[] = [
      { categoryId: null },
    ];

    if (uncategorizedCategory) {
      whereConditions.push({ categoryId: uncategorizedCategory.id });
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        OR: whereConditions,
      },
      take: limit,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        description: true,
        categoryId: true,
      },
    });

    this.logger.log(`Found ${transactions.length} uncategorized transactions`);

    for (const tx of transactions) {
      this.logger.debug(
        `TX: ${tx.description} | categoryId: ${tx.categoryId ?? 'null'}`,
      );
    }

    return transactions.map((t) => t.id);
  }

  async debugUncategorized(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const uncategorizedCategory = await this.prisma.category.findFirst({
      where: {
        OR: [
          { userId, name: 'uncategorized' },
          { isSystem: true, name: 'uncategorized', userId: null },
        ],
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
      where: { name: 'uncategorized', isSystem: true, userId: null },
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
