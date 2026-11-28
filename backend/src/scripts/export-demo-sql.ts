import 'dotenv/config';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CANDIDATE_PG_DUMP = [
  process.env.PG_DUMP_PATH,
  'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
  'pg_dump',
].filter((p): p is string => Boolean(p));

function resolvePgDump(): string {
  for (const candidate of CANDIDATE_PG_DUMP) {
    if (candidate === 'pg_dump' || fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Không tìm thấy công cụ pg_dump trong hệ thống.');
}

function sanitizePgUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.searchParams.delete('schema');
  return parsed.toString();
}

function main() {
  const rawDatabaseUrl = process.env.DATABASE_URL;
  if (!rawDatabaseUrl) {
    throw new Error('Thiếu biến môi trường DATABASE_URL.');
  }
  const databaseUrl = sanitizePgUrl(rawDatabaseUrl);

  const pgDumpPath = resolvePgDump();
  const outFile = path.resolve(process.cwd(), 'prisma/demo-seed.sql');

  const result = spawnSync(
    pgDumpPath,
    [
      '--dbname',
      databaseUrl,
      '--data-only',
      '--column-inserts',
      '--disable-triggers',
      '--exclude-table=_prisma_migrations',
      '--no-owner',
      '--no-privileges',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pg_dump thất bại (mã ${result.status}): ${result.stderr || 'Không rõ lỗi'}`);
  }

  const header = [
    '-- MikiriCV full realistic demo dataset (PostgreSQL)',
    '-- Generated via backend/src/scripts/export-demo-sql.ts',
    '-- Usage: psql "<DATABASE_URL>" -f backend/prisma/demo-seed.sql',
    'BEGIN;',
    'TRUNCATE TABLE "matching_job_items", "matching_jobs", "match_results", "ai_usage", "token_ledger", "token_reservations", "token_wallets", "billing_audit", "ai_prices", "idempotency_keys", "matching_requests", "candidates", "job_descriptions", "users", "companies", "service_plans" RESTART IDENTITY CASCADE;',
    '',
  ].join('\n');

  const footer = '\nCOMMIT;\n';
  fs.writeFileSync(outFile, `${header}${result.stdout}${footer}`, 'utf8');
  const sizeKb = Math.round(fs.statSync(outFile).size / 1024);
  console.info(`✅ Đã xuất file SQL thành công: ${outFile} (${sizeKb} KB)`);
}

main();
