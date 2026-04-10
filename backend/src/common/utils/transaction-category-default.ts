import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** Synthetic category when `categoryId` is null (matches system uncategorized UX). */
export const DEFAULT_UNCATEGORIZED_CATEGORY = {
  id: null,
  name: 'uncategorized',
  nameHe: 'לא מסווג',
  icon: '❓',
  color: '#64748b',
  isSystem: true,
} as const;

type TxWithOptionalCategory = {
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    nameHe: string;
    icon: string | null;
    color: string | null;
  } | null;
};

export function withDefaultTransactionCategory<T extends TxWithOptionalCategory>(
  tx: T,
): T & {
  category: {
    id: string | null;
    name: string;
    nameHe: string;
    icon: string;
    color: string;
    isSystem?: boolean;
  };
  isUncategorized: boolean;
} {
  const raw = tx.category;
  return {
    ...tx,
    category: raw
      ? {
          id: raw.id,
          name: raw.name,
          nameHe: raw.nameHe,
          icon: raw.icon ?? '❓',
          color: raw.color ?? '#64748b',
        }
      : { ...DEFAULT_UNCATEGORIZED_CATEGORY },
    isUncategorized:
      tx.categoryId === null || raw?.name === 'uncategorized',
  };
}

/** Prisma filter: null categoryId or explicit uncategorized category for this user / system. */
export async function uncategorizedTransactionFilter(
  prisma: Pick<PrismaService, 'category'>,
  userId: string,
): Promise<Prisma.TransactionWhereInput> {
  const unc = await prisma.category.findFirst({
    where: {
      name: 'uncategorized',
      OR: [{ userId }, { userId: null, isSystem: true }],
    },
    select: { id: true },
  });
  if (unc) {
    return { OR: [{ categoryId: null }, { categoryId: unc.id }] };
  }
  return { categoryId: null };
}
