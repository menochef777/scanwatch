import { NextRequest, NextResponse } from 'next/server';
import { executeRunMonitor } from '../../../functions/runMonitor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { uid, fingerprintHash, url } = body;

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

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid url parameter' },
        { status: 400 }
      );
    }

    // Extract client IP securely from request headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');

    const result = await executeRunMonitor({
      uid: uid.trim(),
      fingerprintHash: fingerprintHash.trim(),
      url: url.trim(),
      rawIp,
    });

    return NextResponse.json(
      result.success
        ? {
            success: true,
            snapshot: result.snapshot,
            watchId: result.watchId,
            message: result.message,
            url: result.url,
            checkedAt: result.checkedAt,
          }
        : { error: result.error, reason: result.reason },
      { status: result.status }
    );
  } catch (error: any) {
    console.error('Error in /api/run-monitor:', error);
    return NextResponse.json(
      { error: 'Internal server error processing monitor request' },
      { status: 500 }
    );
  }
}
