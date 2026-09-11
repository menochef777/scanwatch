import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '../../../../lib/firebaseAdmin';
import { sendEmailAlert } from '../../../../lib/emailAlertService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/changedetection
 * Webhook receiver called by changedetection.io (via Apprise or custom JSON)
 * when a change is detected on a monitored URL.
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    } else {
      const text = await request.text().catch(() => '');
      try {
        body = JSON.parse(text);
      } catch {
        // Fallback for form-urlencoded or plain text
        body = { rawText: text };
      }
    }

    console.log('[Changedetection Webhook] Received payload:', JSON.stringify(body));

    // Extract fields across possible formats (Apprise or changedetection native)
    const watchUrl =
      body.watch_url ||
      body.url ||
      body.target_url ||
      body.page_url ||
      '';

    const watchTitle =
      body.watch_title ||
      body.title ||
      body.name ||
      watchUrl;

    const diffSnippet =
      body.diff ||
      body.diff_full ||
      body.diff_snippet ||
      body.message ||
      body.body ||
      'Alteração detectada na página monitorada.';

    const rawTag = body.tag || body.tags || '';
    const watchId = body.uuid || body.watch_uuid || body.watchId || '';

    // Extract UID from tag (e.g., tag could be "uid_123" or "uid_123, tag2")
    let targetUid = '';
    if (typeof rawTag === 'string' && rawTag.trim()) {
      targetUid = rawTag.split(',')[0].trim();
    } else if (Array.isArray(rawTag) && rawTag.length > 0) {
      targetUid = String(rawTag[0]).trim();
    }

    // If UID is not in tag, attempt to find the user via the monitor document in Firestore
    if (!targetUid && watchId) {
      try {
        const querySnap = await adminDb
          .collectionGroup('monitors')
          .where('uuid', '==', watchId)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const doc = querySnap.docs[0];
          // Parent user path: users/{uid}/monitors/{uuid}
          const pathSegments = doc.ref.path.split('/');
          if (pathSegments.length >= 2 && pathSegments[0] === 'users') {
            targetUid = pathSegments[1];
          }
        }
      } catch (findErr) {
        console.warn('[Changedetection Webhook] Could not find monitor by uuid:', findErr);
      }
    }

    let recipientEmail = '';

    if (targetUid) {
      // 1. Check Firebase Auth user record
      try {
        const userRecord = await adminAuth.getUser(targetUid);
        if (userRecord && userRecord.email) {
          recipientEmail = userRecord.email;
        }
      } catch {}

      // 2. Check Firestore user profile
      if (!recipientEmail) {
        try {
          const userDoc = await adminDb.collection('users').doc(targetUid).get();
          if (userDoc.exists) {
            recipientEmail = userDoc.data()?.email || '';
          }
        } catch {}
      }

      // Update monitor record in Firestore
      if (watchId) {
        try {
          const nowIso = new Date().toISOString();
          await adminDb
            .collection('users')
            .doc(targetUid)
            .collection('monitors')
            .doc(watchId)
            .set(
              {
                status: 'changed',
                lastChanged: nowIso,
                lastChecked: nowIso,
                lastDiff: diffSnippet,
              },
              { merge: true }
            );
        } catch (updateErr) {
          console.warn('[Changedetection Webhook] Failed to update monitor in Firestore:', updateErr);
        }
      }
    }

    // If an email address was found, dispatch the notification via FormSubmit
    let alertResult: { success: boolean; error?: string } = { success: false, error: 'No recipient email found' };
    if (recipientEmail) {
      alertResult = await sendEmailAlert({
        toEmail: recipientEmail,
        url: watchUrl,
        title: watchTitle,
        diffSnippet,
        detectedAt: new Date().toISOString(),
      });
      console.log(`[Changedetection Webhook] Alert sent to ${recipientEmail}:`, alertResult);
    } else {
      console.warn('[Changedetection Webhook] No recipient email found for UID:', targetUid);
    }

    return NextResponse.json({
      success: true,
      processed: true,
      uid: targetUid || null,
      emailSent: alertResult.success,
      error: alertResult.error || null,
    });
  } catch (error: any) {
    console.error('[Changedetection Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error processing webhook: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
