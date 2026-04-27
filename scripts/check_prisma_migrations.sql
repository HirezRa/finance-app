SELECT migration_name, finished_at, rolled_back_at, started_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%202605%';
