export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { existsSync } from 'fs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import puppeteer, { type PDFOptions } from 'puppeteer-core';
import { authOptions } from '@/lib/auth-options';

interface PdfRequestOptions {
  format?: PDFOptions['format'];
  margin?: PDFOptions['margin'];
  print_background?: boolean;
  printBackground?: boolean;
  landscape?: boolean;
}

function resolveChromiumExecutablePath(): string {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].filter(Boolean) as string[];

  const executablePath = candidates.find(candidate => existsSync(candidate));
  if (!executablePath) {
    throw new Error('Chromium executable not found');
  }

  return executablePath;
}

function normalizePdfOptions(options?: PdfRequestOptions): PDFOptions {
  return {
    format: options?.format ?? 'A4',
    margin: options?.margin ?? {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    printBackground: options?.printBackground ?? options?.print_background ?? true,
    landscape: options?.landscape ?? false
  };
}

function withBaseUrl(html: string): string {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) return html;

  const baseTag = `<base href="${baseUrl.replace(/"/g, '&quot;')}/">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`;
}

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { html, options } = await request.json();

    if (!html || typeof html !== 'string') {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    browser = await puppeteer.launch({
      executablePath: resolveChromiumExecutablePath(),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(withBaseUrl(html), {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.emulateMediaType('screen');

    const pdf = await page.pdf(normalizePdfOptions(options));

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="rapor.pdf"'
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
