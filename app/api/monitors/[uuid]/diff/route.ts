import { NextRequest, NextResponse } from 'next/server';
import { getWatchHistory, getWatchSnapshot } from '../../../../../lib/changedetectionClient';

export const dynamic = 'force-dynamic';

/**
 * Computes simple line-by-line diff between two strings
 */
function computeLineDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const removed = oldLines.filter((l) => l.trim() && !newSet.has(l));
  const added = newLines.filter((l) => l.trim() && !oldSet.has(l));

  return {
    hasChanges: removed.length > 0 || added.length > 0,
    addedLines: added,
    removedLines: removed,
    totalAdded: added.length,
    totalRemoved: removed.length,
  };
}

/**
 * GET /api/monitors/[uuid]/diff
 * Returns real difference between latest snapshot and baseline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;

    if (!uuid || !uuid.trim()) {
      return NextResponse.json({ error: 'Missing uuid parameter' }, { status: 400 });
    }

    const history = await getWatchHistory(uuid.trim());
    const timestamps = Object.keys(history || {}).sort((a, b) => Number(a) - Number(b));

    if (timestamps.length === 0) {
      return NextResponse.json({
        success: true,
        hasChanges: false,
        message: 'No snapshots available yet for comparison.',
        snapshotsCount: 0,
      });
    }

    if (timestamps.length === 1) {
      const baselineText = await getWatchSnapshot(uuid.trim(), timestamps[0]);
      return NextResponse.json({
        success: true,
        hasChanges: false,
        message: 'Baseline snapshot captured. No subsequent changes detected yet.',
        snapshotsCount: 1,
        baselineTimestamp: new Date(Number(timestamps[0]) * 1000).toISOString(),
        baselineSample: baselineText.slice(0, 500),
      });
    }

    // Compare earliest (baseline) or previous with latest
    const baselineTs = timestamps[0];
    const latestTs = timestamps[timestamps.length - 1];

    const [baselineText, latestText] = await Promise.all([
      getWatchSnapshot(uuid.trim(), baselineTs),
      getWatchSnapshot(uuid.trim(), latestTs),
    ]);

    const diff = computeLineDiff(baselineText, latestText);

    return NextResponse.json({
      success: true,
      hasChanges: diff.hasChanges,
      snapshotsCount: timestamps.length,
      baselineTimestamp: new Date(Number(baselineTs) * 1000).toISOString(),
      latestTimestamp: new Date(Number(latestTs) * 1000).toISOString(),
      addedLines: diff.addedLines,
      removedLines: diff.removedLines,
      totalAdded: diff.totalAdded,
      totalRemoved: diff.totalRemoved,
    });
  } catch (error: any) {
    console.error('Error computing monitor diff:', error);
    return NextResponse.json(
      { error: 'Failed to compute diff: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
