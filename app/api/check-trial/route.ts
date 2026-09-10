import { NextRequest, NextResponse } from 'next/server';
import { executeCheckTrial, TrialAction } from '../../../functions/checkTrial';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { uid, fingerprintHash, action = 'monitor' } = body;

    // Validate inputs
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

    if (action !== 'monitor' && action !== 'ocr') {
      return NextResponse.json(
        { error: 'Invalid action: must be "monitor" or "ocr"' },
        { status: 400 }
      );
    }

    // Capture IP safely from server-side headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');

    // Execute atomic 3-layer anti-abuse trial check
    const result = await executeCheckTrial({
      uid: uid.trim(),
      fingerprintHash: fingerprintHash.trim(),
      action: action as TrialAction,
      rawIp,
    });

    if (!result.allowed) {
      return NextResponse.json(
        { allowed: false, reason: result.reason || 'trial_used', error: result.error },
        { status: 200 }
      );
    }

    return NextResponse.json({ allowed: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/check-trial:', error);
    return NextResponse.json(
      { error: 'Internal server error validating trial status' },
      { status: 500 }
    );
  }
}
