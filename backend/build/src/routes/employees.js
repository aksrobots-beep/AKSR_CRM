import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, findOne, insert, update, remove } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Get all employees (with user data)
router.get('/', async (req, res) => {
  try {
    const [usersData, employeeRecords] = await Promise.all([findAll('users'), findAll('employees')]);
    const users = usersData.filter(u => u.is_active === 1 || u.is_active === true);
    const employees = users.map(user => {
      const empRecord = employeeRecords.find(e => e.user_id === user.id) || {};
      return { id: empRecord.id || user.id, user_id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, position: empRecord.position || (user.role || '').replace('_', ' '), join_date: empRecord.join_date || user.created_at, salary: empRecord.salary || 0, annual_leave_balance: empRecord.annual_leave_balance ?? 14, sick_leave_balance: empRecord.sick_leave_balance ?? 14, is_active: user.is_active };
    });
    if (!['ceo', 'admin', 'hr_manager', 'finance'].includes(req.user.role)) employees.forEach(e => { e.salary = undefined; });
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to get employees' });
  }
});

// Get single employee
router.get('/:id', async (req, res) => {
  try {
    const user = await findById('users', req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const empRecords = await findAll('employees');
    const empRecord = empRecords.find(e => e.user_id === req.params.id) || {};
    
    const employee = {
      id: empRecord.id || user.id,
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      position: empRecord.position || user.role.replace('_', ' '),
      join_date: empRecord.join_date || user.created_at,
      salary: empRecord.salary || 0,
      annual_leave_balance: empRecord.annual_leave_balance ?? 14,
      sick_leave_balance: empRecord.sick_leave_balance ?? 14,
      is_active: user.is_active,
      updated_at: user.updated_at,
    };
    
    // Filter salary for non-authorized users
    if (!['ceo', 'admin', 'hr_manager', 'finance'].includes(req.user.role)) {
      employee.salary = undefined;
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Failed to get employee' });
  }
});

// Update employee (HR/Admin only)
router.put('/:id', requireRole('ceo', 'admin', 'hr_manager'), async (req, res) => {
  try {
    const { position, join_date, salary, annual_leave_balance, sick_leave_balance } = req.body;
    const now = new Date().toISOString();
    const empRecords = await findAll('employees');
    let empRecord = empRecords.find(e => e.user_id === req.params.id);
    const updates = { position, join_date, salary, annual_leave_balance, sick_leave_balance, updated_at: now, updated_by: req.user.id };
    Object.keys(updates).forEach(key => { if (updates[key] === undefined) delete updates[key]; });
    if (empRecord) {
      empRecord = await update('employees', empRecord.id, updates);
    } else {
      empRecord = { id: uuidv4(), user_id: req.params.id, ...updates, created_at: now, created_by: req.user.id };
      await insert('employees', empRecord);
    }
    const user = await findById('users', req.params.id);
    res.json({ id: empRecord.id, user_id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, position: empRecord.position || (user.role || '').replace('_', ' '), join_date: empRecord.join_date || user.created_at, salary: empRecord.salary || 0, annual_leave_balance: empRecord.annual_leave_balance ?? 14, sick_leave_balance: empRecord.sick_leave_balance ?? 14, is_active: user.is_active, updated_at: user.updated_at });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Toggle active/inactive (updates user's is_active)
router.patch('/:id/active', requireRole('ceo', 'admin', 'hr_manager'), async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const user = await findById('users', req.params.id);
    if (!user) return res.status(404).json({ error: 'Employee not found' });
    
    await update('users', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now 
    });
    
    const empRecords = await findAll('employees');
    const empRecord = empRecords.find(e => e.user_id === req.params.id) || {};
    const updatedUser = await findById('users', req.params.id);
    
    res.json({ 
      id: empRecord.id || updatedUser.id, 
      user_id: updatedUser.id, 
      name: updatedUser.name, 
      email: updatedUser.email, 
      role: updatedUser.role, 
      department: updatedUser.department, 
      position: empRecord.position || (updatedUser.role || '').replace('_', ' '), 
      join_date: empRecord.join_date || updatedUser.created_at, 
      salary: empRecord.salary || 0, 
      annual_leave_balance: empRecord.annual_leave_balance ?? 14, 
      sick_leave_balance: empRecord.sick_leave_balance ?? 14, 
      is_active: updatedUser.is_active,
      updated_at: updatedUser.updated_at 
    });
  } catch (error) {
    console.error('Toggle employee active error:', error);
    res.status(500).json({ error: 'Failed to toggle employee status' });
  }
});

// Delete employee (deactivates user, doesn't delete)
router.delete('/:id', requireRole('ceo', 'admin', 'hr_manager'), async (req, res) => {
  try {
    const user = await findById('users', req.params.id);
    if (!user) return res.status(404).json({ error: 'Employee not found' });
    
    // Deactivate instead of deleting (preserves data)
    const now = new Date().toISOString();
    await update('users', req.params.id, { 
      is_active: 0, 
      updated_at: now 
    });
    
    res.json({ message: 'Employee deactivated successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to deactivate employee' });
  }
});

export { router as employeeRoutes };
