import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    apiKeyPrefix: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 8) || 'MISSING',
    hasChangedetectionUrl: !!process.env.CHANGEDETECTION_URL,
    changedetectionUrl: process.env.CHANGEDETECTION_URL || 'MISSING',
    hasChangedetectionToken: !!process.env.CHANGEDETECTION_INTERNAL_TOKEN,
    hasPaddleocrUrl: !!process.env.PADDLEOCR_URL,
    paddleocrUrl: process.env.PADDLEOCR_URL || 'MISSING',
    hasPaddleocrToken: !!process.env.PADDLEOCR_INTERNAL_TOKEN,
    hasAdminEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    hasAdminKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  });
}
