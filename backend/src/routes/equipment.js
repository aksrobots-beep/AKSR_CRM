import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { findAll, findById, insert, update, remove, query } from '../db/index.js';
import { validateDate } from '../utils/validateDate.js';
import { send500 } from '../utils/errorResponse.js';
import { createNotification } from './notifications.js';

const router = Router();

/** Check due SIM reminders from equipment_sim_cards and create notifications for ceo/admin/service_manager */
async function checkSimReminders() {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const due = await query(
      `SELECT esc.id AS sim_card_id, esc.equipment_id, esc.sim_reminder_at, e.name AS equipment_name
       FROM equipment_sim_cards esc
       JOIN equipment e ON e.id = esc.equipment_id
       WHERE esc.sim_reminder_at IS NOT NULL AND esc.sim_reminder_at <= ? AND COALESCE(esc.sim_reminder_sent, 0) = 0`,
      [now]
    );
    if (!due || due.length === 0) return;
    const users = await findAll('users');
    const notifyRoles = ['ceo', 'admin', 'service_manager'];
    const toNotify = users.filter((u) => notifyRoles.includes(u.role) && (u.is_active === 1 || u.is_active === true));
    for (const row of due) {
      for (const u of toNotify) {
        await createNotification(u.id, {
          title: 'SIM reminder',
          message: `${row.equipment_name}: SIM top-up or expiry reminder (scheduled for ${row.sim_reminder_at})`,
          type: 'warning',
          link: '/robots',
        });
      }
      await update('equipment_sim_cards', row.sim_card_id, { sim_reminder_sent: 1 });
    }
  } catch (err) {
    console.warn('checkSimReminders:', err?.message || err);
  }
}

/** Normalize sim_cards from request body (array of { sim_number, sim_carrier, ... }) */
function normalizeSimCards(sim_cards) {
  if (!Array.isArray(sim_cards)) return [];
  return sim_cards
    .filter((s) => s && (s.sim_number || s.sim_carrier || s.sim_phone_number || s.sim_top_up_date || s.sim_expired_date || s.sim_reminder_at))
    .map((s, i) => ({
      sim_number: s.sim_number != null && String(s.sim_number).trim() !== '' ? String(s.sim_number).trim() : null,
      sim_carrier: s.sim_carrier != null && String(s.sim_carrier).trim() !== '' ? String(s.sim_carrier).trim() : null,
      sim_phone_number: s.sim_phone_number != null && String(s.sim_phone_number).trim() !== '' ? String(s.sim_phone_number).trim() : null,
      sim_top_up_date: s.sim_top_up_date || null,
      sim_expired_date: s.sim_expired_date || null,
      sim_reminder_at: s.sim_reminder_at != null && String(s.sim_reminder_at).trim() !== '' ? String(s.sim_reminder_at).trim().slice(0, 19).replace('T', ' ') : null,
      sort_order: i,
    }));
}

// Get all equipment
router.get('/', async (req, res) => {
  try {
    await checkSimReminders();
    const { ownership_type, status, client_id, amc_status } = req.query;
    
    let equipment = await findAll('equipment');
    
    // Filter by ownership type
    if (ownership_type) equipment = equipment.filter(e => e.ownership_type === ownership_type);
    if (status) equipment = equipment.filter(e => e.status === status);
    if (client_id) equipment = equipment.filter(e => e.client_id === client_id);
    
    // Filter by AMC status
    if (amc_status && amc_status === 'expired') {
      const now = new Date();
      equipment = equipment.filter(e => {
        if (e.ownership_type === 'sold' && e.amc_contract_end) {
          return new Date(e.amc_contract_end) < now;
        }
        return false;
      });
    }
    
    const equipmentIds = equipment.map((e) => e.id);
    let simCardsByEquipment = {};
    if (equipmentIds.length > 0) {
      try {
        const placeholders = equipmentIds.map(() => '?').join(',');
        const simCards = await query(
          `SELECT * FROM equipment_sim_cards WHERE equipment_id IN (${placeholders}) ORDER BY equipment_id, sort_order, id`,
          equipmentIds
        );
        for (const sc of simCards || []) {
          if (!simCardsByEquipment[sc.equipment_id]) simCardsByEquipment[sc.equipment_id] = [];
          simCardsByEquipment[sc.equipment_id].push(sc);
        }
      } catch (err) {
        console.warn('equipment_sim_cards query skipped (table may not exist):', err?.message || err);
      }
    }
    
    // Parse model_numbers JSON and add client name and sim_cards
    const result = await Promise.all(equipment.map(async (eq) => {
      const client = await findById('clients', eq.client_id);
      let modelNumbers = [];
      try {
        if (eq.model_numbers) {
          modelNumbers = typeof eq.model_numbers === 'string' 
            ? JSON.parse(eq.model_numbers) 
            : eq.model_numbers;
        }
      } catch (e) {
        console.warn('Failed to parse model_numbers for equipment', eq.id);
      }
      
      return { 
        ...eq, 
        model_numbers: modelNumbers,
        client_name: client?.company_name,
        sim_cards: simCardsByEquipment[eq.id] || [],
      };
    }));
    
    res.json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Get equipment error:', error);
    send500(res, 'Failed to get equipment', error);
  }
});

// Get single equipment
router.get('/:id', async (req, res) => {
  try {
    const equipment = await findById('equipment', req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    
    let simCards = [];
    const [c, ticketsData] = await Promise.all([
      findById('clients', equipment.client_id),
      findAll('tickets'),
    ]);
    try {
      const rows = await query('SELECT * FROM equipment_sim_cards WHERE equipment_id = ? ORDER BY sort_order, id', [equipment.id]);
      simCards = rows || [];
    } catch (err) {
      console.warn('equipment_sim_cards query skipped:', err?.message || err);
    }
    const serviceHistory = (ticketsData || []).filter(t => t.equipment_id === equipment.id).slice(0, 10);
    
    // Parse model_numbers JSON
    let modelNumbers = [];
    try {
      if (equipment.model_numbers) {
        modelNumbers = typeof equipment.model_numbers === 'string' 
          ? JSON.parse(equipment.model_numbers) 
          : equipment.model_numbers;
      }
    } catch (e) {
      console.warn('Failed to parse model_numbers for equipment', equipment.id);
    }
    
    res.json({ 
      ...equipment, 
      model_numbers: modelNumbers,
      client_name: c?.company_name, 
      serviceHistory,
      sim_cards: simCards || [],
    });
  } catch (error) {
    console.error('Get equipment error:', error);
    send500(res, 'Failed to get equipment', error);
  }
});

// Create equipment
router.post('/', async (req, res) => {
  try {
    const { 
      name, ownership_type, model, model_numbers, serial_number, manufacturer, client_id, 
      installation_date, warranty_expiry, location, notes,
      rental_start_date, rental_end_date, rental_duration_months, rental_amount, rental_terms,
      amc_contract_start, amc_contract_end, amc_amount, amc_terms, amc_renewal_status,
      sim_cards: sim_cards_raw,
    } = req.body;
    const sim_cards = normalizeSimCards(sim_cards_raw);
    
    // Basic validation
    if (!name || !ownership_type || !client_id) {
      return res.status(400).json({ error: 'Name, ownership type, and client are required' });
    }
    
    // Validate ownership type
    if (!['rental', 'sold'].includes(ownership_type)) {
      return res.status(400).json({ error: 'Ownership type must be either "rental" or "sold"' });
    }
    
    // Validate rental fields if ownership_type is rental
    if (ownership_type === 'rental') {
      if (!rental_start_date || !rental_end_date) {
        return res.status(400).json({ error: 'Rental start and end dates are required for rental equipment' });
      }
      
      const rentalStartResult = validateDate(rental_start_date, { required: true, fieldName: 'Rental start date' });
      if (!rentalStartResult.valid) return res.status(400).json({ error: rentalStartResult.error });
      
      const rentalEndResult = validateDate(rental_end_date, { required: true, fieldName: 'Rental end date' });
      if (!rentalEndResult.valid) return res.status(400).json({ error: rentalEndResult.error });
      
      // Validate end date is after start date
      if (new Date(rentalEndResult.value) <= new Date(rentalStartResult.value)) {
        return res.status(400).json({ error: 'Rental end date must be after start date' });
      }
    }
    
    // Validate AMC fields if provided for sold equipment
    if (ownership_type === 'sold' && amc_contract_start) {
      if (!amc_contract_end) {
        return res.status(400).json({ error: 'AMC end date is required when AMC start date is provided' });
      }
      
      const amcStartResult = validateDate(amc_contract_start, { required: true, fieldName: 'AMC contract start' });
      if (!amcStartResult.valid) return res.status(400).json({ error: amcStartResult.error });
      
      const amcEndResult = validateDate(amc_contract_end, { required: true, fieldName: 'AMC contract end' });
      if (!amcEndResult.valid) return res.status(400).json({ error: amcEndResult.error });
      
      // Validate end date is after start date
      if (new Date(amcEndResult.value) <= new Date(amcStartResult.value)) {
        return res.status(400).json({ error: 'AMC contract end date must be after start date' });
      }
    }
    
    // Validate other date fields
    const instResult = validateDate(installation_date, { required: false, fieldName: 'Installation date' });
    if (!instResult.valid) return res.status(400).json({ error: instResult.error });
    
    const warrantyResult = validateDate(warranty_expiry, { required: false, fieldName: 'Warranty expiry' });
    if (!warrantyResult.valid) return res.status(400).json({ error: warrantyResult.error });
    
    for (const sc of sim_cards) {
      if (sc.sim_top_up_date) {
        const r = validateDate(sc.sim_top_up_date, { required: false, fieldName: 'SIM top-up date' });
        if (!r.valid) return res.status(400).json({ error: r.error });
      }
      if (sc.sim_expired_date) {
        const r = validateDate(sc.sim_expired_date, { required: false, fieldName: 'SIM expired date' });
        if (!r.valid) return res.status(400).json({ error: r.error });
      }
    }
    
    // Process model_numbers
    let modelNumbersJson = null;
    if (model_numbers && Array.isArray(model_numbers) && model_numbers.length > 0) {
      modelNumbersJson = JSON.stringify(model_numbers.filter(m => m && m.trim()));
    }
    
    const now = new Date().toISOString();
    const equipment = {
      id: uuidv4(), 
      name, 
      ownership_type,
      model: model || '', 
      model_numbers: modelNumbersJson,
      serial_number: serial_number || '', 
      manufacturer: manufacturer || '', 
      client_id,
      installation_date: instResult.value || now.slice(0, 10), 
      warranty_expiry: warrantyResult.value || null, 
      last_service_date: null, 
      next_service_date: null,
      location: location || '', 
      notes: notes || '', 
      status: 'operational', 
      // Rental fields
      rental_start_date: ownership_type === 'rental' ? rental_start_date : null,
      rental_end_date: ownership_type === 'rental' ? rental_end_date : null,
      rental_duration_months: ownership_type === 'rental' ? (rental_duration_months || null) : null,
      rental_amount: ownership_type === 'rental' ? (rental_amount || null) : null,
      rental_terms: ownership_type === 'rental' ? (rental_terms || null) : null,
      // AMC fields
      amc_contract_start: ownership_type === 'sold' ? (amc_contract_start || null) : null,
      amc_contract_end: ownership_type === 'sold' ? (amc_contract_end || null) : null,
      amc_amount: ownership_type === 'sold' ? (amc_amount || null) : null,
      amc_terms: ownership_type === 'sold' ? (amc_terms || null) : null,
      amc_renewal_status: ownership_type === 'sold' ? (amc_renewal_status || null) : null,
      is_active: 1, 
      created_at: now, 
      updated_at: now, 
      created_by: req.user.id, 
      updated_by: req.user.id,
    };
    
    await insert('equipment', equipment);
    
    try {
      for (const sc of sim_cards) {
        await insert('equipment_sim_cards', {
          id: uuidv4(),
          equipment_id: equipment.id,
          sim_number: sc.sim_number,
          sim_carrier: sc.sim_carrier,
          sim_phone_number: sc.sim_phone_number,
          sim_top_up_date: sc.sim_top_up_date || null,
          sim_expired_date: sc.sim_expired_date || null,
          sim_reminder_at: sc.sim_reminder_at || null,
          sim_reminder_sent: 0,
          sort_order: sc.sort_order,
        });
      }
    } catch (err) {
      console.warn('equipment_sim_cards insert skipped (table may not exist):', err?.message || err);
    }
    
    // Parse model_numbers for response
    let modelNumbers = [];
    try {
      if (equipment.model_numbers) {
        modelNumbers = typeof equipment.model_numbers === 'string' 
          ? JSON.parse(equipment.model_numbers) 
          : equipment.model_numbers;
      }
    } catch (e) {
      console.warn('Failed to parse model_numbers for new equipment');
    }
    
    let insertedSimCards = [];
    try {
      insertedSimCards = await query('SELECT * FROM equipment_sim_cards WHERE equipment_id = ? ORDER BY sort_order, id', [equipment.id]) || [];
    } catch (_) {}
    res.status(201).json({ ...equipment, model_numbers: modelNumbers, sim_cards: insertedSimCards });
  } catch (error) {
    console.error('Create equipment error:', error);
    send500(res, 'Failed to create equipment', error);
  }
});

// Update equipment
router.put('/:id', async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const { sim_cards: sim_cards_raw, ...body } = req.body;
    const sim_cards = normalizeSimCards(sim_cards_raw);
    const now = new Date().toISOString();
    const updates = { ...body, updated_at: now, updated_by: req.user.id };
    
    // Validate ownership type if provided
    if (updates.ownership_type && !['rental', 'sold'].includes(updates.ownership_type)) {
      return res.status(400).json({ error: 'Ownership type must be either "rental" or "sold"' });
    }
    
    // Process model_numbers if provided
    if (updates.model_numbers && Array.isArray(updates.model_numbers)) {
      updates.model_numbers = JSON.stringify(updates.model_numbers.filter(m => m && m.trim()));
    }
    
    // Validate date fields (no sim_* on equipment anymore; sim_cards validated below)
    const dateFields = [
      'installation_date', 'warranty_expiry', 'last_service_date', 'next_service_date',
      'rental_start_date', 'rental_end_date', 'amc_contract_start', 'amc_contract_end',
    ];
    const labels = { 
      installation_date: 'Installation date', 
      warranty_expiry: 'Warranty expiry', 
      last_service_date: 'Last service date', 
      next_service_date: 'Next service date',
      rental_start_date: 'Rental start date',
      rental_end_date: 'Rental end date',
      amc_contract_start: 'AMC contract start',
      amc_contract_end: 'AMC contract end',
    };
    
    for (const key of dateFields) {
      if (updates[key] !== undefined) {
        const r = validateDate(updates[key], { required: false, fieldName: labels[key] });
        if (!r.valid) return res.status(400).json({ error: r.error });
        updates[key] = r.value ?? null;
      }
    }
    
    for (const sc of sim_cards) {
      if (sc.sim_top_up_date) {
        const r = validateDate(sc.sim_top_up_date, { required: false, fieldName: 'SIM top-up date' });
        if (!r.valid) return res.status(400).json({ error: r.error });
      }
      if (sc.sim_expired_date) {
        const r = validateDate(sc.sim_expired_date, { required: false, fieldName: 'SIM expired date' });
        if (!r.valid) return res.status(400).json({ error: r.error });
      }
    }
    
    // Validate rental dates if both provided
    if (updates.rental_start_date && updates.rental_end_date) {
      if (new Date(updates.rental_end_date) <= new Date(updates.rental_start_date)) {
        return res.status(400).json({ error: 'Rental end date must be after start date' });
      }
    }
    
    // Validate AMC dates if both provided
    if (updates.amc_contract_start && updates.amc_contract_end) {
      if (new Date(updates.amc_contract_end) <= new Date(updates.amc_contract_start)) {
        return res.status(400).json({ error: 'AMC contract end date must be after start date' });
      }
    }
    
    const equipment = await update('equipment', equipmentId, updates);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    try {
      await query('DELETE FROM equipment_sim_cards WHERE equipment_id = ?', [equipmentId]);
      for (const sc of sim_cards) {
        await insert('equipment_sim_cards', {
          id: uuidv4(),
          equipment_id: equipmentId,
          sim_number: sc.sim_number,
          sim_carrier: sc.sim_carrier,
          sim_phone_number: sc.sim_phone_number,
          sim_top_up_date: sc.sim_top_up_date || null,
          sim_expired_date: sc.sim_expired_date || null,
          sim_reminder_at: sc.sim_reminder_at || null,
          sim_reminder_sent: 0,
          sort_order: sc.sort_order,
        });
      }
    } catch (err) {
      console.warn('equipment_sim_cards update skipped (table may not exist):', err?.message || err);
    }
    
    // Parse model_numbers JSON and load sim_cards for response
    let modelNumbers = [];
    try {
      if (equipment.model_numbers) {
        modelNumbers = typeof equipment.model_numbers === 'string' 
          ? JSON.parse(equipment.model_numbers) 
          : equipment.model_numbers;
      }
    } catch (e) {
      console.warn('Failed to parse model_numbers for equipment', equipment.id);
    }
    let insertedSimCards = [];
    try {
      insertedSimCards = await query('SELECT * FROM equipment_sim_cards WHERE equipment_id = ? ORDER BY sort_order, id', [equipmentId]) || [];
    } catch (_) {}
    res.json({ ...equipment, model_numbers: modelNumbers, sim_cards: insertedSimCards });
  } catch (error) {
    console.error('Update equipment error:', error);
    send500(res, 'Failed to update equipment', error);
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
    send500(res, 'Failed to toggle equipment status', error);
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
    send500(res, 'Failed to delete equipment', error);
  }
});

export { router as equipmentRoutes };
