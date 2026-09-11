import { NextRequest, NextResponse } from 'next/server';
import { getWatchSnapshot } from '../../../../../lib/changedetectionClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/monitors/[uuid]/snapshot?timestamp=...
 * Returns real text snapshot from changedetection.io
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp') || undefined;

    if (!uuid || !uuid.trim()) {
      return NextResponse.json({ error: 'Missing uuid parameter' }, { status: 400 });
    }

    const snapshotText = await getWatchSnapshot(uuid.trim(), timestamp);

    return NextResponse.json({
      success: true,
      uuid,
      timestamp: timestamp || 'latest',
      content: snapshotText,
    });
  } catch (error: any) {
    console.error('Error fetching snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshot from changedetection.io: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
