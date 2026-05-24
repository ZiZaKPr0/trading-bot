import axios from 'axios';
import { createLogger } from '../logger.js';

const log = createLogger('geofence');

export interface GeoblockResult {
  blocked: boolean;
  country?: string;
  region?: string;
}

export async function checkGeoblock(): Promise<GeoblockResult> {
  try {
    const res = await axios.get<GeoblockResult>(
      'https://polymarket.com/api/geoblock',
      { timeout: 10_000 },
    );
    if (res.data.blocked) {
      log.warn({ geo: res.data }, 'Geoblock: trading restricted in this region');
    }
    return res.data;
  } catch (err) {
    log.error({ err }, 'Geoblock check failed');
    throw err;
  }
}

export async function assertGeoblockAllowed() {
  const geo = await checkGeoblock();
  if (geo.blocked) {
    throw new Error(
      `Trading blocked in ${geo.country ?? 'unknown'}/${geo.region ?? 'unknown'}`,
    );
  }
}

export function startGeofenceMonitor(intervalMs = 3_600_000) {
  const tick = async () => {
    try {
      await assertGeoblockAllowed();
    } catch (err) {
      log.error({ err }, 'Geofence monitor alert');
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}
