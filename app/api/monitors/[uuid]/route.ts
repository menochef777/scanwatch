import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';
import { getWatch, deleteWatch } from '../../../../lib/changedetectionClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/monitors/[uuid]?uid=...
 * Returns real watch details, history and status from changedetection.io
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uuid || !uuid.trim()) {
      return NextResponse.json({ error: 'Missing uuid parameter' }, { status: 400 });
    }

    // 1. Fetch real watch details from changedetection.io
    let remoteWatch;
    try {
      remoteWatch = await getWatch(uuid.trim());
    } catch (e: any) {
      console.warn(`Could not get remote watch ${uuid}:`, e.message);
    }

    // 2. Fetch Firestore record
    let localDoc = null;
    if (uid) {
      const docSnap = await adminDb
        .collection('users')
        .doc(uid.trim())
        .collection('monitors')
        .doc(uuid.trim())
        .get();
      if (docSnap.exists) {
        localDoc = docSnap.data();
      }
    }

    const historyKeys = remoteWatch?.history ? Object.keys(remoteWatch.history).sort((a, b) => Number(b) - Number(a)) : [];

    return NextResponse.json({
      success: true,
      uuid,
      url: remoteWatch?.url || localDoc?.url,
      title: remoteWatch?.title || localDoc?.title || localDoc?.domain,
      domain: localDoc?.domain,
      lastChecked: remoteWatch?.last_checked ? new Date(remoteWatch.last_checked * 1000).toISOString() : localDoc?.lastChecked,
      lastChanged: remoteWatch?.last_changed ? new Date(remoteWatch.last_changed * 1000).toISOString() : localDoc?.lastChanged,
      lastError: remoteWatch?.last_error || null,
      status: remoteWatch?.last_error ? 'error' : (remoteWatch?.last_changed && remoteWatch.last_changed > 0 ? 'changed' : 'monitoring'),
      historyTimestamps: historyKeys,
      historyCount: historyKeys.length,
      createdAt: localDoc?.createdAt,
    });
  } catch (error: any) {
    console.error('Error fetching monitor details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitor details: ' + (error.message || '') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/monitors/[uuid]?uid=...
 * Deletes watch from changedetection.io and Firestore
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uuid || !uuid.trim()) {
      return NextResponse.json({ error: 'Missing uuid parameter' }, { status: 400 });
    }

    // 1. Delete from changedetection.io
    try {
      await deleteWatch(uuid.trim());
    } catch (e: any) {
      console.warn(`Changedetection delete warning for ${uuid}:`, e.message);
    }

    // 2. Delete from Firestore
    if (uid && uid.trim()) {
      await adminDb
        .collection('users')
        .doc(uid.trim())
        .collection('monitors')
        .doc(uuid.trim())
        .delete();
    }

    return NextResponse.json({
      success: true,
      message: 'Monitor successfully deleted.',
      uuid,
    });
  } catch (error: any) {
    console.error('Error deleting monitor:', error);
    return NextResponse.json(
      { error: 'Failed to delete monitor: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
