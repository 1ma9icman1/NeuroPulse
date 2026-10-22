export interface GaiaSkyBridgeResponse {
  success: boolean;
  connected?: boolean;
  action?: string;
  simulationTimeUtc?: unknown;
  message: string;
  resultText?: string;
}

async function requestBridge(
  path: string,
  init?: RequestInit
): Promise<GaiaSkyBridgeResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/gaiasky/${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('NeuroPulse could not reach its local Gaia Sky bridge. Run the app with npm run dev.');
  }

  let payload: GaiaSkyBridgeResponse;
  try {
    payload = (await response.json()) as GaiaSkyBridgeResponse;
  } catch {
    throw new Error(`Gaia Sky bridge returned an unreadable response (HTTP ${response.status}).`);
  }

  if (!response.ok || payload.success !== true) {
    throw new Error(payload.message || `Gaia Sky bridge request failed (HTTP ${response.status}).`);
  }

  return payload;
}

export const gaiaSkyBridge = {
  checkConnection(): Promise<GaiaSkyBridgeResponse> {
    return requestBridge('status');
  },

  focusObject(objectName: string): Promise<GaiaSkyBridgeResponse> {
    const name = objectName.trim();
    if (!name || name.length > 120) {
      return Promise.reject(new Error('Enter an object name (1–120 characters).'));
    }
    return requestBridge('focus-object', {
      method: 'POST',
      body: JSON.stringify({ objectName: name }),
    });
  },

  setSimulationYear(year: number): Promise<GaiaSkyBridgeResponse> {
    if (!Number.isInteger(year) || year < -10000 || year > 9999) {
      return Promise.reject(new Error('Year must be between 10,000 BCE and 9999 CE.'));
    }
    return requestBridge('set-year', {
      method: 'POST',
      body: JSON.stringify({ year }),
    });
  },

  pointAtSkyCoordinate(raDeg: number, decDeg: number): Promise<GaiaSkyBridgeResponse> {
    if (
      !Number.isFinite(raDeg) || raDeg < 0 || raDeg > 360 ||
      !Number.isFinite(decDeg) || decDeg < -90 || decDeg > 90
    ) {
      return Promise.reject(new Error('RA must be 0–360° and declination must be -90–90°.'));
    }
    return requestBridge('point-at-sky-coordinate', {
      method: 'POST',
      body: JSON.stringify({ raDeg, decDeg }),
    });
  },
};
