import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove } from '../db/index.js';
import { requireRole, requireApproval } from '../middleware/auth.js';
import { validateDate } from '../utils/validateDate.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const all = await findAll('invoices');
  const invoices = all.filter(i => i.invoice_number?.startsWith(`INV-${year}-`));
  const maxNum = invoices.reduce((max, i) => { const num = parseInt(i.invoice_number.split('-')[2]) || 0; return num > max ? num : max; }, 0);
  return `INV-${year}-${String(maxNum + 1).padStart(4, '0')}`;
}

// Get all invoices
router.get('/', requireRole('ceo', 'admin', 'finance'), async (req, res) => {
  try {
    const { status, client_id } = req.query;
    
    let invoices = await findAll('invoices');
    
    if (status) invoices = invoices.filter(i => i.status === status);
    if (client_id) invoices = invoices.filter(i => i.client_id === client_id);
    
    const result = await Promise.all(invoices.map(async (inv) => {
      const client = await findById('clients', inv.client_id);
      let items = inv.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      return { ...inv, client_name: client?.company_name, items };
    }));
    
    res.json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Get invoices error:', error);
    send500(res, 'Failed to get invoices', error);
  }
});

// Get single invoice
router.get('/:id', requireRole('ceo', 'admin', 'finance'), async (req, res) => {
  try {
    const invoice = await findById('invoices', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const c = await findById('clients', invoice.client_id);
    let items = invoice.items || [];
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
    res.json({ ...invoice, client_name: c?.company_name, client_email: c?.email, client_address: c?.address, city: c?.city, state: c?.state, postal_code: c?.postal_code, items });
  } catch (error) {
    console.error('Get invoice error:', error);
    send500(res, 'Failed to get invoice', error);
  }
});

// Create invoice
router.post('/', requireRole('ceo', 'admin', 'finance'), async (req, res) => {
  try {
    const { client_id, ticket_id, issue_date, due_date, items, tax_rate, notes } = req.body;
    
    if (!client_id || !issue_date || !due_date || !items || !items.length) {
      return res.status(400).json({ error: 'Client, dates, and items are required' });
    }
    const issueResult = validateDate(issue_date, { required: true, fieldName: 'Issue date' });
    if (!issueResult.valid) return res.status(400).json({ error: issueResult.error });
    const dueResult = validateDate(due_date, { required: true, fieldName: 'Due date' });
    if (!dueResult.valid) return res.status(400).json({ error: dueResult.error });
    
    const now = new Date().toISOString();
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * ((tax_rate || 6) / 100);
    const total = subtotal + tax;
    
    const invoice = {
      id: uuidv4(),
      invoice_number: await generateInvoiceNumber(),
      client_id,
      ticket_id: ticket_id || null,
      issue_date: issueResult.value,
      due_date: dueResult.value,
      items: JSON.stringify(items),
      subtotal,
      tax,
      total,
      paid_amount: 0,
      notes: notes || '',
      status: 'draft',
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    
    await insert('invoices', invoice);
    res.status(201).json({ ...invoice, items });
  } catch (error) {
    console.error('Create invoice error:', error);
    send500(res, 'Failed to create invoice', error);
  }
});

// Update invoice
router.put('/:id', requireRole('ceo', 'admin', 'finance'), async (req, res) => {
  try {
    const { issue_date, due_date, items, tax_rate, notes, status } = req.body;
    const now = new Date().toISOString();
    const updates = { updated_at: now, updated_by: req.user.id };
    if (issue_date !== undefined) {
      const r = validateDate(issue_date, { required: false, fieldName: 'Issue date' });
      if (!r.valid) return res.status(400).json({ error: r.error });
      if (r.value != null) updates.issue_date = r.value;
    }
    if (due_date !== undefined) {
      const r = validateDate(due_date, { required: false, fieldName: 'Due date' });
      if (!r.valid) return res.status(400).json({ error: r.error });
      if (r.value != null) updates.due_date = r.value;
    }
    if (notes !== undefined) updates.notes = notes;
    if (status) updates.status = status;
    if (items) { const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0); const tax = subtotal * ((tax_rate || 6) / 100); updates.items = JSON.stringify(items); updates.subtotal = subtotal; updates.tax = tax; updates.total = subtotal + tax; }
    const invoice = await update('invoices', req.params.id, updates);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    let parsedItems = invoice.items || [];
    if (typeof parsedItems === 'string') { try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; } }
    res.json({ ...invoice, items: parsedItems });
  } catch (error) {
    console.error('Update invoice error:', error);
    send500(res, 'Failed to update invoice', error);
  }
});

// Record payment
router.patch('/:id/payment', requireRole('ceo', 'admin', 'finance'), requireApproval, async (req, res) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Valid payment amount is required' });
    const now = new Date().toISOString();
    const invoice = await findById('invoices', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const newPaidAmount = (invoice.paid_amount || 0) + amount;
    const newStatus = newPaidAmount >= invoice.total ? 'paid' : invoice.status;
    const client = await findById('clients', invoice.client_id);
    if (client) await update('clients', invoice.client_id, { total_revenue: (client.total_revenue || 0) + amount });
    const updated = await update('invoices', req.params.id, { paid_amount: newPaidAmount, status: newStatus, updated_at: now, updated_by: req.user.id });
    let pItems = updated.items || [];
    if (typeof pItems === 'string') { try { pItems = JSON.parse(pItems); } catch { pItems = []; } }
    res.json({ ...updated, items: pItems });
  } catch (error) {
    send500(res, 'Failed to record payment', error);
  }
});

// Delete invoice
router.delete('/:id', requireRole('ceo', 'admin', 'finance'), async (req, res) => {
  try {
    const invoice = await findById('invoices', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Cannot delete paid invoice' });
    await remove('invoices', req.params.id);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    send500(res, 'Failed to delete invoice', error);
  }
});

export { router as invoiceRoutes };
