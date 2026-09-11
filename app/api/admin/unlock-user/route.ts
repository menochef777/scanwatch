import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || 'catendi0@gmail.com').trim().toLowerCase();

    // 1. Find user in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `User with email '${email}' not found in Firebase Authentication. Please register the user first on the frontend or Firebase Console.`,
          detail: err.message,
        },
        { status: 404 }
      );
    }

    const uid = userRecord.uid;

    // 2. Mark email as verified automatically
    if (!userRecord.emailVerified) {
      await adminAuth.updateUser(uid, {
        emailVerified: true,
      });
    }

    // 3. Upsert Firestore user document with Pro plan and reset trial flags
    const userDocRef = adminDb.collection('users').doc(uid);
    await userDocRef.set(
      {
        uid,
        email,
        plan: 'pro',
        role: 'admin',
        trialMonitorUsed: false,
        trialOCRUsed: false,
        emailVerified: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: `User '${email}' successfully updated to plan 'pro' and emailVerified: true`,
      user: {
        uid,
        email,
        emailVerified: true,
        plan: 'pro',
        trialMonitorUsed: false,
        trialOCRUsed: false,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/admin/unlock-user:', error);
    return NextResponse.json(
      {
        error: 'Failed to unlock user',
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
