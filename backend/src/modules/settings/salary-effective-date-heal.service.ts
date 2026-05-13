import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { getIsraelDayOfMonth } from '../../common/utils/israel-calendar';

/**
 * Clears mistaken `effectiveDate` on income rows whose Israel bank day-of-month is 1–14,
 * matching {@link computeSalaryEffectiveDateForBankDate} (always null for those days).
 * Runs daily so DB converges without manual scripts after legacy data or bad imports.
 */
@Injectable()
export class SalaryEffectiveDateHealService {
  private readonly logger = new Logger(SalaryEffectiveDateHealService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isDisabled(): boolean {
    const v = this.config.get<string>('DISABLE_SALARY_EFFECTIVE_DATE_HEAL', '').trim();
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
  }

  private maxScanPerRun(): number {
    const raw = this.config.get<string>('SALARY_EFFECTIVE_DATE_HEAL_MAX_SCAN', '12000');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 500_000) : 12_000;
  }

  /** 03:30 UTC — off-peak; Docker hosts often use UTC. */
  @Cron('30 3 * * *')
  async healLegacyEarlyMonthIncome(): Promise<void> {
    if (this.isDisabled()) {
      return;
    }

    const maxScan = this.maxScanPerRun();
    let cursor: string | undefined;
    let scanned = 0;
    let cleared = 0;

    const batchSize = 500;

    try {
      for (;;) {
        if (scanned >= maxScan) {
          this.logger.warn(
            `Salary effectiveDate heal: scan cap ${maxScan} reached; will continue next run.`,
          );
          break;
        }

        const rows = await this.prisma.transaction.findMany({
          where: {
            effectiveDate: { not: null },
            category: { isIncome: true },
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: 'asc' },
          take: batchSize,
          select: { id: true, date: true },
        });

        if (rows.length === 0) {
          break;
        }

        cursor = rows[rows.length - 1].id;
        scanned += rows.length;

        const ids = rows
          .filter((r) => getIsraelDayOfMonth(r.date) < 15)
          .map((r) => r.id);

        if (ids.length > 0) {
          const res = await this.prisma.transaction.updateMany({
            where: { id: { in: ids } },
            data: { effectiveDate: null },
          });
          cleared += res.count;
        }

        if (rows.length < batchSize) {
          break;
        }
      }

      if (cleared > 0) {
        this.logger.log(
          `Salary effectiveDate heal: cleared ${cleared} row(s), scanned ${scanned} income row(s) with non-null effectiveDate.`,
        );
      }
    } catch (e) {
      this.logger.error(
        `Salary effectiveDate heal failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
