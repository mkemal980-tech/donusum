#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const candidates = [
  'server.js',
  path.join('app', 'server.js'),
  path.join('nextjs_space', 'server.js'),
  path.join('.next', 'standalone', 'server.js'),
  path.join('.next', 'standalone', 'app', 'server.js'),
  path.join('.next', 'standalone', 'nextjs_space', 'server.js'),
];

const serverPath = candidates.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)));

if (!serverPath) {
  console.error('[start] Next standalone server.js not found.');
  console.error(`[start] Checked: ${candidates.join(', ')}`);
  process.exit(1);
}

console.log(`[start] Starting Next standalone server from ${serverPath}`);

const child = spawn(process.execPath, [serverPath], {
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
