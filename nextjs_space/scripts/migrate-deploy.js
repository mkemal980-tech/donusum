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

function getInvalidReason(url) {
  if (!url || !url.trim()) {
    return 'it is empty';
  }

  const trimmed = url.trim();

  if (trimmed.includes('${{') || trimmed.includes('}}')) {
    return 'it looks like an unresolved Railway reference variable';
  }

  if (!trimmed.startsWith('postgresql://') && !trimmed.startsWith('postgres://')) {
    return 'it must start with postgresql:// or postgres://';
  }

  return null;
}

function resolveDatabaseUrl() {
  const candidates = [
    { url: process.env.DATABASE_URL, source: 'DATABASE_URL' },
    { url: process.env.DATABASE_PRIVATE_URL, source: 'DATABASE_PRIVATE_URL' },
    { url: process.env.POSTGRES_PRISMA_URL, source: 'POSTGRES_PRISMA_URL' },
    { url: process.env.POSTGRES_URL, source: 'POSTGRES_URL' },
    { url: buildPgConnectionString(), source: 'PG* variables' },
    { url: process.env.DATABASE_PUBLIC_URL, source: 'DATABASE_PUBLIC_URL' },
  ].filter((candidate) => candidate.url !== undefined && candidate.url !== null);

  const invalidCandidates = [];

  for (const candidate of candidates) {
    const invalidReason = getInvalidReason(candidate.url);
    if (!invalidReason) {
      return { url: candidate.url.trim(), source: candidate.source, invalidCandidates };
    }
    invalidCandidates.push({ source: candidate.source, reason: invalidReason });
  }

  return { url: null, source: null, invalidCandidates };
}

const database = resolveDatabaseUrl();

if (!database.url) {
  const invalidDetails = database.invalidCandidates.length
    ? `\nDetected invalid DB variables:\n${database.invalidCandidates
        .map((candidate) => `- ${candidate.source}: ${candidate.reason}`)
        .join('\n')}\n`
    : '';

  console.error(`
[migrate] A valid PostgreSQL DATABASE_URL is missing, so Prisma cannot run migrations.
${invalidDetails}
DATABASE_URL must be the resolved PostgreSQL connection string. It must start with:
- postgresql://
- postgres://

Railway fix:
1. Open the web/app service, not the Postgres service.
2. Go to Variables.
3. Delete the current DATABASE_URL if it is manually typed or malformed.
4. Click Add Reference Variable.
5. Select DATABASE_URL from the PostgreSQL service using the dropdown/autocomplete.
6. Redeploy the web/app service.
`);
  process.exit(1);
}

if (database.source !== 'DATABASE_URL') {
  const invalidDatabaseUrl = database.invalidCandidates.find((candidate) => candidate.source === 'DATABASE_URL');
  if (invalidDatabaseUrl) {
    console.warn(
      `[migrate] DATABASE_URL is invalid (${invalidDatabaseUrl.reason}); using ${database.source} for Prisma migrate deploy.`
    );
  } else {
    console.warn(`[migrate] DATABASE_URL was not set; using ${database.source} for Prisma migrate deploy.`);
  }
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
// Railway'de app konteyneri Postgres'ten once hazir olabiliyor; o anda migrate
// "the database system is starting up" ile duser ve deploy komple basarisiz olur.
// Gecici baglanti hatalarinda kisa araliklarla yeniden dene, gercek migration
// hatasinda ilk denemede cik.
const TRANSIENT_PATTERNS = [
  /the database system is starting up/i,
  /the database system is shutting down/i,
  /Can't reach database server/i,
  /Connection refused/i,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /EAI_AGAIN/,
  /ENOTFOUND/,
];

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5000;

function isTransient(output) {
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(output));
}

function sleep(ms) {
  // spawnSync zaten senkron; beklemeyi de senkron tut ki akis basit kalsin.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const result = spawnSync(command, args, {
    env: { ...process.env, DATABASE_URL: database.url },
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    console.error(`[migrate] Failed to start Prisma CLI: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status === 0) {
    process.exit(0);
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (!isTransient(output) || attempt === MAX_ATTEMPTS) {
    if (isTransient(output)) {
      console.error(`[migrate] Database still unavailable after ${MAX_ATTEMPTS} attempts.`);
    }
    process.exit(result.status ?? 1);
  }

  console.warn(
    `[migrate] Database not ready (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${RETRY_DELAY_MS / 1000}s.`
  );
  sleep(RETRY_DELAY_MS);
}
