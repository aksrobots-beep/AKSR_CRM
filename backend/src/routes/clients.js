import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove, query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { userCanAccessClient } from '../utils/visitAccess.js';
import { effectiveRadiusM } from '../utils/geo.js';

const router = Router();

const CLIENT_UPDATE_KEYS = new Set([
  'name', 'company_name', 'old_company_name', 'client_code', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code', 'industry', 'assigned_to', 'notes', 'status',
  'latitude', 'longitude', 'geofence_radius_m', 'geocoded_at', 'geocode_source',
]);

function pickClientUpdates(body) {
  const out = {};
  for (const k of CLIENT_UPDATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

/** Check for duplicate client_code, email, or phone. Returns { error: string } or null. */
async function checkClientUniqueness({ client_code, email, phone, excludeId = null }) {
  const exclude = excludeId != null ? excludeId : '';
  const idCondition = exclude ? ' AND id <> ?' : '';
  const params = (extra) => (exclude ? [...extra, exclude] : extra);

  if (client_code != null && String(client_code).trim() !== '') {
    const code = String(client_code).trim();
    const rows = await query(
      `SELECT id FROM clients WHERE TRIM(COALESCE(client_code, '')) = ?${idCondition} LIMIT 1`,
      params([code])
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return { error: 'Client code already in use by another client.' };
    }
  }

  if (email != null && String(email).trim() !== '') {
    const em = String(email).trim().toLowerCase();
    const rows = await query(
      `SELECT id FROM clients WHERE LOWER(TRIM(COALESCE(email, ''))) = ? AND TRIM(COALESCE(email, '')) <> ''${idCondition} LIMIT 1`,
      params([em])
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return { error: 'Email already in use by another client.' };
    }
  }

  if (phone != null && String(phone).trim() !== '') {
    const ph = String(phone).trim();
    const rows = await query(
      `SELECT id FROM clients WHERE TRIM(COALESCE(phone, '')) = ? AND TRIM(COALESCE(phone, '')) <> ''${idCondition} LIMIT 1`,
      params([ph])
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return { error: 'Phone number already in use by another client.' };
    }
  }

  return null;
}

function calcMonthlyRevenue(equipmentList) {
  return equipmentList
    .filter(e => e.ownership_type === 'rental' && e.rental_amount > 0)
    .reduce((sum, e) => sum + Number(e.rental_amount), 0);
}

// Geocode address (server-side; optional Google key or OSM Nominatim)
router.post('/geocode', async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { address, city, state, country, postal_code } = req.body || {};
    const parts = [address, city, state, postal_code, country].filter((p) => p != null && String(p).trim() !== '');
    const q = parts.join(', ').trim();
    if (!q) return res.status(400).json({ error: 'Provide address, city, state, or country to geocode' });

    const googleKey = (process.env.GOOGLE_MAPS_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
    if (googleKey) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${googleKey}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.status !== 'OK' || !j.results?.[0]?.geometry?.location) {
        return res.status(400).json({ error: j.error_message || j.status || 'Geocoding failed' });
      }
      const loc = j.results[0].geometry.location;
      return res.json({
        lat: loc.lat,
        lng: loc.lng,
        display_name: j.results[0].formatted_address,
        source: 'google',
      });
    }

    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(nomUrl, {
      headers: { 'User-Agent': 'AKSuccessCRM-Server/1.0 (client-geocode)' },
    });
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr[0]) {
      return res.status(400).json({ error: 'No results from geocoder' });
    }
    const hit = arr[0];
    return res.json({
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      display_name: hit.display_name,
      source: 'nominatim',
    });
  } catch (error) {
    send500(res, 'Geocoding failed', error);
  }
});

// Site anchor for visit / geofence apps (restricted)
router.get('/:id/site', async (req, res) => {
  try {
    const client = await findById('clients', req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const allowed = await userCanAccessClient(req.user, req.params.id);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
    const lat = client.latitude != null ? Number(client.latitude) : null;
    const lng = client.longitude != null ? Number(client.longitude) : null;
    res.json({
      client_id: client.id,
      company_name: client.company_name,
      name: client.name,
      latitude: lat,
      longitude: lng,
      geofence_radius_m: client.geofence_radius_m != null ? Number(client.geofence_radius_m) : null,
      effective_radius_m: effectiveRadiusM(client),
      site_configured: lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng),
    });
  } catch (error) {
    send500(res, 'Failed to get client site', error);
  }
});

// Get all clients
router.get('/', async (req, res) => {
  try {
    const [clientsData, equipmentData] = await Promise.all([findAll('clients'), findAll('equipment')]);
    const clients = clientsData.map(client => {
      const eq = equipmentData.filter(e => e.client_id === client.id);
      return {
        ...client,
        equipment_count: eq.length,
        robot_count: eq.filter(e => e.ownership_type === 'rental').length,
        total_revenue: calcMonthlyRevenue(eq),
      };
    });
    res.json(clients.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    send500(res, 'Failed to get clients', error);
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const [client, equipmentData, ticketsData] = await Promise.all([
      findById('clients', req.params.id),
      findAll('equipment'),
      findAll('tickets'),
    ]);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const equipment = equipmentData.filter(e => e.client_id === client.id);
    const tickets = ticketsData.filter(t => t.client_id === client.id).slice(0, 10);
    res.json({
      ...client,
      equipment_count: equipment.length,
      robot_count: equipment.filter(e => e.ownership_type === 'rental').length,
      total_revenue: calcMonthlyRevenue(equipment),
      equipment,
      tickets,
    });
  } catch (error) {
    send500(res, 'Failed to get client', error);
  }
});

// MySQL-safe datetime (YYYY-MM-DD HH:MM:SS)
function toMySQLDatetime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Create client
router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const {
      name, company_name, old_company_name, client_code, email, phone, address, city, state, country, postal_code, industry, assigned_to, notes,
      latitude, longitude, geofence_radius_m, geocode_source: geocodeSourceBody,
    } = req.body;
    if (!name || !company_name) return res.status(400).json({ error: 'Name and company name are required' });

    const uniqueness = await checkClientUniqueness({ client_code, email, phone });
    if (uniqueness) return res.status(400).json({ error: uniqueness.error });

    const now = toMySQLDatetime(new Date());
    const latN = latitude != null && latitude !== '' ? parseFloat(latitude) : null;
    const lngN = longitude != null && longitude !== '' ? parseFloat(longitude) : null;
    const radN = geofence_radius_m != null && geofence_radius_m !== '' ? parseInt(geofence_radius_m, 10) : null;
    const hasCoords = latN != null && lngN != null && Number.isFinite(latN) && Number.isFinite(lngN);
    const client = {
      id: uuidv4(),
      client_code: client_code != null ? String(client_code).trim() : null,
      name: String(name).trim(),
      company_name: String(company_name).trim(),
      old_company_name: old_company_name != null && String(old_company_name).trim() !== '' ? String(old_company_name).trim() : null,
      email: email != null ? String(email).trim() : '',
      phone: phone != null ? String(phone).trim() : '',
      address: address != null ? String(address).trim() : '',
      city: city != null ? String(city).trim() : '',
      state: state != null ? String(state).trim() : '',
      country: (country != null ? String(country).trim() : '') || 'Malaysia',
      postal_code: postal_code != null ? String(postal_code).trim() : '',
      industry: industry != null ? String(industry).trim() : '',
      assigned_to: assigned_to || null,
      notes: notes != null ? String(notes).trim() : '',
      latitude: hasCoords ? latN : null,
      longitude: hasCoords ? lngN : null,
      geofence_radius_m: radN != null && Number.isFinite(radN) && radN > 0 ? radN : null,
      geocoded_at: hasCoords ? now : null,
      geocode_source: hasCoords
        ? (geocodeSourceBody != null && String(geocodeSourceBody).trim() !== '' ? String(geocodeSourceBody).trim() : 'manual')
        : null,
      total_revenue: 0,
      status: 'active',
      is_active: 1,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('clients', client);
    res.status(201).json(client);
  } catch (error) {
    send500(res, 'Failed to create client', error);
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const { client_code, email, phone } = req.body;
    const uniqueness = await checkClientUniqueness({
      client_code: client_code !== undefined ? client_code : null,
      email: email !== undefined ? email : null,
      phone: phone !== undefined ? phone : null,
      excludeId: req.params.id,
    });
    if (uniqueness) return res.status(400).json({ error: uniqueness.error });

    const now = new Date().toISOString();
    const updates = pickClientUpdates(req.body);
    updates.updated_at = now;
    updates.updated_by = req.user.id;
    if (updates.old_company_name !== undefined) {
      updates.old_company_name = updates.old_company_name != null && String(updates.old_company_name).trim() !== '' ? String(updates.old_company_name).trim() : null;
    }
    if (updates.latitude !== undefined || updates.longitude !== undefined) {
      const latN = updates.latitude != null && updates.latitude !== '' ? parseFloat(updates.latitude) : null;
      const lngN = updates.longitude != null && updates.longitude !== '' ? parseFloat(updates.longitude) : null;
      const hasCoords = latN != null && lngN != null && Number.isFinite(latN) && Number.isFinite(lngN);
      updates.latitude = hasCoords ? latN : null;
      updates.longitude = hasCoords ? lngN : null;
      if (hasCoords) {
        updates.geocoded_at = toMySQLDatetime(new Date());
        if (!updates.geocode_source) updates.geocode_source = 'manual';
      }
    }
    if (updates.geofence_radius_m !== undefined) {
      const r = updates.geofence_radius_m != null && updates.geofence_radius_m !== '' ? parseInt(updates.geofence_radius_m, 10) : null;
      updates.geofence_radius_m = r != null && Number.isFinite(r) && r > 0 ? r : null;
    }
    const client = await update('clients', req.params.id, updates);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    send500(res, 'Failed to update client', error);
  }
});

// Toggle active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const client = await update('clients', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now, 
      updated_by: req.user.id 
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    send500(res, 'Failed to toggle client status', error);
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    const result = await remove('clients', req.params.id);
    if (!result) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    send500(res, 'Failed to delete client', error);
  }
});

export { router as clientRoutes };
