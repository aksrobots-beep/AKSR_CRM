import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, findWhere, insert, update, remove } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';

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
    send500(res, 'Failed to get inventory', error);
  }
});

// Get stock movements for an item (must be before GET /:id)
router.get('/:id/movements', async (req, res) => {
  try {
    const item = await findById('inventory', req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const movements = await findWhere('stock_movements', 'inventory_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(Array.isArray(movements) ? movements : []);
  } catch (error) {
    send500(res, 'Failed to get stock movements', error);
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
    send500(res, 'Failed to get inventory item', error);
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
    send500(res, 'Failed to create inventory item', error);
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
    send500(res, 'Failed to update inventory item', error);
  }
});

// MySQL-safe datetime for stock_movements.created_at
function toMySQLDatetime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Adjust stock
router.patch('/:id/stock', async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { adjustment, reason } = req.body;
    if (typeof adjustment !== 'number') return res.status(400).json({ error: 'Adjustment amount is required' });
    const now = toMySQLDatetime(new Date());
    const nowIso = new Date().toISOString();
    const current = await findById('inventory', req.params.id);
    if (!current) return res.status(404).json({ error: 'Item not found' });
    const newQuantity = (current.quantity || 0) + adjustment;
    if (newQuantity < 0) return res.status(400).json({ error: 'Insufficient stock' });

    // Record in stock_movements (source of truth for movement history)
    const movementType = adjustment >= 0 ? 'in' : 'out';
    const absQty = Math.abs(adjustment);
    await insert('stock_movements', {
      id: uuidv4(),
      inventory_id: req.params.id,
      type: movementType,
      quantity: absQty,
      reason: reason || (adjustment >= 0 ? 'Stock replenishment' : 'Stock adjustment'),
      ticket_id: null,
      user_id: req.user.id,
      created_at: now,
    });

    // Update inventory quantity
    const item = await update('inventory', req.params.id, { quantity: newQuantity, updated_at: nowIso, updated_by: req.user.id });

    // Optional: audit_logs (do not block if table missing or schema differs)
    try {
      await insert('audit_logs', {
        id: uuidv4(),
        entity_type: 'inventory',
        entity_id: req.params.id,
        action: 'stock_adjustment',
        previous_value: JSON.stringify({ quantity: current.quantity }),
        new_value: JSON.stringify({ quantity: newQuantity, reason: reason || '' }),
        user_id: req.user.id,
        timestamp: now,
      });
    } catch (auditErr) {
      console.warn('Stock adjustment audit log skipped:', auditErr?.message || auditErr);
    }

    res.json(item);
  } catch (error) {
    send500(res, 'Failed to adjust stock', error);
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
    send500(res, 'Failed to toggle inventory status', error);
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
    send500(res, 'Failed to delete inventory item', error);
  }
});

export { router as inventoryRoutes };
