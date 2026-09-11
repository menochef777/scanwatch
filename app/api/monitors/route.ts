import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';
import { executeRunMonitor } from '../../../functions/runMonitor';
import { getWatch } from '../../../lib/changedetectionClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/monitors?uid=...
 * Fetches all monitors for an authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid || !uid.trim()) {
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection('users')
      .doc(uid.trim())
      .collection('monitors')
      .orderBy('createdAt', 'desc')
      .get();

    const monitors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, monitors });
  } catch (error: any) {
    console.error('Error fetching monitors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitors list: ' + (error.message || 'Server error') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitors
 * Creates a new monitor via executeRunMonitor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { uid, fingerprintHash, url } = body;

    if (!uid || !fingerprintHash || !url) {
      return NextResponse.json(
        { error: 'Missing required parameters: uid, fingerprintHash, url' },
        { status: 400 }
      );
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');

    const result = await executeRunMonitor({
      uid: uid.trim(),
      fingerprintHash: fingerprintHash.trim(),
      url: url.trim(),
      rawIp,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, reason: result.reason },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      watchId: result.watchId,
      url: result.url,
      title: result.title,
      domain: result.domain,
      message: result.message,
      checkedAt: result.checkedAt,
    });
  } catch (error: any) {
    console.error('Error in POST /api/monitors:', error);
    return NextResponse.json(
      { error: 'Internal server error creating monitor: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
