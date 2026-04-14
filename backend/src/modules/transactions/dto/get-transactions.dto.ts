import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsBoolean,
  IsArray,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AccountType } from '@prisma/client';

const TRANSACTION_TYPE_FILTER = [
  'all',
  'NORMAL',
  'INSTALLMENTS',
  'CREDIT',
  'REFUND',
  'CASH',
  'TRANSFER',
  'FEE',
  'INTEREST',
] as const;

export class GetTransactionsDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['all', 'pending', 'completed'])
  status?: 'all' | 'pending' | 'completed';

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    if (t.toLowerCase() === 'all') return 'all';
    return t.toUpperCase();
  })
  @IsIn(TRANSACTION_TYPE_FILTER)
  type?: (typeof TRANSACTION_TYPE_FILTER)[number];

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasInstallments?: boolean;

  /** סינון עסקאות מחו"ל (מטבע מקורי ≠ ILS) */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isAbroad?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  originalCurrency?: string;

  /** Comma-separated: BANK,CREDIT_CARD. Empty string = no account types (empty result). Omit = both. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (trimmed === '') return [];
    const parts = trimmed
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const out: AccountType[] = [];
    for (const p of parts) {
      if (p === 'BANK') out.push(AccountType.BANK);
      else if (p === 'CREDIT_CARD') out.push(AccountType.CREDIT_CARD);
    }
    return [...new Set(out)];
  })
  @IsArray()
  @IsEnum(AccountType, { each: true })
  accountTypes?: AccountType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
