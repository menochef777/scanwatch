/**
 * Client for interacting with real changedetection.io API
 */
export interface ChangedetectionWatch {
  uuid: string;
  url: string;
  title?: string;
  last_checked?: number;
  last_changed?: number;
  last_error?: boolean | string;
  history?: Record<string, string>;
  has_ldjson_price_data?: boolean;
  paused?: boolean;
}

function getConfig() {
  const serviceUrl = process.env.CHANGEDETECTION_URL;
  const token =
    process.env.CHANGEDETECTION_INTERNAL_TOKEN ||
    process.env.CHANGEDETECTION_INTERNAL_SECRET ||
    '';

  if (!serviceUrl) {
    throw new Error('CHANGEDETECTION_URL environment variable is not configured');
  }

  return {
    baseUrl: serviceUrl.replace(/\/$/, ''),
    headers: {
      'x-api-key': token,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Creates a new watch on changedetection.io
 */
export async function createWatch(url: string, tag?: string): Promise<{ uuid: string }> {
  const { baseUrl, headers } = getConfig();
  const response = await fetch(`${baseUrl}/api/v1/watch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url,
      tag: tag || '',
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Failed to create watch (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Gets details of a single watch
 */
export async function getWatch(uuid: string): Promise<ChangedetectionWatch> {
  const { baseUrl, headers } = getConfig();
  const response = await fetch(`${baseUrl}/api/v1/watch/${encodeURIComponent(uuid)}`, {
    method: 'GET',
    headers: {
      'x-api-key': headers['x-api-key'],
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Failed to get watch ${uuid} (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    uuid,
    ...data,
  };
}

/**
 * Gets history list of timestamps for a watch
 */
export async function getWatchHistory(uuid: string): Promise<Record<string, string>> {
  const { baseUrl, headers } = getConfig();
  const response = await fetch(`${baseUrl}/api/v1/watch/${encodeURIComponent(uuid)}/history`, {
    method: 'GET',
    headers: {
      'x-api-key': headers['x-api-key'],
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Failed to get watch history (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Gets the raw text snapshot of a watch at a specific timestamp (or latest)
 */
export async function getWatchSnapshot(uuid: string, timestamp?: string): Promise<string> {
  const { baseUrl, headers } = getConfig();
  const url = timestamp
    ? `${baseUrl}/api/v1/watch/${encodeURIComponent(uuid)}/history/${encodeURIComponent(timestamp)}`
    : `${baseUrl}/api/v1/watch/${encodeURIComponent(uuid)}/history/latest`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': headers['x-api-key'],
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Failed to get snapshot (${response.status}): ${errText}`);
  }

  return response.text();
}

/**
 * Deletes a watch from changedetection.io
 */
export async function deleteWatch(uuid: string): Promise<boolean> {
  const { baseUrl, headers } = getConfig();
  const response = await fetch(`${baseUrl}/api/v1/watch/${encodeURIComponent(uuid)}`, {
    method: 'DELETE',
    headers: {
      'x-api-key': headers['x-api-key'],
    },
  });

  if (!response.ok && response.status !== 404) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Failed to delete watch (${response.status}): ${errText}`);
  }

  return true;
}

/**
 * Requests an immediate recheck of a watch
 */
export async function recheckWatch(uuid: string): Promise<boolean> {
  const { baseUrl, headers } = getConfig();
  // changedetection.io recheck endpoint can be triggered via GET or POST depending on version
  const response = await fetch(`${baseUrl}/api/v1/watch/${encodeURIComponent(uuid)}`, {
    method: 'GET',
    headers: {
      'x-api-key': headers['x-api-key'],
    },
  });

  return response.ok;
}
