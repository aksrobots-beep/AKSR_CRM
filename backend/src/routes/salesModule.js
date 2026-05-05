import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { writeAudit } from '../services/auditLog.js';
import { canIncludeInactiveRows, filterActiveRows, isEntityActive } from '../utils/entityActive.js';
import { validateDate } from '../utils/validateDate.js';
import { createNotification } from './notifications.js';
import {
  sendAccountingRequestEmail,
  sendDeliveryOrderHandoffEmail,
  sendPurchaseOrderReceivedEmail,
} from '../services/email.js';
import { normalizeUserRole } from '../utils/userRole.js';

const router = Router();

function actingRole(req) {
  return normalizeUserRole(req.user?.role) || req.user?.role || '';
}

const ROLES_MANAGE_QUOTE_PO = new Set(['ceo', 'admin', 'sales', 'service_manager', 'finance']);
const ROLES_MANAGE_DO = new Set(['ceo', 'admin', 'sales', 'operations', 'service_manager', 'finance']);
const ROLES_HANDLE_REQUESTS = new Set(['ceo', 'admin', 'sales', 'finance', 'service_manager', 'operations']);
const ROLES_TECH = new Set(['technician']);

function parseJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

async function loadTicket(id, req) {
  const t = await findById('tickets', id);
  if (!t) return null;
  if (!isEntityActive(t) && !canIncludeInactiveRows(req)) return null;
  return t;
}

function userCanViewTicket(user, ticket) {
  if (!user?.id || !ticket) return false;
  const r = normalizeUserRole(user.role) || user.role;
  if (['ceo', 'admin', 'service_manager', 'finance', 'sales', 'operations', 'hr_manager'].includes(r)) {
    return true;
  }
  if (r === 'technician') {
    return ticket.assigned_to === user.id || ticket.created_by === user.id;
  }
  return true;
}

async function assertTicketAccess(res, user, ticketId, req) {
  const ticket = await loadTicket(ticketId, req);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return null;
  }
  if (!userCanViewTicket(user, ticket)) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return ticket;
}

async function generateQuotationNumber() {
  const year = new Date().getFullYear();
  const all = await findAll('quotations');
  const rows = filterActiveRows(all).filter((q) => q.quotation_number?.startsWith(`QT-${year}-`));
  const maxNum = rows.reduce((max, q) => {
    const num = parseInt(String(q.quotation_number).split('-')[2], 10) || 0;
    return num > max ? num : max;
  }, 0);
  return `QT-${year}-${String(maxNum + 1).padStart(4, '0')}`;
}

async function generateDeliveryNumber() {
  const year = new Date().getFullYear();
  const all = await findAll('delivery_orders');
  const rows = filterActiveRows(all).filter((d) => d.delivery_number?.startsWith(`DO-${year}-`));
  const maxNum = rows.reduce((max, d) => {
    const num = parseInt(String(d.delivery_number).split('-')[2], 10) || 0;
    return num > max ? num : max;
  }, 0);
  return `DO-${year}-${String(maxNum + 1).padStart(4, '0')}`;
}

async function notifyRoles(roles, title, message, link) {
  const users = await findAll('users');
  const targets = users.filter((u) => u.is_active !== 0 && roles.has(normalizeUserRole(u.role) || u.role));
  for (const u of targets) {
    try {
      await createNotification(u.id, { title, message, type: 'info', link });
    } catch {
      /* best-effort */
    }
  }
}

// --- Quotations ---

router.get('/quotations', async (req, res) => {
  try {
    const { ticket_id, status } = req.query;
    let rows = await findAll('quotations');
    if (!canIncludeInactiveRows(req)) rows = filterActiveRows(rows);
    if (ticket_id) rows = rows.filter((r) => r.ticket_id === ticket_id);
    if (status) rows = rows.filter((r) => r.status === status);
    if (ROLES_TECH.has(actingRole(req))) {
      const allowed = [];
      for (const r of rows) {
        const t = await loadTicket(r.ticket_id, req);
        if (t && userCanViewTicket(req.user, t)) allowed.push(r);
      }
      rows = allowed;
    }
    const out = await Promise.all(
      rows.map(async (q) => {
        const ticket = await findById('tickets', q.ticket_id);
        const client = await findById('clients', q.client_id);
        return {
          ...q,
          line_items: parseJson(q.line_items, []),
          ticket_number: ticket?.ticket_number,
          client_name: client?.company_name,
        };
      })
    );
    res.json(out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (e) {
    send500(res, 'Failed to list quotations', e);
  }
});

router.get('/quotations/:id', async (req, res) => {
  try {
    const q = await findById('quotations', req.params.id);
    if (!q || (!isEntityActive(q) && !canIncludeInactiveRows(req))) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(q.ticket_id, req);
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    if (!userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const client = await findById('clients', q.client_id);
    res.json({
      ...q,
      line_items: parseJson(q.line_items, []),
      ticket_number: ticket?.ticket_number,
      client_name: client?.company_name,
    });
  } catch (e) {
    send500(res, 'Failed to get quotation', e);
  }
});

router.post('/quotations', async (req, res) => {
  try {
    if (!ROLES_MANAGE_QUOTE_PO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const { ticket_id, client_id, line_items, valid_until, notes, status } = req.body;
    if (!ticket_id || !client_id) return res.status(400).json({ error: 'ticket_id and client_id required' });
    const ticket = await assertTicketAccess(res, req.user, ticket_id, req);
    if (!ticket) return;
    if (String(client_id) !== String(ticket.client_id)) {
      return res.status(400).json({ error: 'client_id must match ticket client' });
    }
    let validUntil = null;
    if (valid_until) {
      const vr = validateDate(valid_until, { required: false, fieldName: 'valid_until' });
      if (!vr.valid) return res.status(400).json({ error: vr.error });
      validUntil = vr.value;
    }
    const now = new Date().toISOString();
    const row = {
      id: uuidv4(),
      ticket_id,
      client_id,
      quotation_number: await generateQuotationNumber(),
      status: status && ['draft', 'sent', 'approved', 'rejected', 'expired'].includes(status) ? status : 'draft',
      line_items: JSON.stringify(Array.isArray(line_items) ? line_items : []),
      valid_until: validUntil,
      notes: notes || '',
      approved_at: null,
      rejection_reason: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('quotations', row);
    await writeAudit(req, {
      entity_type: 'quotation',
      entity_id: row.id,
      action: 'create',
      new_value: { quotation_number: row.quotation_number, status: row.status },
    });
    res.status(201).json({ ...row, line_items: parseJson(row.line_items, []) });
  } catch (e) {
    send500(res, 'Failed to create quotation', e);
  }
});

router.put('/quotations/:id', async (req, res) => {
  try {
    if (!ROLES_MANAGE_QUOTE_PO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const existing = await findById('quotations', req.params.id);
    if (!existing || !isEntityActive(existing)) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(existing.ticket_id, req);
    if (!ticket || !userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const { line_items, valid_until, notes, status } = req.body;
    const updates = { updated_at: new Date().toISOString(), updated_by: req.user.id };
    if (line_items !== undefined) updates.line_items = JSON.stringify(Array.isArray(line_items) ? line_items : []);
    if (notes !== undefined) updates.notes = notes;
    if (valid_until !== undefined) {
      if (valid_until) {
        const vr = validateDate(valid_until, { required: false, fieldName: 'valid_until' });
        if (!vr.valid) return res.status(400).json({ error: vr.error });
        updates.valid_until = vr.value;
      } else updates.valid_until = null;
    }
    if (status && ['draft', 'sent', 'approved', 'rejected', 'expired'].includes(status)) {
      updates.status = status;
      if (status === 'approved') updates.approved_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (status !== 'rejected') updates.rejection_reason = null;
    }
    const updated = await update('quotations', req.params.id, updates);
    await writeAudit(req, {
      entity_type: 'quotation',
      entity_id: req.params.id,
      action: 'update',
      previous_value: { status: existing.status },
      new_value: updates,
    });
    res.json({ ...updated, line_items: parseJson(updated.line_items, []) });
  } catch (e) {
    send500(res, 'Failed to update quotation', e);
  }
});

// --- Client POs ---

router.get('/client-pos', async (req, res) => {
  try {
    const { ticket_id, status } = req.query;
    let rows = await findAll('client_purchase_orders');
    if (!canIncludeInactiveRows(req)) rows = filterActiveRows(rows);
    if (ticket_id) rows = rows.filter((r) => r.ticket_id === ticket_id);
    if (status) rows = rows.filter((r) => r.status === status);
    if (ROLES_TECH.has(actingRole(req))) {
      const allowed = [];
      for (const r of rows) {
        const t = await loadTicket(r.ticket_id, req);
        if (t && userCanViewTicket(req.user, t)) allowed.push(r);
      }
      rows = allowed;
    }
    const out = await Promise.all(
      rows.map(async (p) => {
        const ticket = await findById('tickets', p.ticket_id);
        return { ...p, ticket_number: ticket?.ticket_number };
      })
    );
    res.json(out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (e) {
    send500(res, 'Failed to list POs', e);
  }
});

router.post('/client-pos', async (req, res) => {
  try {
    if (!ROLES_MANAGE_QUOTE_PO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const { ticket_id, quotation_id, po_number, po_date, status, notes } = req.body;
    if (!ticket_id || !po_number) return res.status(400).json({ error: 'ticket_id and po_number required' });
    const ticket = await assertTicketAccess(res, req.user, ticket_id, req);
    if (!ticket) return;
    let poDate = null;
    if (po_date) {
      const dr = validateDate(po_date, { required: false, fieldName: 'po_date' });
      if (!dr.valid) return res.status(400).json({ error: dr.error });
      poDate = dr.value;
    }
    const now = new Date().toISOString();
    const row = {
      id: uuidv4(),
      ticket_id,
      quotation_id: quotation_id || null,
      po_number: String(po_number).slice(0, 100),
      po_date: poDate,
      status: status && ['requested', 'received', 'cancelled'].includes(status) ? status : 'requested',
      notes: notes || '',
      is_active: 1,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('client_purchase_orders', row);
    await writeAudit(req, { entity_type: 'client_purchase_order', entity_id: row.id, action: 'create', new_value: row });
    res.status(201).json(row);
  } catch (e) {
    send500(res, 'Failed to create PO', e);
  }
});

router.patch('/client-pos/:id', async (req, res) => {
  try {
    if (!ROLES_MANAGE_QUOTE_PO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const existing = await findById('client_purchase_orders', req.params.id);
    if (!existing || !isEntityActive(existing)) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(existing.ticket_id, req);
    if (!ticket || !userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const { po_number, po_date, status, notes, quotation_id } = req.body;
    const updates = { updated_at: new Date().toISOString(), updated_by: req.user.id };
    if (po_number !== undefined) updates.po_number = String(po_number).slice(0, 100);
    if (notes !== undefined) updates.notes = notes;
    if (quotation_id !== undefined) updates.quotation_id = quotation_id || null;
    if (po_date !== undefined) {
      if (po_date) {
        const dr = validateDate(po_date, { required: false, fieldName: 'po_date' });
        if (!dr.valid) return res.status(400).json({ error: dr.error });
        updates.po_date = dr.value;
      } else updates.po_date = null;
    }
    const prevStatus = existing.status;
    if (status && ['requested', 'received', 'cancelled'].includes(status)) updates.status = status;

    const updated = await update('client_purchase_orders', req.params.id, updates);

    if (updates.status === 'received' && prevStatus !== 'received') {
      await sendPurchaseOrderReceivedEmail({ ticket, po: updated, actorName: req.user.name || req.user.email });
      if (ticket.status === 'awaiting_po') {
        await update('tickets', ticket.id, {
          status: 'ready_for_field',
          updated_at: new Date().toISOString(),
          updated_by: req.user.id,
        });
      }
    }

    await writeAudit(req, {
      entity_type: 'client_purchase_order',
      entity_id: req.params.id,
      action: 'update',
      previous_value: { status: prevStatus },
      new_value: updates,
    });
    res.json(updated);
  } catch (e) {
    send500(res, 'Failed to update PO', e);
  }
});

// --- Delivery orders ---

router.get('/delivery-orders', async (req, res) => {
  try {
    const { ticket_id, status } = req.query;
    let rows = await findAll('delivery_orders');
    if (!canIncludeInactiveRows(req)) rows = filterActiveRows(rows);
    if (ticket_id) rows = rows.filter((r) => r.ticket_id === ticket_id);
    if (status) rows = rows.filter((r) => r.status === status);
    if (ROLES_TECH.has(actingRole(req))) {
      const allowed = [];
      for (const r of rows) {
        const t = await loadTicket(r.ticket_id, req);
        if (t && userCanViewTicket(req.user, t)) allowed.push(r);
      }
      rows = allowed;
    }
    const out = await Promise.all(
      rows.map(async (d) => {
        const ticket = await findById('tickets', d.ticket_id);
        return { ...d, ticket_number: ticket?.ticket_number };
      })
    );
    res.json(out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (e) {
    send500(res, 'Failed to list delivery orders', e);
  }
});

router.post('/delivery-orders', async (req, res) => {
  try {
    if (!ROLES_MANAGE_DO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const { ticket_id, notes, status } = req.body;
    if (!ticket_id) return res.status(400).json({ error: 'ticket_id required' });
    const ticket = await assertTicketAccess(res, req.user, ticket_id, req);
    if (!ticket) return;
    const now = new Date().toISOString();
    const row = {
      id: uuidv4(),
      ticket_id,
      delivery_number: await generateDeliveryNumber(),
      status: status && ['draft', 'issued', 'acknowledged'].includes(status) ? status : 'draft',
      notes: notes || '',
      issued_at: null,
      acknowledged_at: null,
      acknowledged_by: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('delivery_orders', row);
    await writeAudit(req, { entity_type: 'delivery_order', entity_id: row.id, action: 'create', new_value: row });
    res.status(201).json(row);
  } catch (e) {
    send500(res, 'Failed to create delivery order', e);
  }
});

router.patch('/delivery-orders/:id/issue', async (req, res) => {
  try {
    if (!ROLES_MANAGE_DO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const existing = await findById('delivery_orders', req.params.id);
    if (!existing || !isEntityActive(existing)) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(existing.ticket_id, req);
    if (!ticket || !userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const now = new Date().toISOString();
    const updates = {
      status: 'issued',
      issued_at: now,
      updated_at: now,
      updated_by: req.user.id,
    };
    const updated = await update('delivery_orders', req.params.id, updates);
    await writeAudit(req, {
      entity_type: 'delivery_order',
      entity_id: req.params.id,
      action: 'issue',
      new_value: updates,
    });
    await notifyRoles(
      new Set(['operations', 'service_manager', 'ceo', 'admin']),
      `Delivery order issued: ${updated.delivery_number}`,
      `${ticket.ticket_number || ''}: ${ticket.title || ''}`.trim(),
      '/sales'
    );
    await sendDeliveryOrderHandoffEmail({ ticket, deliveryOrder: updated, actorName: req.user.name || req.user.email });
    res.json(updated);
  } catch (e) {
    send500(res, 'Failed to issue DO', e);
  }
});

router.patch('/delivery-orders/:id/acknowledge', async (req, res) => {
  try {
    if (!ROLES_MANAGE_DO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const existing = await findById('delivery_orders', req.params.id);
    if (!existing || !isEntityActive(existing)) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(existing.ticket_id, req);
    if (!ticket || !userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const now = new Date().toISOString();
    const updates = {
      status: 'acknowledged',
      acknowledged_at: now,
      acknowledged_by: req.user.id,
      updated_at: now,
      updated_by: req.user.id,
    };
    const updated = await update('delivery_orders', req.params.id, updates);
    await writeAudit(req, {
      entity_type: 'delivery_order',
      entity_id: req.params.id,
      action: 'acknowledge',
      new_value: updates,
    });
    res.json(updated);
  } catch (e) {
    send500(res, 'Failed to acknowledge DO', e);
  }
});

router.put('/delivery-orders/:id', async (req, res) => {
  try {
    if (!ROLES_MANAGE_DO.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const existing = await findById('delivery_orders', req.params.id);
    if (!existing || !isEntityActive(existing)) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(existing.ticket_id, req);
    if (!ticket || !userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const { notes } = req.body;
    const updates = { updated_at: new Date().toISOString(), updated_by: req.user.id };
    if (notes !== undefined) updates.notes = notes;
    const updated = await update('delivery_orders', req.params.id, updates);
    res.json(updated);
  } catch (e) {
    send500(res, 'Failed to update delivery order', e);
  }
});

// --- Accounting requests (technicians + back office) ---

router.get('/accounting-requests', async (req, res) => {
  try {
    const { ticket_id, status, request_type } = req.query;
    let rows = await findAll('accounting_requests');
    if (!canIncludeInactiveRows(req)) rows = filterActiveRows(rows);
    if (ticket_id) rows = rows.filter((r) => r.ticket_id === ticket_id);
    if (status) rows = rows.filter((r) => r.status === status);
    if (request_type) rows = rows.filter((r) => r.request_type === request_type);
    if (ROLES_TECH.has(actingRole(req))) {
      const allowed = [];
      for (const r of rows) {
        const t = await loadTicket(r.ticket_id, req);
        if (t && userCanViewTicket(req.user, t)) allowed.push(r);
      }
      rows = allowed;
    } else if (!ROLES_HANDLE_REQUESTS.has(actingRole(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const out = await Promise.all(
      rows.map(async (r) => {
        const ticket = await findById('tickets', r.ticket_id);
        return { ...r, ticket_number: ticket?.ticket_number, ticket_title: ticket?.title };
      })
    );
    res.json(out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (e) {
    send500(res, 'Failed to list requests', e);
  }
});

router.post('/accounting-requests', async (req, res) => {
  try {
    const { ticket_id, request_type, message } = req.body;
    if (!ticket_id || !request_type) return res.status(400).json({ error: 'ticket_id and request_type required' });
    if (!['quotation', 'delivery_order', 'invoice', 'other'].includes(request_type)) {
      return res.status(400).json({ error: 'Invalid request_type' });
    }
    const ticket = await assertTicketAccess(res, req.user, ticket_id, req);
    if (!ticket) return;
    if (!ROLES_TECH.has(actingRole(req)) && !ROLES_HANDLE_REQUESTS.has(actingRole(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const now = new Date().toISOString();
    const row = {
      id: uuidv4(),
      ticket_id,
      request_type,
      status: 'open',
      message: message || '',
      assigned_to: null,
      resolved_notes: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('accounting_requests', row);
    await writeAudit(req, { entity_type: 'accounting_request', entity_id: row.id, action: 'create', new_value: row });

    const title = `Request: ${request_type.replace('_', ' ')}`;
    const msg = `${ticket.ticket_number || ticket_id}: ${message || ''}`.trim();
    await notifyRoles(
      new Set(['ceo', 'admin', 'finance', 'sales', 'service_manager']),
      title,
      msg,
      '/sales'
    );
    await sendAccountingRequestEmail({
      requestType: request_type,
      ticket,
      message: message || '',
      requestedBy: req.user.name || req.user.email,
    });

    res.status(201).json(row);
  } catch (e) {
    send500(res, 'Failed to create request', e);
  }
});

router.patch('/accounting-requests/:id', async (req, res) => {
  try {
    if (ROLES_TECH.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    if (!ROLES_HANDLE_REQUESTS.has(actingRole(req))) return res.status(403).json({ error: 'Access denied' });
    const existing = await findById('accounting_requests', req.params.id);
    if (!existing || !isEntityActive(existing)) return res.status(404).json({ error: 'Not found' });
    const ticket = await loadTicket(existing.ticket_id, req);
    if (!ticket || !userCanViewTicket(req.user, ticket)) return res.status(403).json({ error: 'Access denied' });
    const { status, assigned_to, resolved_notes } = req.body;
    const updates = { updated_at: new Date().toISOString(), updated_by: req.user.id };
    if (status && ['open', 'in_progress', 'done', 'cancelled'].includes(status)) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (resolved_notes !== undefined) updates.resolved_notes = resolved_notes;
    const updated = await update('accounting_requests', req.params.id, updates);
    await writeAudit(req, {
      entity_type: 'accounting_request',
      entity_id: req.params.id,
      action: 'update',
      new_value: updates,
    });

    if (updates.status === 'done' && existing.created_by) {
      try {
        await createNotification(existing.created_by, {
          title: 'Accounting request completed',
          message: `${existing.request_type} — ${ticket.ticket_number || ''}`,
          type: 'success',
          link: '/service',
        });
      } catch {
        /* ignore */
      }
    }

    res.json(updated);
  } catch (e) {
    send500(res, 'Failed to update request', e);
  }
});

/** Single ticket snapshot for service UI */
router.get('/ticket-summary/:ticketId', async (req, res) => {
  try {
    const ticket = await assertTicketAccess(res, req.user, req.params.ticketId, req);
    if (!ticket) return;
    let quotations = filterActiveRows(await findAll('quotations')).filter((q) => q.ticket_id === ticket.id);
    let pos = filterActiveRows(await findAll('client_purchase_orders')).filter((p) => p.ticket_id === ticket.id);
    let dos = filterActiveRows(await findAll('delivery_orders')).filter((d) => d.ticket_id === ticket.id);
    let reqs = filterActiveRows(await findAll('accounting_requests')).filter((r) => r.ticket_id === ticket.id);
    quotations = quotations.map((q) => ({ ...q, line_items: parseJson(q.line_items, []) }));
    res.json({ quotations, client_purchase_orders: pos, delivery_orders: dos, accounting_requests: reqs });
  } catch (e) {
    send500(res, 'Failed to load summary', e);
  }
});

export const salesModuleRoutes = router;
