import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initializeData } from './database.js';

console.log('🔧 Initializing AK Success CRM Database...\n');

const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword) {
  console.error('❌ Missing SEED_PASSWORD in environment.');
  console.error('   Example: SEED_PASSWORD=yourPassword node src/db/init.js');
  process.exit(1);
}
const hashedPassword = bcrypt.hashSync(seedPassword, 10);

// Create users (password from SEED_PASSWORD)
const users = [
  { id: uuidv4(), email: 'ceo@aksuccess.com', password: hashedPassword, name: 'Ahmad Khalid', role: 'ceo', department: 'Executive', can_approve: 1, is_active: 1, created_at: new Date().toISOString() },
  { id: uuidv4(), email: 'admin@aksuccess.com', password: hashedPassword, name: 'Sarah Tan', role: 'admin', department: 'Operations', can_approve: 1, is_active: 1, created_at: new Date().toISOString() },
  { id: uuidv4(), email: 'admin@aksuccess.com.my', password: hashedPassword, name: 'Admin', role: 'admin', department: 'Operations', can_approve: 1, is_active: 1, created_at: new Date().toISOString() },
  { id: uuidv4(), email: 'manager@aksuccess.com', password: hashedPassword, name: 'David Wong', role: 'service_manager', department: 'Service', can_approve: 0, is_active: 1, created_at: new Date().toISOString() },
  { id: uuidv4(), email: 'tech@aksuccess.com', password: hashedPassword, name: 'Rajan Kumar', role: 'technician', department: 'Service', can_approve: 0, is_active: 1, created_at: new Date().toISOString() },
  { id: uuidv4(), email: 'hr@aksuccess.com', password: hashedPassword, name: 'Lisa Chen', role: 'hr_manager', department: 'HR', can_approve: 1, is_active: 1, created_at: new Date().toISOString() },
  { id: uuidv4(), email: 'finance@aksuccess.com', password: hashedPassword, name: 'Michael Lee', role: 'finance', department: 'Finance', can_approve: 1, is_active: 1, created_at: new Date().toISOString() },
];

const managerId = users.find(u => u.email === 'manager@aksuccess.com').id;
const techId = users.find(u => u.email === 'tech@aksuccess.com').id;
const adminId = users.find(u => u.email === 'admin@aksuccess.com').id;

// Create clients
const clients = [
  { id: uuidv4(), name: 'Lim Wei Ming', company_name: 'Golden Dragon Restaurant', email: 'weiming@goldendragon.com.my', phone: '+60 12-345 6789', address: '123 Jalan Bukit Bintang', city: 'Kuala Lumpur', state: 'WP Kuala Lumpur', country: 'Malaysia', postal_code: '55100', industry: 'F&B - Restaurant', assigned_to: managerId, total_revenue: 125000, status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), name: 'Tan Siew Ling', company_name: 'Ocean Breeze Hotel', email: 'siewling@oceanbreeze.com.my', phone: '+60 16-789 0123', address: '456 Jalan Pantai', city: 'Penang', state: 'Penang', country: 'Malaysia', postal_code: '10100', industry: 'Hospitality - Hotel', assigned_to: managerId, total_revenue: 89000, status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), name: 'Ahmad Razak', company_name: 'Spice Garden Catering', email: 'razak@spicegarden.com.my', phone: '+60 19-456 7890', address: '789 Jalan Sultan Ismail', city: 'Johor Bahru', state: 'Johor', country: 'Malaysia', postal_code: '80000', industry: 'F&B - Catering', assigned_to: techId, total_revenue: 45000, status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), name: 'Chen Mei Hua', company_name: 'Sunrise Bakery Chain', email: 'meihua@sunrisebakery.com.my', phone: '+60 17-234 5678', address: '321 Jalan Ampang', city: 'Kuala Lumpur', state: 'WP Kuala Lumpur', country: 'Malaysia', postal_code: '50450', industry: 'F&B - Bakery', assigned_to: managerId, total_revenue: 156000, status: 'active', created_at: new Date().toISOString(), created_by: adminId },
];

// Create equipment
const equipment = [
  { id: uuidv4(), name: 'Commercial Dishwasher Pro-500', type: 'kitchen', model: 'DW-PRO-500', serial_number: 'DW2023001234', manufacturer: 'KitchenMaster', client_id: clients[0].id, location: 'Main Kitchen - Station A', status: 'operational', installation_date: '2023-02-15', warranty_expiry: '2025-02-15', last_service_date: '2024-01-05', next_service_date: '2024-04-05', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), name: 'Service Robot R-200', type: 'robot', model: 'SERV-R200', serial_number: 'SR2023005678', manufacturer: 'RoboServe', client_id: clients[0].id, location: 'Main Dining Hall', status: 'operational', installation_date: '2023-06-01', warranty_expiry: '2025-06-01', last_service_date: '2024-01-08', next_service_date: '2024-02-08', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), name: 'Industrial Oven IX-1000', type: 'kitchen', model: 'IX-1000', serial_number: 'IO2022009876', manufacturer: 'IndustrialChef', client_id: clients[1].id, location: 'Hotel Kitchen - Baking Section', status: 'maintenance_required', installation_date: '2022-08-20', warranty_expiry: '2024-08-20', last_service_date: '2023-12-15', next_service_date: '2024-03-15', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), name: 'Delivery Robot D-100', type: 'robot', model: 'DEL-D100', serial_number: 'DR2023003456', manufacturer: 'RoboServe', client_id: clients[1].id, location: 'Hotel Lobby - Floor 1', status: 'operational', installation_date: '2023-09-10', warranty_expiry: '2025-09-10', last_service_date: '2024-01-02', next_service_date: '2024-02-02', created_at: new Date().toISOString(), created_by: adminId },
];

// Create tickets
const tickets = [
  { id: uuidv4(), ticket_number: 'TKT-2024-0001', title: 'Dishwasher not heating properly', description: 'Customer reports water temperature not reaching optimal levels. Needs inspection.', priority: 'high', status: 'in_progress', client_id: clients[0].id, equipment_id: equipment[0].id, assigned_to: techId, due_date: '2024-01-15', estimated_hours: 3, tags: JSON.stringify(['urgent', 'kitchen-equipment']), labor_cost: 0, parts_cost: 0, total_cost: 0, created_at: new Date().toISOString(), created_by: managerId },
  { id: uuidv4(), ticket_number: 'TKT-2024-0002', title: 'Robot navigation calibration', description: 'Service robot occasionally bumps into tables. Requires sensor recalibration.', priority: 'medium', status: 'assigned', client_id: clients[0].id, equipment_id: equipment[1].id, assigned_to: techId, due_date: '2024-01-18', estimated_hours: 2, tags: JSON.stringify(['robot', 'calibration']), labor_cost: 0, parts_cost: 0, total_cost: 0, created_at: new Date().toISOString(), created_by: managerId },
  { id: uuidv4(), ticket_number: 'TKT-2024-0003', title: 'Industrial oven temperature sensor replacement', description: 'Temperature sensor showing erratic readings. Replacement required.', priority: 'critical', status: 'pending_parts', client_id: clients[1].id, equipment_id: equipment[2].id, assigned_to: techId, due_date: '2024-01-14', estimated_hours: 4, tags: JSON.stringify(['urgent', 'kitchen-equipment', 'parts-required']), labor_cost: 0, parts_cost: 0, total_cost: 0, created_at: new Date().toISOString(), created_by: managerId },
  { id: uuidv4(), ticket_number: 'TKT-2024-0004', title: 'Preventive maintenance - Delivery Robot', description: 'Scheduled quarterly maintenance for delivery robot.', priority: 'low', status: 'new', client_id: clients[1].id, equipment_id: equipment[3].id, due_date: '2024-01-25', estimated_hours: 2, tags: JSON.stringify(['preventive', 'robot', 'scheduled']), labor_cost: 0, parts_cost: 0, total_cost: 0, created_at: new Date().toISOString(), created_by: managerId },
  { id: uuidv4(), ticket_number: 'TKT-2024-0005', title: 'Commercial freezer compressor noise', description: 'Unusual noise from compressor unit. Customer concerned about potential failure.', priority: 'high', status: 'new', client_id: clients[2].id, due_date: '2024-01-16', estimated_hours: 3, tags: JSON.stringify(['kitchen-equipment', 'inspection']), labor_cost: 0, parts_cost: 0, total_cost: 0, created_at: new Date().toISOString(), created_by: managerId },
  { id: uuidv4(), ticket_number: 'TKT-2023-0089', title: 'Mixer motor replacement', description: 'Industrial mixer motor burnt out. Replaced with new motor.', priority: 'high', status: 'resolved', client_id: clients[3].id, resolved_at: '2024-01-08', estimated_hours: 4, actual_hours: 5, tags: JSON.stringify(['kitchen-equipment', 'motor-replacement']), labor_cost: 250, parts_cost: 450, total_cost: 700, created_at: '2024-01-05', created_by: managerId },
];

// Create inventory
const inventory = [
  { id: uuidv4(), sku: 'SPR-TS-001', name: 'Temperature Sensor - Universal', description: 'Universal temperature sensor for industrial ovens', category: 'spare_parts', quantity: 15, min_quantity: 5, unit_price: 85, supplier: 'TechParts Sdn Bhd', location: 'Warehouse A - Shelf 3', compatible_equipment: JSON.stringify(['IX-1000', 'IX-2000', 'DW-PRO-500']), status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), sku: 'SPR-HE-002', name: 'Heating Element - Dishwasher', description: 'Replacement heating element for commercial dishwashers', category: 'spare_parts', quantity: 8, min_quantity: 3, unit_price: 120, supplier: 'KitchenMaster Parts', location: 'Warehouse A - Shelf 5', compatible_equipment: JSON.stringify(['DW-PRO-500', 'DW-PRO-700']), status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), sku: 'SPR-MT-003', name: 'Industrial Mixer Motor', description: 'Heavy-duty motor for industrial mixers', category: 'spare_parts', quantity: 3, min_quantity: 2, unit_price: 450, supplier: 'MotorWorks Malaysia', location: 'Warehouse B - Heavy Parts', compatible_equipment: JSON.stringify(['MIX-500', 'MIX-700', 'MIX-1000']), status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), sku: 'ROB-SEN-001', name: 'LIDAR Sensor Module', description: 'Navigation sensor for service robots', category: 'components', quantity: 6, min_quantity: 2, unit_price: 350, supplier: 'RoboServe Parts', location: 'Warehouse A - Electronics', compatible_equipment: JSON.stringify(['SERV-R200', 'DEL-D100']), status: 'active', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), sku: 'CON-LUB-001', name: 'Food-Grade Lubricant', description: 'FDA approved lubricant for kitchen equipment', category: 'consumables', quantity: 25, min_quantity: 10, unit_price: 28, supplier: 'SafeLube Industries', location: 'Warehouse A - Consumables', compatible_equipment: JSON.stringify([]), status: 'active', created_at: new Date().toISOString(), created_by: adminId },
];

// Create leave requests
const leave_requests = [
  { id: uuidv4(), employee_id: techId, type: 'annual', start_date: '2024-01-20', end_date: '2024-01-22', days: 3, reason: 'Family vacation', status: 'pending', created_at: new Date().toISOString() },
  { id: uuidv4(), employee_id: managerId, type: 'sick', start_date: '2024-01-08', end_date: '2024-01-08', days: 1, reason: 'Medical appointment', status: 'approved', approved_by: adminId, created_at: new Date().toISOString() },
];

// Create invoices
const invoices = [
  { id: uuidv4(), invoice_number: 'INV-2024-0001', client_id: clients[3].id, issue_date: '2024-01-08', due_date: '2024-02-08', items: JSON.stringify([{ description: 'Labor - Motor Replacement (5 hours)', quantity: 5, unitPrice: 50, total: 250 }, { description: 'Industrial Mixer Motor', quantity: 1, unitPrice: 450, total: 450 }]), subtotal: 700, tax: 42, total: 742, paid_amount: 0, status: 'sent', created_at: new Date().toISOString(), created_by: adminId },
  { id: uuidv4(), invoice_number: 'INV-2024-0002', client_id: clients[0].id, issue_date: '2024-01-05', due_date: '2024-02-05', items: JSON.stringify([{ description: 'Quarterly Maintenance - Dishwasher', quantity: 1, unitPrice: 200, total: 200 }, { description: 'Quarterly Maintenance - Service Robot', quantity: 1, unitPrice: 300, total: 300 }]), subtotal: 500, tax: 30, total: 530, paid_amount: 530, status: 'paid', created_at: new Date().toISOString(), created_by: adminId },
];

// Initialize database with all data
await initializeData({
  users,
  clients,
  equipment,
  tickets,
  inventory,
  leave_requests,
  invoices,
  audit_logs: [],
  ticket_parts: [],
  stock_movements: [],
  employees: [],
});

console.log('✅ Database initialized successfully!\n');
console.log('Seed accounts created:');
users.forEach(u => console.log(`  - ${u.email} (${u.role})`));
console.log('\n🎉 Ready to start the server with: npm run dev');
