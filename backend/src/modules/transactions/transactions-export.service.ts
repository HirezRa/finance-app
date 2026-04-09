import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getUtcWideRangeForBudgetCycle,
  isInBudgetCycle,
} from '../../common/utils/budget-cycle';

function anchorDate(t: { date: Date; effectiveDate: Date | null }): Date {
  return t.effectiveDate ?? t.date;
}

@Injectable()
export class TransactionsExportService {
  constructor(private prisma: PrismaService) {}

  async exportToExcel(
    userId: string,
    month?: number,
    year?: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('עסקאות', { views: [{ rightToLeft: true }] });
      sheet.addRow(['אין חשבונות']);
      const buf = await workbook.xlsx.writeBuffer();
      return { buffer: Buffer.from(buf), filename: 'transactions_empty.xlsx' };
    }

    const useCycle =
      month != null &&
      year != null &&
      !Number.isNaN(month) &&
      !Number.isNaN(year) &&
      month >= 1 &&
      month <= 12;

    let cycleStartDay = 1;
    let rangeStart: Date | undefined;
    let rangeEnd: Date | undefined;
    if (useCycle) {
      const s = await this.prisma.userSettings.findUnique({
        where: { userId },
        select: { budgetCycleStartDay: true },
      });
      cycleStartDay = s?.budgetCycleStartDay ?? 1;
      const r = getUtcWideRangeForBudgetCycle(year!, month!, cycleStartDay);
      rangeStart = r.start;
      rangeEnd = r.end;
    }

    const where: Prisma.TransactionWhereInput = {
      accountId: { in: accountIds },
    };

    if (useCycle && rangeStart && rangeEnd) {
      where.AND = [
        {
          OR: [
            { date: { gte: rangeStart, lte: rangeEnd } },
            { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
      ];
    }

    let transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });

    if (useCycle && month != null && year != null) {
      transactions = transactions.filter((t) =>
        isInBudgetCycle(anchorDate(t), year, month, cycleStartDay),
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Finance App';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('עסקאות', {
      views: [{ rightToLeft: true }],
    });

    sheet.columns = [
      { header: 'תאריך', key: 'date', width: 14 },
      { header: 'תיאור', key: 'description', width: 40 },
      { header: 'סכום', key: 'amount', width: 14 },
      { header: 'קטגוריה', key: 'category', width: 18 },
      { header: 'חשבון', key: 'account', width: 22 },
      { header: 'סוג', key: 'type', width: 14 },
      { header: 'הערה', key: 'note', width: 28 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };

    for (const tx of transactions) {
      const d = anchorDate(tx);
      const row = sheet.addRow({
        date: d.toLocaleDateString('he-IL'),
        description: tx.description ?? '',
        amount: Number(tx.amount),
        category: tx.category?.nameHe || tx.category?.name || 'לא מסווג',
        account: tx.account.nickname || tx.account.institutionName,
        type: this.getTypeLabel(tx.type),
        note: tx.note ?? '',
      });

      const amountCell = row.getCell('amount');
      amountCell.numFmt = '₪#,##0.00';
      if (Number(tx.amount) < 0) {
        amountCell.font = { color: { argb: 'FFEF4444' } };
      } else {
        amountCell.font = { color: { argb: 'FF22C55E' } };
      }
    }

    sheet.addRow({});
    const total = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const summaryRow = sheet.addRow({
      date: 'סה"כ',
      description: '',
      amount: total,
      category: '',
      account: '',
      type: '',
      note: '',
    });
    summaryRow.font = { bold: true };
    summaryRow.getCell('amount').numFmt = '₪#,##0.00';

    const buf = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(buf);
    const filename =
      useCycle && month != null && year != null
        ? `transactions_${year}_${month}.xlsx`
        : 'transactions_all.xlsx';

    return { buffer, filename };
  }

  private getTypeLabel(type: TransactionType): string {
    const labels: Record<string, string> = {
      NORMAL: 'רגיל',
      INSTALLMENTS: 'תשלומים',
      CREDIT: 'אשראי',
      REFUND: 'החזר',
      CASH: 'מזומן',
      TRANSFER: 'העברה',
      FEE: 'עמלה',
      INTEREST: 'ריבית',
    };
    return labels[type] ?? type;
  }
}
