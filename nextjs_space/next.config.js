const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE || 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  eslint: {
    /**
     * Lint hatası derlemeyi durdurur.
     *
     * `true` iken kalite kapısı atlanıyordu; TypeScript için zaten
     * `ignoreBuildErrors: false` seçilmişti, lint de aynı çizgide olmalı.
     * Yalnızca uyarılar derlemeyi durdurmaz.
     */
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
