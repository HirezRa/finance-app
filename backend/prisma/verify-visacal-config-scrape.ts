// One-off verification: run the Visa Cal scraper with the production options
// against the active DB config. Exercises the hirez-v1.0.27 API retry logic
// ("Unexpected end of JSON input" hardening). Usage (inside backend container):
//   npx ts-node prisma/verify-visacal-config-scrape.ts
import './prisma-env-bootstrap';
import { PrismaClient } from '@prisma/client';
import { createDecipheriv } from 'crypto';

const bankScrapers = require('israeli-bank-scrapers') as {
  createScraper: (options: Record<string, unknown>) => {
    scrape: (credentials: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

function decryptCreds(encryptedData: string, ivB64: string, authTagB64: string): string {
  const hex = process.env.ENCRYPTION_MASTER_KEY ?? '';
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY missing/invalid (expect 64 hex chars)');
  }
  const key = Buffer.from(hex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedData, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const cfg = await prisma.scraperConfig.findFirst({
      where: { companyId: 'visaCal', isActive: true, syncEnabled: true },
      orderBy: { lastSyncAt: 'desc' },
      select: {
        id: true,
        userId: true,
        companyId: true,
        encryptedCredentials: true,
        credentialsIv: true,
        credentialsAuthTag: true,
        lastSyncAt: true,
      },
    });
    if (!cfg) {
      throw new Error('No active Visa Cal scraper config found');
    }

    const credentials = JSON.parse(
      decryptCreds(cfg.encryptedCredentials, cfg.credentialsIv, cfg.credentialsAuthTag),
    ) as Record<string, unknown>;

    const daysBack = Number(process.env.SCRAPE_DAYS_BACK || 120);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    console.log('verify-visacal-config-scrape');
    console.log(
      JSON.stringify(
        {
          configId: cfg.id,
          lastSyncAt: cfg.lastSyncAt,
          startDate: startDate.toISOString(),
          defaultTimeout: 60000,
          navigationRetryCount: 2,
        },
        null,
        2,
      ),
    );

    const startedAt = Date.now();
    const scraper = bankScrapers.createScraper({
      companyId: 'visaCal',
      startDate,
      combineInstallments: false,
      showBrowser: false,
      verbose: false,
      defaultTimeout: 60000,
      navigationRetryCount: 2,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-zygote',
        '--disable-namespace-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    const result = (await scraper.scrape(credentials)) as {
      success?: boolean;
      errorType?: string;
      errorMessage?: string;
      accounts?: Array<{ accountNumber: string; txns?: unknown[] }>;
    };
    const durationMs = Date.now() - startedAt;

    console.log('SCRAPE_RESULT');
    console.log(
      JSON.stringify(
        {
          success: result.success ?? false,
          errorType: result.errorType ?? null,
          errorMessage: result.errorMessage ?? null,
          durationMs,
          accounts: (result.accounts || []).map(a => ({
            accountNumber: a.accountNumber,
            txnsCount: a.txns?.length ?? 0,
          })),
        },
        null,
        2,
      ),
    );
    process.exitCode = result.success ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('VERIFY_FAILED', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
