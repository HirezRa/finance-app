/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.userSettings.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  console.log('=== OLLAMA Settings (latest row) ===');
  if (!settings) {
    console.log('No userSettings rows');
    return;
  }

  console.log('userId:', settings.userId);
  console.log('ollamaEnabled:', settings.ollamaEnabled);
  console.log('ollamaUrl:', settings.ollamaUrl);
  console.log('ollamaModel:', settings.ollamaModel);

  if (settings.ollamaEnabled && settings.ollamaUrl) {
    const base = settings.ollamaUrl.replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${base}/api/tags`, { signal: controller.signal });
      clearTimeout(t);
      if (!response.ok) {
        console.log('\n/api/tags HTTP:', response.status);
        return;
      }
      const data = await response.json();
      console.log('\n=== Available Models ===');
      (data.models || []).forEach((m) => console.log('  -', m.name));
    } catch (e) {
      console.log('\nConnection error:', e.message || e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
