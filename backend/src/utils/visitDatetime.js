/**
 * Visit rows store arrived_at / departed_at via toISOString().slice(0,19) → UTC wall clock in MySQL DATETIME.
 * Plain "YYYY-MM-DD HH:mm:ss" in JSON is parsed by browsers as *local* time → wrong duration (e.g. +8h in MY).
 * Normalize API output to ISO-8601 UTC so clients parse one unambiguous instant.
 */
export function mysqlUtcDatetimeToIso(mysqlOrDate) {
  if (mysqlOrDate == null || mysqlOrDate === '') return mysqlOrDate;
  if (mysqlOrDate instanceof Date) return mysqlOrDate.toISOString();
  const s = String(mysqlOrDate).trim();
  if (!s) return mysqlOrDate;
  if (s.includes('T') && (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s))) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? s : new Date(t).toISOString();
  }
  const asT = s.replace(' ', 'T');
  const withZ = asT.endsWith('Z') ? asT : `${asT}Z`;
  const t = Date.parse(withZ);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

function parseFieldReportManifest(raw) {
  if (raw == null || raw === '') return null;
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (o && typeof o === 'object' && Array.isArray(o.filenames)) return o;
  } catch {
    /* ignore */
  }
  return null;
}

export function serializeVisitRow(row) {
  if (!row || typeof row !== 'object') return row;
  const {
    field_report_zip: _zip,
    field_report_manifest: _manifest,
    visit_ticket_number: visitTicketNumber,
    visit_ticket_title: visitTicketTitle,
    ad_hoc_site: rawAdHoc,
    ad_hoc_center_lat: rawAdHocLat,
    ad_hoc_center_lng: rawAdHocLng,
    ...rest
  } = row;
  const manifest = parseFieldReportManifest(row.field_report_manifest);
  const field_report =
    row.field_report_zip && String(row.field_report_zip).trim()
      ? {
          available: true,
          filenames: manifest?.filenames || [],
          size_bytes: manifest?.size_bytes ?? null,
        }
      : null;

  const ticket_summary =
    row.ticket_id != null && row.ticket_id !== ''
      ? {
          id: row.ticket_id,
          number: visitTicketNumber != null && visitTicketNumber !== '' ? String(visitTicketNumber) : null,
          title: visitTicketTitle != null && visitTicketTitle !== '' ? String(visitTicketTitle) : null,
        }
      : null;

  const ad_hoc_site = rawAdHoc === 1 || rawAdHoc === true || rawAdHoc === '1';
  const hLat = rawAdHocLat != null && rawAdHocLat !== '' ? Number(rawAdHocLat) : null;
  const hLng = rawAdHocLng != null && rawAdHocLng !== '' ? Number(rawAdHocLng) : null;
  const ad_hoc_center =
    ad_hoc_site && hLat != null && hLng != null && Number.isFinite(hLat) && Number.isFinite(hLng)
      ? { lat: hLat, lng: hLng }
      : null;

  return {
    ...rest,
    ad_hoc_site,
    ad_hoc_center,
    arrived_at: mysqlUtcDatetimeToIso(row.arrived_at),
    departed_at:
      row.departed_at != null && row.departed_at !== '' ? mysqlUtcDatetimeToIso(row.departed_at) : null,
    created_at: row.created_at != null && row.created_at !== '' ? mysqlUtcDatetimeToIso(row.created_at) : row.created_at,
    updated_at: row.updated_at != null && row.updated_at !== '' ? mysqlUtcDatetimeToIso(row.updated_at) : row.updated_at,
    field_report,
    ticket_summary,
  };
}

/**
 * Use client ISO timestamp when it matches server time within a small window (user tapped "now").
 * Otherwise fall back to server time so bad/malicious clocks cannot drift far.
 * @param {unknown} recordedAt - e.g. body.recorded_at from fetch
 * @param {Date} [serverNow]
 */
export function pickRecordedInstant(recordedAt, serverNow = new Date()) {
  if (recordedAt == null || typeof recordedAt !== 'string') return serverNow;
  const t = Date.parse(recordedAt.trim());
  if (Number.isNaN(t)) return serverNow;
  const maxSkewMs = 15 * 60 * 1000;
  if (Math.abs(t - serverNow.getTime()) > maxSkewMs) return serverNow;
  return new Date(t);
}
