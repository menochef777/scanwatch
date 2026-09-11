import { NextRequest, NextResponse } from 'next/server';
import { recheckWatch } from '../../../../../lib/changedetectionClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/monitors/[uuid]/recheck
 * Requests an immediate recheck on changedetection.io
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;

    if (!uuid || !uuid.trim()) {
      return NextResponse.json({ error: 'Missing uuid parameter' }, { status: 400 });
    }

    const recheckResult = await recheckWatch(uuid.trim());

    return NextResponse.json({
      success: recheckResult,
      message: 'Recheck request sent to changedetection.io.',
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error triggering recheck:', error);
    return NextResponse.json(
      { error: 'Failed to trigger recheck: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
