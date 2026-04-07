import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function parseKeywordsField(raw: Prisma.JsonValue | null | undefined): string[] {
  if (raw === null || raw === undefined) return [];
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

@Injectable()
export class OllamaCategorizerService {
  private readonly logger = new Logger(OllamaCategorizerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async categorizeTransaction(userId: string, description: string): Promise<string | null> {
    const trimmed = description?.trim() ?? '';
    if (!trimmed) return null;

    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.ollamaEnabled || !settings.ollamaUrl?.trim()) {
      return null;
    }

    const baseUrl = settings.ollamaUrl.replace(/\/+$/, '');
    const model = settings.ollamaModel?.trim() || 'mistral';

    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      select: { id: true, nameHe: true, keywords: true },
    });

    const categoryList = categories.map((c) => `- ${c.nameHe}`).join('\n');

    const prompt = `אתה מסווג עסקאות בנקאיות.
סווג את העסקה הבאה לאחת מהקטגוריות הבאות (בדיוק לפי השם בעברית):

${categoryList}

תיאור העסקה: "${trimmed}"

ענה רק עם שם הקטגוריה בעברית משורת הרשימה למעלה, בלי הסברים וסימני פיסוק נוספים.`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`OLLAMA HTTP ${response.status} for categorize`);
        return null;
      }

      const data = (await response.json()) as { response?: string };
      let answer = data.response?.trim() ?? '';
      answer = answer.replace(/^["'`]+|["'`]+$/g, '').split(/\r?\n/)[0]?.trim() ?? '';

      if (!answer) return null;

      this.logger.debug(`OLLAMA suggestion for "${trimmed.slice(0, 40)}…": "${answer}"`);

      const norm = (s: string) => s.toLowerCase().trim();

      let matched = categories.find((c) => norm(c.nameHe) === norm(answer));
      if (!matched) {
        matched = categories.find(
          (c) => norm(answer).includes(norm(c.nameHe)) || norm(c.nameHe).includes(norm(answer)),
        );
      }

      if (!matched) {
        for (const c of categories) {
          const kws = parseKeywordsField(c.keywords);
          for (const kw of kws) {
            if (kw && norm(answer).includes(kw.toLowerCase())) {
              matched = c;
              break;
            }
          }
          if (matched) break;
        }
      }

      return matched?.id ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`OLLAMA categorize error: ${msg}`);
      return null;
    } finally {
      clearTimeout(t);
    }
  }
}
