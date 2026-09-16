export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { type PDFOptions } from 'puppeteer-core';
import { withAuth } from '@/lib/api-utils';

interface PdfRequestOptions {
  format?: PDFOptions['format'];
  margin?: PDFOptions['margin'];
  print_background?: boolean;
  printBackground?: boolean;
  landscape?: boolean;
}

/**
 * Aynı anda kaç PDF üretilebilir.
 *
 * Her istek tam bir Chromium süreci başlatıyor. Uç nokta hız sınırsızken
 * birkaç eşzamanlı istek sunucunun belleğini bitiriyor, sağlık kontrolü
 * düşüyor ve Railway konteyneri yeniden başlatıyordu.
 */
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;

/** Şablon büyüdükçe büyüyor; yine de sınırsız gövde kabul edilmez. */
const MAX_HTML_BYTES = 2 * 1024 * 1024;

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

export async function POST(request: NextRequest) {
  // Kimlik ve hız sınırı tek kapıda. Uç nokta daha önce `withAuth`
  // kullanmadığı için hiç hız sınırı taşımıyordu.
  const auth = await withAuth(request, { rateLimit: 'ai' });
  if (!auth.success) return auth.response;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    return NextResponse.json(
      { error: 'Rapor üretimi meşgul, birkaç saniye sonra tekrar deneyin.' },
      { status: 503, headers: { 'Retry-After': '5' } }
    );
  }
  activeRenders += 1;

  try {
    const { html, options } = await request.json();

    if (!html || typeof html !== 'string') {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
      return NextResponse.json({ error: 'Rapor içeriği çok büyük.' }, { status: 413 });
    }

    browser = await puppeteer.launch({
      executablePath: resolveChromiumExecutablePath(),
      headless: true,
      args: [
        // Konteynerde root olarak çalışıldığı için sandbox kapalı; bu yüzden
        // sayfanın ağ ve dosya erişimi aşağıda tamamen kesiliyor.
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    /**
     * Sayfa hiçbir yere bağlanamaz.
     *
     * Gövdedeki HTML istemciden geliyor. Engel olmadan `<iframe src="http://
     * dahili-servis/">` ya da `<img src="http://169.254.169.254/...">` ile
     * sunucunun ulaşabildiği her adres PDF'e basılıp indirilebiliyordu (SSRF).
     * Rapor şablonu zaten kendi kendine yeten HTML+CSS; dış kaynağa ihtiyacı
     * yok. `data:` ve `blob:` gömülü görseller için açık bırakıldı.
     */
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') {
        void req.continue();
        return;
      }
      void req.abort();
    });

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
    activeRenders -= 1;
    if (browser) {
      await browser.close();
    }
  }
}
