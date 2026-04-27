import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';

export interface VendorMatch {
  normalizedName: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
  source: 'mapping' | 'historical';
  matchedOriginal?: string;
}

@Injectable()
export class VendorMappingService {
  private readonly logger = new Logger(VendorMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
  ) {}

  normalizeVendorName(description: string): string {
    if (!description) return '';

    return description
      .toLowerCase()
      .replace(/\d+/g, '')
      .replace(/[^\u0590-\u05FFa-zA-Z\s]/g, ' ')
      .replace(/\b(ltd|inc|corp|llc|בעמ|בע״מ|סניף|branch|store|shop)\b/gi, '')
      .replace(/\b\w{1}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async findInMappings(
    userId: string,
    description: string,
  ): Promise<VendorMatch | null> {
    const normalized = this.normalizeVendorName(description);
    if (!normalized || normalized.length < 2) return null;

    const exactMatch = await this.prisma.vendorMapping.findUnique({
      where: {
        userId_normalizedName: { userId, normalizedName: normalized },
      },
      include: { category: true },
    });

    if (exactMatch) {
      await this.prisma.vendorMapping.update({
        where: { id: exactMatch.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      return {
        normalizedName: exactMatch.normalizedName,
        categoryId: exactMatch.categoryId,
        categoryName:
          exactMatch.category.nameHe || exactMatch.category.name,
        confidence: exactMatch.confidence,
        source: 'mapping',
      };
    }

    if (normalized.length >= 3) {
      const partialMatch = await this.prisma.vendorMapping.findFirst({
        where: {
          userId,
          OR: [
            { normalizedName: { contains: normalized } },
            { originalNames: { has: description } },
          ],
        },
        include: { category: true },
        orderBy: { usageCount: 'desc' },
      });

      if (partialMatch) {
        return {
          normalizedName: partialMatch.normalizedName,
          categoryId: partialMatch.categoryId,
          categoryName:
            partialMatch.category.nameHe || partialMatch.category.name,
          confidence: partialMatch.confidence * 0.8,
          source: 'mapping',
        };
      }
    }

    return null;
  }

  async findInHistory(
    userId: string,
    description: string,
  ): Promise<VendorMatch | null> {
    const normalized = this.normalizeVendorName(description);
    if (!normalized || normalized.length < 2) return null;

    const uncategorized = await this.prisma.category.findFirst({
      where: {
        name: 'uncategorized',
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      select: { id: true },
    });

    const similarTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId, isActive: true },
        categoryId: { not: null },
        ...(uncategorized
          ? { NOT: { categoryId: uncategorized.id } }
          : {}),
      },
      select: {
        description: true,
        categoryId: true,
        category: { select: { id: true, name: true, nameHe: true } },
      },
      orderBy: { date: 'desc' },
      take: 4000,
      distinct: ['description', 'categoryId'],
    });

    for (const tx of similarTransactions) {
      const txNormalized = this.normalizeVendorName(tx.description);
      if (!txNormalized) continue;

      const full =
        txNormalized === normalized ||
        (txNormalized.length > 3 && normalized.includes(txNormalized)) ||
        (normalized.length > 3 && txNormalized.includes(normalized));

      if (full && tx.category) {
        return {
          normalizedName: txNormalized,
          categoryId: tx.category.id,
          categoryName: tx.category.nameHe || tx.category.name,
          confidence: 0.9,
          source: 'historical',
          matchedOriginal: tx.description,
        };
      }
    }

    return null;
  }

  async findMatch(
    userId: string,
    description: string,
  ): Promise<VendorMatch | null> {
    const mappingMatch = await this.findInMappings(userId, description);
    if (mappingMatch) return mappingMatch;
    return this.findInHistory(userId, description);
  }

  async saveMapping(
    userId: string,
    description: string,
    categoryId: string,
    source: 'manual' | 'ai' | 'historical' = 'manual',
    confidence = 1.0,
  ): Promise<void> {
    const normalized = this.normalizeVendorName(description);
    if (!normalized || normalized.length < 2) return;

    try {
      await this.prisma.vendorMapping.upsert({
        where: {
          userId_normalizedName: { userId, normalizedName: normalized },
        },
        create: {
          userId,
          normalizedName: normalized,
          originalNames: [description],
          categoryId,
          source,
          confidence,
        },
        update: {
          categoryId,
          confidence: Math.max(confidence, 0.5),
          originalNames: { push: description },
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      this.logsService.add('DEBUG', 'categorization', 'התאמת ספק נשמרה', {
        normalized,
        categoryId,
        source,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`saveMapping failed: ${msg}`);
      this.logsService.add('ERROR', 'categorization', 'שגיאה בשמירת התאמת ספק', {
        error: msg,
        normalized,
      });
    }
  }

  async getMappingStats(userId: string): Promise<{
    totalMappings: number;
    bySource: Record<string, number>;
    topVendors: Array<{
      name: string;
      usageCount: number;
      categoryName: string;
    }>;
  }> {
    const mappings = await this.prisma.vendorMapping.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { usageCount: 'desc' },
    });

    const bySource: Record<string, number> = {};
    for (const m of mappings) {
      bySource[m.source] = (bySource[m.source] || 0) + 1;
    }

    return {
      totalMappings: mappings.length,
      bySource,
      topVendors: mappings.slice(0, 10).map((m) => ({
        name: m.normalizedName,
        usageCount: m.usageCount,
        categoryName: m.category.nameHe || m.category.name,
      })),
    };
  }
}
