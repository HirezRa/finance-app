-- Remove stale rolled-back row; keep the successfully applied row for this migration name
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260501120000_add_llm_openrouter_settings'
  AND rolled_back_at IS NOT NULL;
