import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove } from '../db/index.js';

const router = Router();

// Get all clients
router.get('/', async (req, res) => {
  try {
    const [clientsData, equipmentData] = await Promise.all([findAll('clients'), findAll('equipment')]);
    const clients = clientsData.map(client => {
      const eq = equipmentData.filter(e => e.client_id === client.id);
      return {
        ...client,
        equipment_count: eq.length,
        robot_count: eq.filter(e => e.type === 'robot').length,
      };
    });
    res.json(clients.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const [client, equipmentData, ticketsData] = await Promise.all([
      findById('clients', req.params.id),
      findAll('equipment'),
      findAll('tickets'),
    ]);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const equipment = equipmentData.filter(e => e.client_id === client.id);
    const tickets = ticketsData.filter(t => t.client_id === client.id).slice(0, 10);
    res.json({
      ...client,
      equipment_count: equipment.length,
      robot_count: equipment.filter(e => e.type === 'robot').length,
      equipment,
      tickets,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to get client' });
  }
});

// Create client
router.post('/', async (req, res) => {
  try {
    const { name, company_name, email, phone, address, city, state, country, postal_code, industry, assigned_to, notes } = req.body;
    if (!name || !company_name) return res.status(400).json({ error: 'Name and company name are required' });
    const now = new Date().toISOString();
    const client = {
      id: uuidv4(),
      name,
      company_name,
      email: email || '',
      phone: phone || '',
      address: address || '',
      city: city || '',
      state: state || '',
      country: country || 'Malaysia',
      postal_code: postal_code || '',
      industry: industry || '',
      assigned_to: assigned_to || null,
      notes: notes || '',
      total_revenue: 0,
      status: 'active',
      is_active: 1,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      updated_by: req.user.id,
    };
    await insert('clients', client);
    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const updates = { ...req.body, updated_at: now, updated_by: req.user.id };
    const client = await update('clients', req.params.id, updates);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Toggle active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body;
    const now = new Date().toISOString();
    const client = await update('clients', req.params.id, { 
      is_active: is_active ? 1 : 0, 
      updated_at: now, 
      updated_by: req.user.id 
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error('Toggle client active error:', error);
    res.status(500).json({ error: 'Failed to toggle client status' });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    const result = await remove('clients', req.params.id);
    if (!result) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export { router as clientRoutes };
