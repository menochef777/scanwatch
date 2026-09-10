import { NextRequest, NextResponse } from 'next/server';
import { executeRunOcr } from '../../../functions/runOcr';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { uid, fingerprintHash, fileBase64, mimeType } = body;

    if (!uid || typeof uid !== 'string' || !uid.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid uid parameter' },
        { status: 400 }
      );
    }

    if (!fingerprintHash || typeof fingerprintHash !== 'string' || !fingerprintHash.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid fingerprintHash parameter' },
        { status: 400 }
      );
    }

    if (!fileBase64 || typeof fileBase64 !== 'string' || !fileBase64.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid fileBase64 parameter' },
        { status: 400 }
      );
    }

    if (!mimeType || typeof mimeType !== 'string' || !mimeType.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid mimeType parameter' },
        { status: 400 }
      );
    }

    // Extract client IP securely from headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');

    const result = await executeRunOcr({
      uid: uid.trim(),
      fingerprintHash: fingerprintHash.trim(),
      fileBase64: fileBase64.trim(),
      mimeType: mimeType.trim(),
      rawIp,
    });

    return NextResponse.json(
      result.success
        ? {
            success: true,
            text: result.text,
            confidence: result.confidence,
            pages: result.pages,
            processedAt: result.processedAt,
          }
        : { error: result.error, reason: result.reason },
      { status: result.status }
    );
  } catch (error: any) {
    console.error('Error in /api/run-ocr:', error);
    return NextResponse.json(
      { error: 'Internal server error processing document OCR' },
      { status: 500 }
    );
  }
}
