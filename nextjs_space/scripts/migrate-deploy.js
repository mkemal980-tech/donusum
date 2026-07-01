#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

for (const envFile of ['.env', '.env.local']) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function buildPgConnectionString() {
  const { PGHOST, PGPORT = '5432', PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
    return null;
  }

  const user = encodeURIComponent(PGUSER);
  const password = encodeURIComponent(PGPASSWORD);
  const database = encodeURIComponent(PGDATABASE);
  return `postgresql://${user}:${password}@${PGHOST}:${PGPORT}/${database}`;
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: 'DATABASE_URL' };
  }

  if (process.env.DATABASE_PRIVATE_URL) {
    return { url: process.env.DATABASE_PRIVATE_URL, source: 'DATABASE_PRIVATE_URL' };
  }

  if (process.env.POSTGRES_PRISMA_URL) {
    return { url: process.env.POSTGRES_PRISMA_URL, source: 'POSTGRES_PRISMA_URL' };
  }

  if (process.env.POSTGRES_URL) {
    return { url: process.env.POSTGRES_URL, source: 'POSTGRES_URL' };
  }

  const pgConnectionString = buildPgConnectionString();
  if (pgConnectionString) {
    return { url: pgConnectionString, source: 'PG* variables' };
  }

  if (process.env.DATABASE_PUBLIC_URL) {
    return { url: process.env.DATABASE_PUBLIC_URL, source: 'DATABASE_PUBLIC_URL' };
  }

  return null;
}

const database = resolveDatabaseUrl();

if (!database) {
  console.error(`
[migrate] DATABASE_URL is missing, so Prisma cannot run migrations.

Railway fix:
1. Open the web/app service, not the Postgres service.
2. Go to Variables.
3. Add a reference variable named DATABASE_URL.
4. Set its value to \${{Postgres.DATABASE_URL}}.
   If your database service has another name, use \${{<database-service-name>.DATABASE_URL}}.
5. Redeploy the web/app service.
`);
  process.exit(1);
}

if (database.source !== 'DATABASE_URL') {
  console.warn(`[migrate] DATABASE_URL was not set; using ${database.source} for Prisma migrate deploy.`);
}

if (database.source === 'DATABASE_PUBLIC_URL') {
  console.warn('[migrate] DATABASE_PUBLIC_URL uses the public network. On Railway, prefer DATABASE_URL from the Postgres service reference.');
}

const prismaBin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);
const command = fs.existsSync(prismaBin) ? prismaBin : process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = fs.existsSync(prismaBin) ? ['migrate', 'deploy'] : ['prisma', 'migrate', 'deploy'];
const result = spawnSync(command, args, {
  env: { ...process.env, DATABASE_URL: database.url },
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[migrate] Failed to start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
