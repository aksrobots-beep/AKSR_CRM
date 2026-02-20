import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove } from '../db/index.js';

const router = Router();

// Get all equipment
router.get('/', async (req, res) => {
  try {
    const { type, status, client_id } = req.query;
    
    let equipment = await findAll('equipment');
    
    if (type) equipment = equipment.filter(e => e.type === type);
    if (status) equipment = equipment.filter(e => e.status === status);
    if (client_id) equipment = equipment.filter(e => e.client_id === client_id);
    
    // Add client name
    const result = await Promise.all(equipment.map(async (eq) => {
      const client = await findById('clients', eq.client_id);
      return { ...eq, client_name: client?.company_name };
    }));
    
    res.json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Failed to get equipment' });
  }
});

// Get single equipment
router.get('/:id', async (req, res) => {
  try {
    const equipment = await findById('equipment', req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    const [c, ticketsData] = await Promise.all([findById('clients', equipment.client_id), findAll('tickets')]);
    const serviceHistory = ticketsData.filter(t => t.equipment_id === equipment.id).slice(0, 10);
    res.json({ ...equipment, client_name: c?.company_name, serviceHistory });
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Failed to get equipment' });
  }
});

// Create equipment
router.post('/', async (req, res) => {
  try {
    const { name, type, model, serial_number, manufacturer, client_id, installation_date, warranty_expiry, location, notes } = req.body;
    if (!name || !type || !client_id) return res.status(400).json({ error: 'Name, type, and client are required' });
    const now = new Date().toISOString();
    const equipment = {
      id: uuidv4(), name, type, model: model || '', serial_number: serial_number || '', manufacturer: manufacturer || '', client_id,
      installation_date: installation_date || now, warranty_expiry: warranty_expiry || null, last_service_date: null, next_service_date: null,
      location: location || '', notes: notes || '', status: 'operational', is_active: 1, created_at: now, updated_at: now, created_by: req.user.id, updated_by: req.user.id,
    };
    await insert('equipment', equipment);
    res.status(201).json(equipment);
  } catch (error) {
    console.error('Create equipment error:', error);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

// Update equipment
router.put('/:id', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const updates = { ...req.body, updated_at: now, updated_by: req.user.id };
    
    const equipment = await update('equipment', req.params.id, updates);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(equipment);
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Toggle active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const equipment = await update('equipment', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now, 
      updated_by: req.user.id 
    });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json(equipment);
  } catch (error) {
    console.error('Toggle equipment active error:', error);
    res.status(500).json({ error: 'Failed to toggle equipment status' });
  }
});

// Delete equipment
router.delete('/:id', async (req, res) => {
  try {
    const result = await remove('equipment', req.params.id);
    if (!result) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

export { router as equipmentRoutes };
