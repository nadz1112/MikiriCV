import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readdir } from 'node:fs/promises';

// Read-only diagnostics: do not print credentials, CV text or individual user records.
const prisma = new PrismaClient();
try {
  const local = (await readdir(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  const names = new Set(tables.map(table => table.table_name));
  const applied = names.has('_prisma_migrations')
    ? await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`
    : [];
  const completed = applied.filter(item => item.finished_at && !item.rolled_back_at).map(item => item.migration_name);
  const missingLocally = completed.filter(name => !local.includes(name));
  const pending = local.filter(name => !completed.includes(name));
  const incomplete = applied.filter(item => !item.finished_at && !item.rolled_back_at).map(item => item.migration_name);
  const columns = await prisma.$queryRaw`SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('candidates', 'job_descriptions', 'match_results', 'users', 'idempotency_keys') ORDER BY table_name, ordinal_position`;
  const counts = {};
  // Identifiers come only from this fixed allowlist, never from command-line input.
  for (const table of ['candidates', 'job_descriptions', 'match_results', 'users', 'idempotency_keys']) {
    if (names.has(table)) {
      const [row] = await prisma.$queryRawUnsafe(`SELECT count(*)::text AS count FROM public."${table}"`);
      counts[table] = row.count;
    }
  }
  console.log(JSON.stringify({ localMigrations: local, appliedMigrations: completed, missingLocally, pending, incomplete,
    migrationHistoryAligned: missingLocally.length === 0 && pending.length === 0 && incomplete.length === 0,
    counts, columns,
    note: 'Chỉ đọc dữ liệu. Lịch sử khớp không chứng minh schema không bị drift; xem docs/dashboard-fr2-integration.md trước khi áp dụng migration.',
  }, null, 2));
  if (missingLocally.length || pending.length || incomplete.length) process.exitCode = 1;
} catch {
  console.error('Không thể kiểm tra migration. Kiểm tra cấu hình kết nối và quyền đọc PostgreSQL.');
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
