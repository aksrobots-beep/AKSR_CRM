import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove } from '../db/index.js';

const router = Router();

// Get all inventory
router.get('/', async (req, res) => {
  try {
    const { category, low_stock } = req.query;
    let items = await findAll('inventory');
    if (category) items = items.filter(i => i.category === category);
    if (low_stock === 'true') items = items.filter(i => i.quantity <= (i.min_quantity || 0));
    res.json(items.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await findById('inventory', req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Failed to get inventory item' });
  }
});

// Create inventory item
router.post('/', async (req, res) => {
  try {
    const { sku, name, description, category, quantity, min_quantity, unit_price, supplier, location, compatible_equipment } = req.body;
    if (!sku || !name) return res.status(400).json({ error: 'SKU and name are required' });
    const now = new Date().toISOString();
    const item = { id: uuidv4(), sku, name, description: description || '', category: category || 'spare_parts', quantity: quantity || 0, min_quantity: min_quantity || 0, unit_price: unit_price || 0, supplier: supplier || '', location: location || '', compatible_equipment: JSON.stringify(compatible_equipment || []), status: 'active', is_active: 1, created_at: now, updated_at: now, created_by: req.user.id, updated_by: req.user.id };
    await insert('inventory', item);
    res.status(201).json(item);
  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString(), updated_by: req.user.id };
    if (updates.compatible_equipment && Array.isArray(updates.compatible_equipment)) updates.compatible_equipment = JSON.stringify(updates.compatible_equipment);
    const item = await update('inventory', req.params.id, updates);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Adjust stock
router.patch('/:id/stock', async (req, res) => {
  try {
    const { adjustment, reason } = req.body;
    if (typeof adjustment !== 'number') return res.status(400).json({ error: 'Adjustment amount is required' });
    const now = new Date().toISOString();
    const current = await findById('inventory', req.params.id);
    if (!current) return res.status(404).json({ error: 'Item not found' });
    const newQuantity = (current.quantity || 0) + adjustment;
    if (newQuantity < 0) return res.status(400).json({ error: 'Insufficient stock' });
    await insert('audit_logs', {
      id: uuidv4(),
      entity_type: 'inventory',
      entity_id: req.params.id,
      action: 'stock_adjustment',
      previous_value: JSON.stringify({ quantity: current.quantity }),
      new_value: JSON.stringify({ quantity: newQuantity, reason }),
      user_id: req.user.id,
      timestamp: now,
    });
    const item = await update('inventory', req.params.id, { quantity: newQuantity, updated_at: now, updated_by: req.user.id });
    res.json(item);
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Toggle active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const item = await update('inventory', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now, 
      updated_by: req.user.id 
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    console.error('Toggle inventory active error:', error);
    res.status(500).json({ error: 'Failed to toggle inventory status' });
  }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const result = await remove('inventory', req.params.id);
    if (!result) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

export { router as inventoryRoutes };
