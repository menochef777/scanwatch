import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const email = searchParams.get('email');

    let targetUid = uid;

    if (!targetUid && email) {
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        targetUid = userRecord.uid;
      } catch {}
    }

    if (!targetUid) {
      return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 });
    }

    const docSnap = await adminDb.collection('users').doc(targetUid).get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      return NextResponse.json({
        exists: true,
        uid: targetUid,
        plan: data.plan || 'free',
        role: data.role || 'user',
        trialMonitorUsed: !!data.trialMonitorUsed,
        trialOCRUsed: !!data.trialOCRUsed,
      });
    }

    return NextResponse.json({
      exists: false,
      uid: targetUid,
      plan: 'free',
      trialMonitorUsed: false,
      trialOCRUsed: false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
