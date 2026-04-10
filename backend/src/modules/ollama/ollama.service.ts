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

const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';

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
    const ollamaModel =
      settings.ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL;

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
          ollamaUrl,
          ollamaModel,
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
      }
    }

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
      category: {
        name: string;
        nameHe: string;
      } | null;
    },
    categories: CategoryRow[],
    ollamaUrl: string,
    ollamaModel: string,
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
- Pet stores, vets = חיות מחמד (pets)`;

    const prompt =
      mode === 'improve'
        ? `You are a financial transaction categorizer for Israeli expenses.

CURRENT TRANSACTION:
- Description: "${transactionDesc}"
- Amount: ${transactionAmount} ILS
- Note: "${transactionNote}"
- Type: ${isExpense ? 'EXPENSE' : 'INCOME'}
- CURRENT CATEGORY: "${currentCategoryHe}"

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

AVAILABLE CATEGORIES (choose ONE):
${categoriesList}

${rulesBlock}

Analyze the transaction description and choose the MOST APPROPRIATE category.

Respond ONLY with valid JSON (no markdown, no explanation outside JSON):
{"category": "category_name_in_english", "confidence": 0.0-1.0, "reasoning": "brief reason in Hebrew"}`;

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
          options: {
            temperature: 0.1,
            num_predict: 150,
          },
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
    let responseText = data.response?.trim() || '';

    this.logger.log(
      `Ollama response for "${transactionDesc.slice(0, 80)}": ${responseText.slice(0, 300)}`,
    );

    responseText = responseText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      const parsed = parseOllamaJsonResponse(responseText);
      const catRaw = parsed.category;
      if (typeof catRaw !== 'string') {
        this.logger.warn('No category in response');
        return null;
      }

      if (catRaw === 'KEEP') {
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
          return {
            transactionId: transaction.id,
            suggestedCategoryId: partialMatch.id,
            suggestedCategoryName: partialMatch.nameHe || partialMatch.name,
            confidence,
            reasoning,
          };
        }
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
        `Failed to classify "${transactionDesc}": ${msg}`,
      );
      return null;
    }
  }

  async getUncategorizedTransactions(
    userId: string,
    limit: number = 50,
  ): Promise<string[]> {
    this.logger.log(
      `=== Getting uncategorized transactions for user ${userId} ===`,
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
      `Uncategorized category: ${uncategorizedCategory?.id || 'NOT FOUND'}`,
    );

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        OR: [
          { categoryId: null },
          ...(uncategorizedCategory
            ? [{ categoryId: uncategorizedCategory.id }]
            : []),
        ],
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
      this.logger.log(
        `  - "${tx.description}" | categoryId: ${tx.categoryId || 'NULL'}`,
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
