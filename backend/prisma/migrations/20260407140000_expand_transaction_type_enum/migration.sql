-- Expand TransactionType for credit-card / bank line classification
ALTER TYPE "TransactionType" ADD VALUE 'CREDIT';
ALTER TYPE "TransactionType" ADD VALUE 'REFUND';
ALTER TYPE "TransactionType" ADD VALUE 'CASH';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';
ALTER TYPE "TransactionType" ADD VALUE 'FEE';
ALTER TYPE "TransactionType" ADD VALUE 'INTEREST';
