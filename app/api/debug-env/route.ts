import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const adminEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;

  const adminKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return NextResponse.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    firebaseClient: {
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      apiKeyPrefix: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 8) || 'MISSING',
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING',
    },
    firebaseAdmin: {
      hasAdminEmail: !!adminEmail,
      adminEmail: adminEmail || 'MISSING',
      hasAdminKey: !!adminKey,
      adminKeyLength: adminKey ? adminKey.length : 0,
      adminKeyHasPemHeader: adminKey ? adminKey.includes('BEGIN PRIVATE KEY') : false,
      resolvedProjectId: projectId || 'MISSING',
    },
    services: {
      hasChangedetectionUrl: !!process.env.CHANGEDETECTION_URL,
      changedetectionUrl: process.env.CHANGEDETECTION_URL || 'MISSING',
      hasChangedetectionToken: !!process.env.CHANGEDETECTION_INTERNAL_TOKEN,
      hasPaddleocrUrl: !!process.env.PADDLEOCR_URL,
      paddleocrUrl: process.env.PADDLEOCR_URL || 'MISSING',
      hasPaddleocrToken: !!process.env.PADDLEOCR_INTERNAL_TOKEN,
    },
  });
}
