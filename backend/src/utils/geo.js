/**
 * Haversine distance in meters between two WGS84 points.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(Number(lat1));
  const φ2 = toRad(Number(lat2));
  const Δφ = toRad(Number(lat2) - Number(lat1));
  const Δλ = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function defaultGeofenceRadiusM() {
  const v = parseInt(process.env.CLIENT_GEOFENCE_RADIUS_M || '1000', 10);
  return Number.isFinite(v) && v > 0 ? v : 1000;
}

export function geofenceSlackM() {
  const v = parseInt(process.env.GEOFENCE_SLACK_M || '100', 10);
  return Number.isFinite(v) && v >= 0 ? v : 100;
}

export function maxReportedAccuracyM() {
  const v = parseInt(process.env.CLIENT_GEOCODE_MAX_ACCURACY_M || '200', 10);
  return Number.isFinite(v) && v > 0 ? v : 200;
}

export function effectiveRadiusM(client) {
  const per = client?.geofence_radius_m;
  const n = per != null ? parseInt(per, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return defaultGeofenceRadiusM();
}

/** Fixed radius for manual demo / off-site check-in (not the client’s mapped site). */
export const AD_HOC_DEMO_RADIUS_M = 500;

/** User must be within radiusM + slack of center. */
export function insideCircleGeofence(centerLat, centerLng, radiusM, userLat, userLng) {
  const dist = haversineMeters(userLat, userLng, centerLat, centerLng);
  const maxDist = Number(radiusM) + geofenceSlackM();
  return { ok: dist <= maxDist, distanceM: dist, maxDist };
}
