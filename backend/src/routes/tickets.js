import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, findOne, findWhere, insert, update, remove } from '../db/index.js';
import { validateDate } from '../utils/validateDate.js';
import { send500 } from '../utils/errorResponse.js';
import { createNotification } from './notifications.js';
import { sendReminderEmail, sendAssignmentEmail } from '../services/email.js';

const router = Router();

const baseUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

function getAccountsEmails() {
  const raw = process.env.ACCOUNTS_TEAM_EMAILS || process.env.ACCOUNTS_EMAILS || process.env.ACCOUNTS_EMAIL || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function requestBillingByEmail({ ticket, actorUserId, previousStatus }) {
  const to = getAccountsEmails();
  if (!to.length) {
    console.log('[billing request] Skipped: ACCOUNTS_TEAM_EMAILS (or ACCOUNTS_EMAILS) not set in env', { ticketId: ticket?.id });
    return { sent: false, reason: 'no_accounts_emails' };
  }

  console.log('[billing request] Sending to', to.join(', '), 'for ticket', ticket?.ticket_number || ticket?.id, 'previousStatus=', previousStatus);

  const link = `${baseUrl()}/service`;
  const title = `Billing request: ${ticket?.ticket_number || ticket?.id || 'Ticket'}`;
  const message = [
    `Ticket: ${ticket?.title || ''}`.trim(),
    ticket?.ticket_number ? `Ticket No: ${ticket.ticket_number}` : '',
    ticket?.priority ? `Priority: ${ticket.priority}` : '',
    ticket?.status ? `Status: ${ticket.status}` : '',
    actorUserId ? `Requested by user: ${actorUserId}` : '',
  ].filter(Boolean).join('\n');

  const result = await sendReminderEmail({
    to: to.join(','),
    name: 'Accounts Team',
    title,
    message,
    link,
  });

  if (!result.sent) {
    console.log('[billing request] Email not sent', { to, ticketId: ticket?.id, reason: result.reason || 'unknown' });
  } else {
    console.log('[billing request] Email sent', { to, ticketId: ticket?.id, at: new Date().toISOString() });
  }

  return result;
}

// Generate ticket number
async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const all = await findAll('tickets');
  const tickets = all.filter(t => t.ticket_number?.startsWith(`TKT-${year}-`));
  const maxNum = tickets.reduce((max, t) => {
    const num = parseInt(t.ticket_number.split('-')[2]) || 0;
    return num > max ? num : max;
  }, 0);
  return `TKT-${year}-${String(maxNum + 1).padStart(4, '0')}`;
}

// Get all tickets
router.get('/', async (req, res) => {
  try {
    const { status, priority, assigned_to, client_id } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;
    const [ticketsData, clientsData, equipmentData, usersData] = await Promise.all([
      findAll('tickets'),
      findAll('clients'),
      findAll('equipment'),
      findAll('users'),
    ]);
    let tickets = ticketsData;
    if (userRole === 'technician') tickets = tickets.filter(t => t.assigned_to === userId || t.created_by === userId);
    if (status) tickets = tickets.filter(t => t.status === status);
    if (priority) tickets = tickets.filter(t => t.priority === priority);
    if (assigned_to) tickets = tickets.filter(t => t.assigned_to === assigned_to);
    if (client_id) tickets = tickets.filter(t => t.client_id === client_id);
    const result = tickets.map(ticket => {
      const client = clientsData.find(c => c.id === ticket.client_id);
      const equipment = ticket.equipment_id ? equipmentData.find(e => e.id === ticket.equipment_id) : null;
      const assignee = ticket.assigned_to ? usersData.find(u => u.id === ticket.assigned_to) : null;
      return { ...ticket, client_name: client?.company_name, equipment_name: equipment?.name, assigned_to_name: assignee?.name };
    });
    res.json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Get tickets error:', error);
    send500(res, 'Failed to get tickets', error);
  }
});

// Get single ticket
router.get('/:id', async (req, res) => {
  try {
    const ticket = await findById('tickets', req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role === 'technician' && ticket.assigned_to !== req.user.id && ticket.created_by !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    const [c, e, a] = await Promise.all([
      findById('clients', ticket.client_id),
      ticket.equipment_id ? findById('equipment', ticket.equipment_id) : null,
      ticket.assigned_to ? findOne('users', u => u.id === ticket.assigned_to) : null,
    ]);
    res.json({
      ...ticket,
      client_name: c?.company_name, client_email: c?.email, client_phone: c?.phone,
      equipment_name: e?.name, equipment_model: e?.model, serial_number: e?.serial_number,
      assigned_to_name: a?.name,
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    send500(res, 'Failed to get ticket', error);
  }
});

// Get all technicians (for assignment dropdown)
router.get('/meta/technicians', async (req, res) => {
  try {
    const all = await findAll('users');
    const technicians = all
      .filter(u => ['technician', 'service_manager'].includes(u.role) && (u.is_active === 1 || u.is_active === true))
      .map(u => ({ id: u.id, name: u.name, role: u.role }));
    res.json(technicians);
  } catch (error) {
    console.error('Get technicians error:', error);
    send500(res, 'Failed to get technicians', error);
  }
});

// Create ticket
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, client_id, equipment_id, assigned_to, due_date, next_action_date, next_action_item, action_taken, estimated_hours, tags, is_billable: isBillableRaw } = req.body;
    if (!title || !client_id) return res.status(400).json({ error: 'Title and client are required' });
    const is_billable = (isBillableRaw === false || isBillableRaw === 'false' || isBillableRaw === 0) ? 0 : 1;
    // Technicians can create tickets; if they don't assign to anyone, assign to themselves so the ticket appears in their list
    const effectiveAssignedTo = (req.user.role === 'technician' && (assigned_to === '' || assigned_to === null || assigned_to === undefined))
      ? req.user.id
      : (assigned_to || null);
    const dueResult = validateDate(due_date, { required: false, fieldName: 'Due date' });
    if (!dueResult.valid) return res.status(400).json({ error: dueResult.error });
    const nextResult = validateDate(next_action_date, { required: false, fieldName: 'Next action date' });
    if (!nextResult.valid) return res.status(400).json({ error: nextResult.error });
    const now = new Date().toISOString();
    const ticket = {
      id: uuidv4(),
      ticket_number: await generateTicketNumber(),
      title,
      description: description || '',
      priority: priority || 'medium',
      status: effectiveAssignedTo ? 'assigned' : 'new',
      client_id,
      equipment_id: equipment_id || null,
      assigned_to: effectiveAssignedTo,
      due_date: dueResult.value || null,
      next_action_date: nextResult.value || null,
      next_action_item: next_action_item || '',
      action_taken: action_taken || '',
      estimated_hours: estimated_hours || null,
      actual_hours: null,
      labor_cost: 0,
      parts_cost: 0,
      total_cost: 0,
      tags: JSON.stringify(tags || []),
      resolved_at: null,
      closed_at: null,
      is_active: 1,
      is_billable,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('tickets', ticket);
    const assignee = ticket.assigned_to ? await findOne('users', u => u.id === ticket.assigned_to) : null;
    if (ticket.assigned_to) {
      await createNotification(ticket.assigned_to, {
        title: 'New ticket assigned to you',
        message: `${ticket.title} (${ticket.ticket_number})`,
        type: 'info',
        link: '/service',
      });
      if (assignee?.email) {
        try {
          await sendAssignmentEmail({
            to: assignee.email,
            assigneeName: assignee.name,
            ticketNumber: ticket.ticket_number,
            ticketTitle: ticket.title,
            priority: ticket.priority || 'medium',
            link: `${baseUrl()}/service`,
          });
        } catch (e) {
          console.warn('[tickets] Assignment email failed', e?.message || e);
        }
      }
    }
    res.status(201).json({ ...ticket, assigned_to_name: assignee?.name });
  } catch (error) {
    console.error('Create ticket error:', error);
    send500(res, 'Failed to create ticket', error);
  }
});

// Allowed fields for ticket update (avoids sending non-column keys; is_billable may be missing on older DBs)
const TICKET_UPDATE_KEYS = [
  'title', 'description', 'priority', 'status', 'client_id', 'equipment_id', 'assigned_to',
  'due_date', 'next_action_date', 'next_action_item', 'action_taken', 'estimated_hours', 'actual_hours',
  'labor_cost', 'parts_cost', 'tags', 'is_billable',
  'updated_at', 'updated_by',
];

// Update ticket
router.put('/:id', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const currentTicket = await findById('tickets', req.params.id);
    if (!currentTicket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role === 'technician' && currentTicket.assigned_to !== req.user.id && currentTicket.created_by !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const updates = { updated_at: now, updated_by: req.user.id };
    for (const key of TICKET_UPDATE_KEYS) {
      if (key === 'updated_at' || key === 'updated_by') continue;
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.due_date !== undefined) {
      const r = validateDate(updates.due_date, { required: false, fieldName: 'Due date' });
      if (!r.valid) return res.status(400).json({ error: r.error });
      updates.due_date = r.value ?? null;
    }
    if (updates.next_action_date !== undefined) {
      const r = validateDate(updates.next_action_date, { required: false, fieldName: 'Next action date' });
      if (!r.valid) return res.status(400).json({ error: r.error });
      updates.next_action_date = r.value ?? null;
    }
    if (updates.is_billable !== undefined) {
      updates.is_billable = (updates.is_billable === false || updates.is_billable === 'false' || updates.is_billable === 0) ? 0 : 1;
    }
    // Empty string breaks FK: assigned_to references users(id); normalize to null
    if (updates.assigned_to === '') updates.assigned_to = null;
    if (updates.client_id === '') updates.client_id = null;
    if (updates.equipment_id === '') updates.equipment_id = null;

    const targetStatus = updates.status || currentTicket.status;
    const effectiveIsBillable = updates.is_billable !== undefined ? updates.is_billable : currentTicket.is_billable;
    if (updates.assigned_to && currentTicket.status === 'new') updates.status = 'assigned';
    if (updates.status === 'resolved' && currentTicket.status !== 'resolved') updates.resolved_at = now;
    if (updates.status === 'closed' && currentTicket.status !== 'closed') updates.closed_at = now;
    if (updates.tags && Array.isArray(updates.tags)) updates.tags = JSON.stringify(updates.tags);
    if (updates.labor_cost !== undefined || updates.parts_cost !== undefined) {
      updates.total_cost = (updates.labor_cost ?? currentTicket.labor_cost ?? 0) + (updates.parts_cost ?? currentTicket.parts_cost ?? 0);
    }

    let ticket;
    let lastErr;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        ticket = await update('tickets', req.params.id, updates);
        lastErr = null;
        break;
      } catch (updateErr) {
        lastErr = updateErr;
        const msg = (updateErr?.message || '').toString();
        const unknownCol = msg.match(/Unknown column '([^']+)'/);
        if (unknownCol) {
          const col = unknownCol[1];
          delete updates[col];
          console.warn(`Ticket update: stripping missing column "${col}". Run DB migrations.`);
        } else {
          throw updateErr;
        }
      }
    }
    if (lastErr) throw lastErr;

    if (
      effectiveIsBillable === 1 &&
      (targetStatus === 'resolved' || targetStatus === 'closed') &&
      targetStatus !== currentTicket.status
    ) {
      await requestBillingByEmail({ ticket, actorUserId: req.user?.id, previousStatus: currentTicket.status });
    } else if (effectiveIsBillable !== 1 && (targetStatus === 'resolved' || targetStatus === 'closed') && targetStatus !== currentTicket.status) {
      console.log('[billing request] Skipped: ticket not billable', { ticketId: req.params.id, is_billable: effectiveIsBillable });
    } else if (effectiveIsBillable === 1 && (targetStatus === 'resolved' || targetStatus === 'closed') && targetStatus === currentTicket.status) {
      console.log('[billing request] Skipped: status unchanged (already ' + targetStatus + ')', { ticketId: req.params.id });
    }

    const assignee = ticket.assigned_to ? await findOne('users', u => u.id === ticket.assigned_to) : null;
    if (updates.assigned_to && updates.assigned_to !== currentTicket.assigned_to) {
      await createNotification(updates.assigned_to, {
        title: 'Ticket assigned to you',
        message: `${ticket.title} (${ticket.ticket_number})`,
        type: 'info',
        link: '/service',
      });
      if (assignee?.email) {
        try {
          await sendAssignmentEmail({
            to: assignee.email,
            assigneeName: assignee.name,
            ticketNumber: ticket.ticket_number,
            ticketTitle: ticket.title,
            priority: ticket.priority || 'medium',
            link: `${baseUrl()}/service`,
          });
        } catch (e) {
          console.warn('[tickets] Assignment email failed', e?.message || e);
        }
      }
    }
    res.json({ ...ticket, assigned_to_name: assignee?.name });
  } catch (error) {
    console.error('Update ticket error:', error);
    send500(res, 'Failed to update ticket', error);
  }
});

// MySQL-safe datetime (YYYY-MM-DD HH:MM:SS)
function toMySQLDatetime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Assign ticket to technician
router.patch('/:id/assign', async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { assigned_to } = req.body;
    const now = toMySQLDatetime(new Date());
    const currentTicket = await findById('tickets', req.params.id);
    if (!currentTicket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role === 'technician' && currentTicket.assigned_to !== req.user.id && currentTicket.created_by !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    const updates = {
      assigned_to: assigned_to || null,
      updated_at: now,
      updated_by: req.user.id,
    };
    if (assigned_to && currentTicket.status === 'new') updates.status = 'assigned';
    // Audit log is optional (table may not exist or may have different schema)
    try {
      await insert('audit_logs', {
        id: uuidv4(),
        entity_type: 'ticket',
        entity_id: req.params.id,
        action: 'assignment',
        previous_value: JSON.stringify(currentTicket.assigned_to || 'unassigned'),
        new_value: JSON.stringify(assigned_to || 'unassigned'),
        user_id: req.user.id,
        timestamp: now,
      });
    } catch (auditErr) {
      console.warn('Assign audit log skipped:', auditErr?.message || auditErr);
    }
    const ticket = await update('tickets', req.params.id, updates);
    const assignee = ticket.assigned_to ? await findOne('users', u => u.id === ticket.assigned_to) : null;
    if (assigned_to) {
      await createNotification(assigned_to, {
        title: 'Ticket assigned to you',
        message: `${ticket.title} (${ticket.ticket_number})`,
        type: 'info',
        link: '/service',
      });
      if (assignee?.email) {
        try {
          await sendAssignmentEmail({
            to: assignee.email,
            assigneeName: assignee.name,
            ticketNumber: ticket.ticket_number,
            ticketTitle: ticket.title,
            priority: ticket.priority || 'medium',
            link: `${baseUrl()}/service`,
          });
        } catch (e) {
          console.warn('[tickets] Assignment email failed', e?.message || e);
        }
      }
    }
    res.json({ ...ticket, assigned_to_name: assignee?.name });
  } catch (error) {
    send500(res, 'Failed to assign ticket', error);
  }
});

// Update ticket status only
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const now = toMySQLDatetime(new Date());
    const currentTicket = await findById('tickets', req.params.id);
    if (!currentTicket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role === 'technician' && currentTicket.assigned_to !== req.user.id && currentTicket.created_by !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const updates = { status, updated_at: now, updated_by: req.user.id };
    if (status === 'resolved') updates.resolved_at = now;
    if (status === 'closed') updates.closed_at = now;
    try {
      await insert('audit_logs', {
        id: uuidv4(),
        entity_type: 'ticket',
        entity_id: req.params.id,
        action: 'status_change',
        previous_value: JSON.stringify(currentTicket.status),
        new_value: JSON.stringify(status),
        user_id: req.user.id,
        timestamp: now,
      });
    } catch (auditErr) {
      console.warn('Status audit log skipped:', auditErr?.message || auditErr);
    }
    const ticket = await update('tickets', req.params.id, updates);

    if (
      currentTicket.is_billable === 1 &&
      (status === 'resolved' || status === 'closed') &&
      status !== currentTicket.status
    ) {
      await requestBillingByEmail({ ticket, actorUserId: req.user?.id, previousStatus: currentTicket.status });
    } else if (currentTicket.is_billable !== 1 && (status === 'resolved' || status === 'closed')) {
      console.log('[billing request] Skipped: ticket not billable (is_billable=' + currentTicket.is_billable + ')', { ticketId: req.params.id });
    } else if (status === currentTicket.status) {
      console.log('[billing request] Skipped: status unchanged', { ticketId: req.params.id, status });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Update ticket status error:', error?.message || error, 'code:', error?.code);
    send500(res, 'Failed to update ticket status', error);
  }
});

// Toggle active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const ticket = await update('tickets', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now, 
      updated_by: req.user.id 
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (error) {
    console.error('Toggle ticket active error:', error);
    send500(res, 'Failed to toggle ticket status', error);
  }
});

// Delete ticket
router.delete('/:id', async (req, res) => {
  try {
    const result = await remove('tickets', req.params.id);
    if (!result) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    send500(res, 'Failed to delete ticket', error);
  }
});

// ===== PARTS USED ON TICKETS =====

// Get parts used on a ticket
router.get('/:id/parts', async (req, res) => {
  try {
    const [ticket, partsData, inventoryData] = await Promise.all([
      findById('tickets', req.params.id),
      findAll('ticket_parts'),
      findAll('inventory'),
    ]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const partsUsed = partsData.filter(tp => tp.ticket_id === req.params.id);
    const result = partsUsed.map(part => {
      const item = inventoryData.find(i => i.id === part.inventory_id);
      return { ...part, item_name: item?.name, item_sku: item?.sku, unit_price: item?.unit_price || 0, total_price: (item?.unit_price || 0) * part.quantity };
    });
    res.json(result);
  } catch (error) {
    console.error('Get ticket parts error:', error);
    send500(res, 'Failed to get ticket parts', error);
  }
});

// Add parts to a ticket (deducts from inventory)
router.post('/:id/parts', async (req, res) => {
  try {
    const { parts } = req.body;
    if (!parts || !Array.isArray(parts) || parts.length === 0) return res.status(400).json({ error: 'Parts array is required' });
    const ticket = await findById('tickets', req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const now = new Date().toISOString();
    const addedParts = [];
    let totalPartsCost = ticket.parts_cost || 0;
    for (const part of parts) {
      const item = await findById('inventory', part.inventory_id);
      if (!item) return res.status(400).json({ error: `Inventory item ${part.inventory_id} not found` });
      if (item.quantity < part.quantity) return res.status(400).json({ error: `Insufficient stock for ${item.name}. Available: ${item.quantity}` });
      await update('inventory', part.inventory_id, { quantity: item.quantity - part.quantity, updated_at: now });
      await insert('stock_movements', { id: uuidv4(), inventory_id: part.inventory_id, type: 'out', quantity: part.quantity, reason: `Used on ticket ${ticket.ticket_number}`, ticket_id: req.params.id, user_id: req.user.id, created_at: now });
      const ticketPart = { id: uuidv4(), ticket_id: req.params.id, inventory_id: part.inventory_id, quantity: part.quantity, unit_price: item.unit_price || 0, created_at: now, created_by: req.user.id };
      await insert('ticket_parts', ticketPart);
      addedParts.push({ ...ticketPart, item_name: item.name, item_sku: item.sku, total_price: (item.unit_price || 0) * part.quantity });
      totalPartsCost += (item.unit_price || 0) * part.quantity;
    }
    await update('tickets', req.params.id, { parts_cost: totalPartsCost, total_cost: (ticket.labor_cost || 0) + totalPartsCost, updated_at: now, updated_by: req.user.id });
    res.status(201).json(addedParts);
  } catch (error) {
    console.error('Add ticket parts error:', error);
    send500(res, 'Failed to add parts to ticket', error);
  }
});

// Remove a part from a ticket (returns to inventory)
router.delete('/:id/parts/:partId', async (req, res) => {
  try {
    const [ticket, ticketPart] = await Promise.all([findById('tickets', req.params.id), findById('ticket_parts', req.params.partId)]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!ticketPart || ticketPart.ticket_id !== req.params.id) return res.status(404).json({ error: 'Part usage not found' });
    const now = new Date().toISOString();
    const item = await findById('inventory', ticketPart.inventory_id);
    if (item) {
      await update('inventory', ticketPart.inventory_id, { quantity: item.quantity + ticketPart.quantity, updated_at: now });
      await insert('stock_movements', { id: uuidv4(), inventory_id: ticketPart.inventory_id, type: 'in', quantity: ticketPart.quantity, reason: `Returned from ticket ${ticket.ticket_number}`, ticket_id: req.params.id, user_id: req.user.id, created_at: now });
    }
    await remove('ticket_parts', req.params.partId);
    const remainingParts = (await findAll('ticket_parts')).filter(tp => tp.ticket_id === req.params.id);
    const newPartsCost = remainingParts.reduce((sum, p) => sum + (p.unit_price || 0) * p.quantity, 0);
    await update('tickets', req.params.id, { parts_cost: newPartsCost, total_cost: (ticket.labor_cost || 0) + newPartsCost, updated_at: now, updated_by: req.user.id });
    res.json({ message: 'Part removed from ticket' });
  } catch (error) {
    console.error('Remove ticket part error:', error);
    send500(res, 'Failed to remove part from ticket', error);
  }
});

export { router as ticketRoutes };
