import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove } from '../db/index.js';

const router = Router();

// Get all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await findAll('suppliers');
    res.json(suppliers);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to get suppliers' });
  }
});

// Get single supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await findById('suppliers', req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Failed to get supplier' });
  }
});

// Create supplier
router.post('/', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const supplier = { id: uuidv4(), name: req.body.name, contact: req.body.contact || '', email: req.body.email || '', whatsapp: req.body.whatsapp || '', wechat: req.body.wechat || '', lark: req.body.lark || '', group_link: req.body.group_link || '', qr_code: req.body.qr_code || '', status: req.body.status || 'active', is_active: 1, notes: req.body.notes || '', created_at: now, updated_at: now, created_by: req.user?.id || null, updated_by: req.user?.id || null };
    await insert('suppliers', supplier);
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await findById('suppliers', req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const updates = { ...req.body, updated_at: new Date().toISOString(), updated_by: req.user?.id || null };
    const updated = await update('suppliers', req.params.id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Toggle active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const supplier = await update('suppliers', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now, 
      updated_by: req.user?.id || null 
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    console.error('Toggle supplier active error:', error);
    res.status(500).json({ error: 'Failed to toggle supplier status' });
  }
});

// Delete supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await findById('suppliers', req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    await remove('suppliers', req.params.id);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

export { router as supplierRoutes };
