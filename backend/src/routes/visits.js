import { Router } from 'express';
import { createReadStream, existsSync } from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { findById, insert, update, query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import {
  haversineMeters,
  effectiveRadiusM,
  geofenceSlackM,
  maxReportedAccuracyM,
  AD_HOC_DEMO_RADIUS_M,
  insideCircleGeofence,
} from '../utils/geo.js';
import { isManagerRole, userCanAccessClient } from '../utils/visitAccess.js';
import { pickRecordedInstant, serializeVisitRow } from '../utils/visitDatetime.js';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  writeVisitFieldReportZip,
  resolveStoredVisitZip,
} from '../utils/visitFieldReport.js';

const router = Router();

const checkoutUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

function checkoutMultipartParser(req, res, next) {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    return checkoutUpload.array('files', MAX_FILES)(req, res, next);
  }
  next();
}

function userCanAccessVisitReport(user, visit) {
  if (!user?.id || !visit) return false;
  if (visit.user_id === user.id) return true;
  if (isManagerRole(user.role)) return true;
  return false;
}

/** DB may not have field_report_* columns until migrate-all; retry without them. */
async function updateVisitCheckoutRow(visitId, payload) {
  try {
    return await update('client_site_visits', visitId, payload);
  } catch (e) {
    const msg = String(e?.message || '');
    const m = msg.match(/Unknown column '([^']+)'/i);
    if (m && String(m[1]).startsWith('field_report_')) {
      const fallback = { ...payload };
      delete fallback.field_report_zip;
      delete fallback.field_report_manifest;
      return await update('client_site_visits', visitId, fallback);
    }
    throw e;
  }
}

function toMySQLDatetime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseCoord(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function clientHasSiteCoords(client) {
  const lat = parseCoord(client?.latitude);
  const lng = parseCoord(client?.longitude);
  return lat != null && lng != null;
}

/** Inside geofence: distance <= radius + slack */
function insideGeofence(client, lat, lng) {
  const clat = parseCoord(client.latitude);
  const clng = parseCoord(client.longitude);
  if (clat == null || clng == null) return { ok: false, reason: 'site_not_configured', distanceM: null };
  const dist = haversineMeters(lat, lng, clat, clng);
  const maxDist = effectiveRadiusM(client) + geofenceSlackM();
  return { ok: dist <= maxDist, distanceM: dist, maxDist };
}

function validWgs84LatLng(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { client_id: clientId, from, to, user_id: filterUserId, name: nameRaw } = req.query;
    const manager = isManagerRole(role);
    const nameTrim = nameRaw != null ? String(nameRaw).trim() : '';
    const useNameSearch = manager && nameTrim.length > 0;

    let sql;
    const params = [];

    if (useNameSearch) {
      const esc = nameTrim.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const pattern = `%${esc.toLowerCase()}%`;
      sql = `SELECT v.*, t.ticket_number AS visit_ticket_number, t.title AS visit_ticket_title
        FROM client_site_visits v
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN clients c ON v.client_id = c.id
        LEFT JOIN tickets t ON v.ticket_id = t.id
        WHERE 1=1
        AND (
          LOWER(COALESCE(u.name,'')) LIKE ?
          OR LOWER(COALESCE(c.company_name,'')) LIKE ?
          OR LOWER(COALESCE(c.name,'')) LIKE ?
        )`;
      params.push(pattern, pattern, pattern);
    } else {
      sql = `SELECT v.*, t.ticket_number AS visit_ticket_number, t.title AS visit_ticket_title
        FROM client_site_visits v
        LEFT JOIN tickets t ON v.ticket_id = t.id
        WHERE 1=1`;
    }

    if (!manager) {
      sql += ' AND v.user_id = ?';
      params.push(userId);
    } else if (filterUserId) {
      sql += ' AND v.user_id = ?';
      params.push(filterUserId);
    }

    if (clientId) {
      sql += ' AND v.client_id = ?';
      params.push(clientId);
    }
    if (from) {
      sql += ' AND v.arrived_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND v.arrived_at <= ?';
      params.push(to);
    }

    const orderExpr = useNameSearch ? 'v.arrived_at' : 'arrived_at';
    const limitMax = manager ? 2000 : 500;
    sql += ` ORDER BY ${orderExpr} DESC LIMIT ${limitMax}`;
    const rows = await query(sql, params);
    res.json(rows.map(serializeVisitRow));
  } catch (error) {
    send500(res, 'Failed to list visits', error);
  }
});

router.get('/open', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const rows = await query(
      'SELECT * FROM client_site_visits WHERE user_id = ? AND status = ? ORDER BY arrived_at DESC',
      [userId, 'open']
    );
    res.json(rows.map(serializeVisitRow));
  } catch (error) {
    send500(res, 'Failed to list open visits', error);
  }
});

router.post('/check-in', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const {
      client_id: clientId,
      lat,
      lng,
      accuracy_m: accuracyRaw,
      ticket_id: ticketId,
      ad_hoc_site: adHocRaw,
      ad_hoc_lat: adHocLatRaw,
      ad_hoc_lng: adHocLngRaw,
    } = req.body;
    if (!clientId) return res.status(400).json({ error: 'client_id is required' });

    const latN = parseCoord(lat);
    const lngN = parseCoord(lng);
    if (latN == null || lngN == null) return res.status(400).json({ error: 'lat and lng are required' });

    const adHoc =
      adHocRaw === true || adHocRaw === 'true' || adHocRaw === 1 || adHocRaw === '1';
    let adHocLat = null;
    let adHocLng = null;
    if (adHoc) {
      adHocLat = parseCoord(adHocLatRaw);
      adHocLng = parseCoord(adHocLngRaw);
      if (adHocLat == null || adHocLng == null) {
        return res.status(400).json({ error: 'ad_hoc_lat and ad_hoc_lng are required for demo / off-site check-in' });
      }
      if (!validWgs84LatLng(adHocLat, adHocLng)) {
        return res.status(400).json({ error: 'Invalid ad_hoc_lat or ad_hoc_lng range' });
      }
    }

    const accuracy = accuracyRaw != null && String(accuracyRaw).trim() !== '' ? parseFloat(accuracyRaw) : null;
    if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return res.status(400).json({ error: 'Invalid accuracy_m' });
    }
    if (accuracy != null && accuracy > maxReportedAccuracyM()) {
      return res.status(400).json({
        error: `Location accuracy too poor (max ${maxReportedAccuracyM()} m). Wait for a better GPS fix.`,
      });
    }

    const allowed = await userCanAccessClient(req.user, clientId);
    if (!allowed) return res.status(403).json({ error: 'Access denied for this client' });

    const client = await findById('clients', clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    let geoOk;
    let distanceM;
    let maxDist;
    if (adHoc) {
      const r = insideCircleGeofence(adHocLat, adHocLng, AD_HOC_DEMO_RADIUS_M, latN, lngN);
      geoOk = r.ok;
      distanceM = r.distanceM;
      maxDist = r.maxDist;
    } else {
      if (!clientHasSiteCoords(client)) {
        return res.status(400).json({ error: 'Site location not set for this client' });
      }
      const r = insideGeofence(client, latN, lngN);
      geoOk = r.ok;
      distanceM = r.distanceM;
      maxDist = r.maxDist;
    }

    if (!geoOk) {
      return res.status(400).json({
        error: adHoc
          ? `You are outside the ${AD_HOC_DEMO_RADIUS_M} m demo radius from the coordinates you locked`
          : 'You are outside the allowed radius for this client site',
        distance_m: Math.round(distanceM),
        allowed_radius_m: maxDist,
      });
    }

    if (ticketId) {
      const ticket = await findById('tickets', ticketId);
      if (!ticket || ticket.client_id !== clientId) {
        return res.status(400).json({ error: 'Invalid ticket for this client' });
      }
      const st = String(ticket.status || '').toLowerCase();
      if (st === 'resolved' || st === 'closed') {
        return res.status(400).json({ error: 'Cannot link check-in to a resolved or closed ticket' });
      }
    }

    const existing = await query(
      'SELECT id FROM client_site_visits WHERE user_id = ? AND client_id = ? AND status = ? LIMIT 1',
      [userId, clientId, 'open']
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ error: 'You already have an open visit for this client', visit_id: existing[0].id });
    }

    const eventAt = pickRecordedInstant(req.body?.recorded_at);
    const now = toMySQLDatetime(eventAt);
    const id = uuidv4();
    const row = {
      id,
      user_id: userId,
      client_id: clientId,
      ticket_id: ticketId || null,
      status: 'open',
      arrived_at: now,
      departed_at: null,
      arrival_lat: latN,
      arrival_lng: lngN,
      departure_lat: null,
      departure_lng: null,
      arrival_accuracy_m: accuracy != null ? accuracy : null,
      departure_accuracy_m: null,
      checkout_outside_radius: 0,
      ad_hoc_site: adHoc ? 1 : 0,
      ad_hoc_center_lat: adHoc ? adHocLat : null,
      ad_hoc_center_lng: adHoc ? adHocLng : null,
      created_at: now,
      updated_at: now,
    };
    try {
      await insert('client_site_visits', row);
    } catch (insertErr) {
      const msg = String(insertErr?.message || '');
      const unknown = msg.match(/Unknown column '([^']+)'/i);
      if (unknown && String(unknown[1]).startsWith('ad_hoc_')) {
        if (adHoc) {
          return res.status(503).json({
            error: 'Database needs migration for demo-site check-in. Run: npm run migrate-all (adds ad_hoc_* columns).',
          });
        }
        const fallback = { ...row };
        delete fallback.ad_hoc_site;
        delete fallback.ad_hoc_center_lat;
        delete fallback.ad_hoc_center_lng;
        await insert('client_site_visits', fallback);
        const saved = await findById('client_site_visits', id);
        return res.status(201).json(serializeVisitRow(saved || fallback));
      }
      throw insertErr;
    }
    const saved = await findById('client_site_visits', id);
    res.status(201).json(serializeVisitRow(saved || row));
  } catch (error) {
    send500(res, 'Failed to check in', error);
  }
});

router.get('/:id/field-report', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const visit = await findById('client_site_visits', req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (!userCanAccessVisitReport(req.user, visit)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const rel = visit.field_report_zip;
    if (!rel || String(rel).trim() === '') {
      return res.status(404).json({ error: 'No field report attached' });
    }
    const abs = resolveStoredVisitZip(rel);
    if (!abs || !existsSync(abs)) {
      return res.status(404).json({ error: 'Report file missing' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="field-service-${visit.id}.zip"`);
    createReadStream(abs).pipe(res);
  } catch (error) {
    send500(res, 'Failed to download field report', error);
  }
});

router.patch('/:id/check-out', checkoutMultipartParser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const visit = await findById('client_site_visits', req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.user_id !== userId && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (visit.status !== 'open') return res.status(400).json({ error: 'Visit is already closed' });

    const { lat, lng, accuracy_m: accuracyRaw, force_outside, recorded_at: recordedAtRaw } = req.body;
    const latN = parseCoord(lat);
    const lngN = parseCoord(lng);
    if (latN == null || lngN == null) return res.status(400).json({ error: 'lat and lng are required' });

    const accuracy = accuracyRaw != null ? parseFloat(accuracyRaw) : null;
    if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return res.status(400).json({ error: 'Invalid accuracy_m' });
    }
    if (accuracy != null && accuracy > maxReportedAccuracyM()) {
      return res.status(400).json({
        error: `Location accuracy too poor (max ${maxReportedAccuracyM()} m). Wait for a better GPS fix.`,
      });
    }

    const client = await findById('clients', visit.client_id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const adHocVisit =
      visit.ad_hoc_site === 1 ||
      visit.ad_hoc_site === true ||
      visit.ad_hoc_site === '1';
    let ok;
    let distanceM;
    if (adHocVisit) {
      const cLat = parseCoord(visit.ad_hoc_center_lat);
      const cLng = parseCoord(visit.ad_hoc_center_lng);
      if (cLat == null || cLng == null) {
        return res.status(500).json({ error: 'Demo visit is missing stored coordinates' });
      }
      const r = insideCircleGeofence(cLat, cLng, AD_HOC_DEMO_RADIUS_M, latN, lngN);
      ok = r.ok;
      distanceM = r.distanceM;
    } else {
      const r = insideGeofence(client, latN, lngN);
      ok = r.ok;
      distanceM = r.distanceM;
    }
    let checkoutOutside = 0;
    const forceOutside =
      force_outside === true || force_outside === 'true' || force_outside === '1' || force_outside === 1;
    if (!ok) {
      if (forceOutside && isManagerRole(req.user.role)) {
        checkoutOutside = 1;
      } else if (forceOutside && visit.user_id === userId) {
        checkoutOutside = 1;
      } else {
        return res.status(400).json({
          error: adHocVisit
            ? `Check-out is outside the ${AD_HOC_DEMO_RADIUS_M} m demo radius from your locked point`
            : 'Check-out location is outside the allowed radius',
          distance_m: Math.round(distanceM),
          hint: 'Move closer or use force_outside if your org allows manual override',
        });
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length > MAX_FILES) {
      return res.status(400).json({ error: `Too many files (max ${MAX_FILES})` });
    }

    const eventAt = pickRecordedInstant(recordedAtRaw);
    const now = toMySQLDatetime(eventAt);

    let field_report_zip = visit.field_report_zip || null;
    let field_report_manifest = visit.field_report_manifest || null;

    if (files.length > 0) {
      const validBuffers = files.filter((f) => f?.buffer && Buffer.isBuffer(f.buffer));
      if (validBuffers.length === 0) {
        return res.status(400).json({ error: 'No valid file data received' });
      }
      try {
        const { relPath, manifest } = await writeVisitFieldReportZip(req.params.id, validBuffers);
        field_report_zip = relPath;
        field_report_manifest = JSON.stringify(manifest);
      } catch (zipErr) {
        console.error('[visits] field report zip failed', zipErr);
        return res.status(500).json({ error: 'Could not build attachment archive' });
      }
    }

    const updated = await updateVisitCheckoutRow(req.params.id, {
      status: 'closed',
      departed_at: now,
      departure_lat: latN,
      departure_lng: lngN,
      departure_accuracy_m: accuracy != null ? accuracy : null,
      checkout_outside_radius: checkoutOutside,
      updated_at: now,
      field_report_zip,
      field_report_manifest,
    });
    res.json(serializeVisitRow(updated));
  } catch (error) {
    send500(res, 'Failed to check out', error);
  }
});

export { router as visitRoutes, clientHasSiteCoords, insideGeofence };
