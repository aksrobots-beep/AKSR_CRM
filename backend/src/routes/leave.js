import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, findOne, insert, update } from '../db/index.js';
import { requireRole, requireApproval } from '../middleware/auth.js';
import { validateDate } from '../utils/validateDate.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();

// Get all leave requests
router.get('/', async (req, res) => {
  try {
    const { status, employee_id } = req.query;
    const [requestsData, usersData] = await Promise.all([findAll('leave_requests'), findAll('users')]);
    let requests = requestsData;
    if (!['ceo', 'admin', 'hr_manager'].includes(req.user.role)) requests = requests.filter(r => r.employee_id === req.user.id);
    else if (employee_id) requests = requests.filter(r => r.employee_id === employee_id);
    if (status) requests = requests.filter(r => r.status === status);
    const result = requests.map(lr => {
      const employee = usersData.find(u => u.id === lr.employee_id);
      const approver = lr.approved_by ? usersData.find(u => u.id === lr.approved_by) : null;
      return { ...lr, employee_name: employee?.name, department: employee?.department, approved_by_name: approver?.name };
    });
    res.json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Get leave requests error:', error);
    send500(res, 'Failed to get leave requests', error);
  }
});

// Get single leave request
router.get('/:id', (req, res) => {
  try {
    const request = findById('leave_requests', req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    const employee = findOne('users', u => u.id === request.employee_id);
    const approver = request.approved_by ? findOne('users', u => u.id === request.approved_by) : null;
    
    res.json({
      ...request,
      employee_name: employee?.name,
      department: employee?.department,
      approved_by_name: approver?.name,
    });
  } catch (error) {
    console.error('Get leave request error:', error);
    send500(res, 'Failed to get leave request', error);
  }
});

// Create leave request
router.post('/', async (req, res) => {
  try {
    const { type, start_date, end_date, days, reason } = req.body;
    if (!type || !start_date || !end_date || !days) return res.status(400).json({ error: 'Type, dates, and days are required' });
    const startResult = validateDate(start_date, { required: true, fieldName: 'Start date' });
    if (!startResult.valid) return res.status(400).json({ error: startResult.error });
    const endResult = validateDate(end_date, { required: true, fieldName: 'End date' });
    if (!endResult.valid) return res.status(400).json({ error: endResult.error });
    const now = new Date().toISOString();
    const request = { id: uuidv4(), employee_id: req.user.id, type, start_date: startResult.value, end_date: endResult.value, days, reason: reason || '', status: 'pending', approved_by: null, rejection_reason: null, created_at: now, updated_at: now };
    await insert('leave_requests', request);
    res.status(201).json(request);
  } catch (error) {
    console.error('Create leave request error:', error);
    send500(res, 'Failed to create leave request', error);
  }
});

// Approve/Reject leave request
router.patch('/:id/status', requireRole('ceo', 'admin', 'hr_manager'), requireApproval, async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const now = new Date().toISOString();
    const request = await update('leave_requests', req.params.id, { status, approved_by: req.user.id, rejection_reason: rejection_reason || null, updated_at: now });
    if (!request) return res.status(404).json({ error: 'Leave request not found' });
    const employee = await findOne('users', u => u.id === request.employee_id);
    res.json({ ...request, employee_name: employee?.name });
  } catch (error) {
    console.error('Update leave status error:', error);
    send500(res, 'Failed to update leave status', error);
  }
});

// Update leave request (only if pending)
router.put('/:id', (req, res) => {
  try {
    const now = new Date().toISOString();
    const request = findById('leave_requests', req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    // Only the owner can edit their own pending request
    if (request.employee_id !== req.user.id && !['ceo', 'admin', 'hr_manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cannot edit this request' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Can only edit pending requests' });
    }
    
    const { type, start_date, end_date, days, reason } = req.body;
    const updates = { updated_at: now };
    
    if (type) updates.type = type;
    if (start_date !== undefined) {
      const r = validateDate(start_date, { required: false, fieldName: 'Start date' });
      if (!r.valid) return res.status(400).json({ error: r.error });
      updates.start_date = r.value;
    }
    if (end_date !== undefined) {
      const r = validateDate(end_date, { required: false, fieldName: 'End date' });
      if (!r.valid) return res.status(400).json({ error: r.error });
      updates.end_date = r.value;
    }
    if (days) updates.days = days;
    if (reason !== undefined) updates.reason = reason;
    
    const updated = update('leave_requests', req.params.id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Update leave request error:', error);
    send500(res, 'Failed to update leave request', error);
  }
});

// Cancel leave request (by employee)
router.patch('/:id/cancel', async (req, res) => {
  try {
    const request = await findById('leave_requests', req.params.id);
    if (!request) return res.status(404).json({ error: 'Leave request not found' });
    if (request.employee_id !== req.user.id && !['ceo', 'admin', 'hr_manager'].includes(req.user.role)) return res.status(403).json({ error: 'Cannot cancel this request' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Can only cancel pending requests' });
    const updated = await update('leave_requests', req.params.id, { status: 'cancelled', updated_at: new Date().toISOString() });
    res.json(updated);
  } catch (error) {
    console.error('Cancel leave request error:', error);
    send500(res, 'Failed to cancel leave request', error);
  }
});

export { router as leaveRoutes };
