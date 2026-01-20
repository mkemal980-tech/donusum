export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { html, options } = await request.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // Step 1: Create the PDF generation request
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: html,
        pdf_options: options || { 
          format: 'A4',
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
          print_background: true
        },
        base_url: process.env.NEXTAUTH_URL || '',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({ error: 'Failed to create PDF request' }));
      console.error('PDF create error:', error);
      return NextResponse.json({ success: false, error: error.error }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return NextResponse.json({ success: false, error: 'No request ID returned' }, { status: 500 });
    }

    // Step 2: Poll for status until completion
    const maxAttempts = 60; // 1 minute max (60 * 1 second)
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between polls

      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          request_id: request_id, 
          deployment_token: process.env.ABACUSAI_API_KEY 
        }),
      });

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || 'FAILED';
      const result = statusResult?.result || null;

      if (status === 'SUCCESS') {
        // PDF is ready - result contains base64-encoded PDF
        if (result && result.result) {
          const pdfBuffer = Buffer.from(result.result, 'base64');
          return new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="rapor.pdf"',
            },
          });
        } else {
          return NextResponse.json({ success: false, error: 'PDF generation completed but no result data' }, { status: 500 });
        }
      } else if (status === 'FAILED') {
        const errorMsg = result?.error || 'PDF generation failed';
        console.error('PDF generation failed:', errorMsg);
        return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
      }
      // Status is 'PROCESSING' - continue polling
      attempts++;
    }

    return NextResponse.json({ success: false, error: 'PDF generation timed out' }, { status: 500 });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  }
}
