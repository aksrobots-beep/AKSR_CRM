import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const DB_NAME = process.env.DB_NAME || 'ak_crm';

async function initMySQL() {
  console.log('🔧 Initializing AK Success CRM MySQL Database...\n');

  // Connect without database first to create it
  let tempConnection = await mysql.createConnection(DB_CONFIG);

  try {
    // Create database if not exists
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ Database '${DB_NAME}' ready`);

    // Close and reconnect to the specific database
    await tempConnection.end();
    const connection = await mysql.createConnection({
      ...DB_CONFIG,
      database: DB_NAME,
    });

    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        avatar VARCHAR(500),
        can_approve TINYINT DEFAULT 0,
        is_active TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) DEFAULT NULL,
        request_email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) DEFAULT NULL,
        request_ip VARCHAR(45),
        user_agent VARCHAR(255),
        expires_at DATETIME DEFAULT NULL,
        used_at DATETIME DEFAULT NULL,
        invalidated_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_reset_token_hash (token_hash),
        INDEX idx_reset_email_created (request_email, created_at),
        INDEX idx_reset_ip_created (request_ip, created_at),
        INDEX idx_reset_user (user_id),
        INDEX idx_reset_expires (expires_at)
      )`,
      
      `CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        position VARCHAR(100),
        join_date DATE,
        salary DECIMAL(12,2) DEFAULT 0,
        annual_leave_balance INT DEFAULT 14,
        sick_leave_balance INT DEFAULT 14,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(36) PRIMARY KEY,
        client_code VARCHAR(50) DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        old_company_name VARCHAR(255) DEFAULT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Malaysia',
        postal_code VARCHAR(20),
        industry VARCHAR(100),
        assigned_to VARCHAR(36),
        total_revenue DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        is_active TINYINT DEFAULT 1,
        notes TEXT,
        latitude DECIMAL(10,8) NULL,
        longitude DECIMAL(11,8) NULL,
        geofence_radius_m INT NULL,
        geocoded_at DATETIME NULL,
        geocode_source VARCHAR(50) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS equipment (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        model VARCHAR(100),
        serial_number VARCHAR(100),
        manufacturer VARCHAR(100),
        client_id VARCHAR(36),
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'operational',
        is_active TINYINT DEFAULT 1,
        installation_date DATE,
        warranty_expiry DATE,
        last_service_date DATE,
        next_service_date DATE,
        notes TEXT,
        sim_number VARCHAR(100) NULL,
        sim_carrier VARCHAR(100) NULL,
        sim_phone_number VARCHAR(50) NULL,
        sim_top_up_date DATE NULL,
        sim_expired_date DATE NULL,
        sim_reminder_at DATETIME NULL,
        sim_reminder_sent TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS equipment_sim_cards (
        id VARCHAR(36) PRIMARY KEY,
        equipment_id VARCHAR(36) NOT NULL,
        sim_number VARCHAR(100) NULL,
        sim_carrier VARCHAR(100) NULL,
        sim_phone_number VARCHAR(50) NULL,
        sim_top_up_date DATE NULL,
        sim_expired_date DATE NULL,
        sim_reminder_at DATETIME NULL,
        sim_reminder_sent TINYINT DEFAULT 0,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
        INDEX idx_equipment_sim_reminder (equipment_id, sim_reminder_at, sim_reminder_sent)
      )`,
      
      `CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(36) PRIMARY KEY,
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'new',
        is_active TINYINT DEFAULT 1,
        is_billable TINYINT DEFAULT 1,
        client_id VARCHAR(36),
        equipment_id VARCHAR(36),
        assigned_to VARCHAR(36),
        due_date DATE,
        next_action_date DATE,
        next_action_item TEXT,
        action_taken TEXT,
        estimated_hours DECIMAL(5,2),
        actual_hours DECIMAL(5,2),
        labor_cost DECIMAL(12,2) DEFAULT 0,
        parts_cost DECIMAL(12,2) DEFAULT 0,
        total_cost DECIMAL(12,2) DEFAULT 0,
        tags JSON,
        billing_items JSON,
        billing_notes TEXT,
        support_attachments LONGTEXT,
        resolved_at DATETIME,
        closed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(36) PRIMARY KEY,
        sku VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        quantity INT DEFAULT 0,
        min_quantity INT DEFAULT 0,
        unit_price DECIMAL(12,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'MYR',
        supplier VARCHAR(255),
        location VARCHAR(255),
        compatible_equipment JSON,
        track_serial_numbers TINYINT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        is_active TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36)
      )`,

      `CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
        id VARCHAR(36) PRIMARY KEY,
        inventory_id VARCHAR(36) NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
        UNIQUE KEY unique_sn (inventory_id, serial_number)
      )`,
      
      `CREATE TABLE IF NOT EXISTS ticket_parts (
        id VARCHAR(36) PRIMARY KEY,
        ticket_id VARCHAR(36) NOT NULL,
        inventory_id VARCHAR(36) NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(12,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS stock_movements (
        id VARCHAR(36) PRIMARY KEY,
        inventory_id VARCHAR(36) NOT NULL,
        type VARCHAR(20) NOT NULL,
        quantity INT NOT NULL,
        reason TEXT,
        ticket_id VARCHAR(36),
        user_id VARCHAR(36),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(20) DEFAULT 'info',
        link VARCHAR(500),
        is_read TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notifications_user_read (user_id, is_read),
        INDEX idx_notifications_created (user_id, created_at)
      )`,

      `CREATE TABLE IF NOT EXISTS user_push_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(512) NOT NULL,
        platform VARCHAR(20) DEFAULT 'android',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_push_token (token),
        INDEX idx_push_user (user_id)
      )`,

      `CREATE TABLE IF NOT EXISTS leave_requests (
        id VARCHAR(36) PRIMARY KEY,
        employee_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INT NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        approved_by VARCHAR(36),
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(36) PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        client_id VARCHAR(36),
        ticket_id VARCHAR(36),
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        items JSON,
        subtotal DECIMAL(12,2) DEFAULT 0,
        tax DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2) DEFAULT 0,
        paid_amount DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS client_site_visits (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        client_id VARCHAR(36) NOT NULL,
        ticket_id VARCHAR(36) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        arrived_at DATETIME NOT NULL,
        departed_at DATETIME NULL,
        arrival_lat DECIMAL(10,8) NOT NULL,
        arrival_lng DECIMAL(11,8) NOT NULL,
        departure_lat DECIMAL(10,8) NULL,
        departure_lng DECIMAL(11,8) NULL,
        arrival_accuracy_m DECIMAL(10,2) NULL,
        departure_accuracy_m DECIMAL(10,2) NULL,
        checkout_outside_radius TINYINT DEFAULT 0,
        ad_hoc_site TINYINT NOT NULL DEFAULT 0,
        ad_hoc_center_lat DECIMAL(10,8) NULL,
        ad_hoc_center_lng DECIMAL(11,8) NULL,
        field_report_zip VARCHAR(512) NULL,
        field_report_manifest LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
        INDEX idx_visits_user_client_status (user_id, client_id, status),
        INDEX idx_visits_client_arrived (client_id, arrived_at)
      )`,
      
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(36) NOT NULL,
        action VARCHAR(50) NOT NULL,
        previous_value JSON,
        new_value JSON,
        user_id VARCHAR(36),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS report_definitions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        module_key VARCHAR(100) NOT NULL,
        config_json JSON NOT NULL,
        is_public TINYINT DEFAULT 0,
        owner_user_id VARCHAR(36) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS report_runs (
        id VARCHAR(36) PRIMARY KEY,
        report_definition_id VARCHAR(36) DEFAULT NULL,
        requested_by VARCHAR(36) DEFAULT NULL,
        module_key VARCHAR(100) NOT NULL,
        format VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'completed',
        row_count INT DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_definition_id) REFERENCES report_definitions(id) ON DELETE SET NULL,
        FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS report_column_policies (
        id VARCHAR(36) PRIMARY KEY,
        module_key VARCHAR(100) NOT NULL,
        column_name VARCHAR(100) NOT NULL,
        allowed_roles_json JSON,
        is_blocked TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_report_col_policy (module_key, column_name)
      )`,
      
      `CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        contact VARCHAR(255),
        email VARCHAR(255),
        whatsapp VARCHAR(50),
        wechat VARCHAR(50),
        lark VARCHAR(255),
        group_link VARCHAR(500),
        qr_code TEXT,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'active',
        is_active TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36)
      )`,
    ];

    for (const sql of tables) {
      await connection.execute(sql);
    }
    console.log('✓ All tables created');

    // Check if users already exist
    const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 0) {
      console.log('\n⚠️  Database already has data. Skipping seed data.');
      console.log('   To reset, drop the database and run init again.');
    } else {
      // Insert seed data
      console.log('\n📦 Inserting seed data...');
      
      const seedPassword = process.env.SEED_PASSWORD;
      if (!seedPassword) {
        console.error('\n❌ Missing SEED_PASSWORD in environment.');
        console.error('   Example: SEED_PASSWORD=yourPassword node src/db/init-mysql.js');
        process.exit(1);
      }
      const hashedPassword = bcrypt.hashSync(seedPassword, 10);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // Users
      const users = [
        { id: uuidv4(), email: 'ceo@aksuccess.com', password: hashedPassword, name: 'Ahmad Khalid', role: 'ceo', department: 'Executive', can_approve: 1 },
        { id: uuidv4(), email: 'admin@aksuccess.com', password: hashedPassword, name: 'Sarah Tan', role: 'admin', department: 'Operations', can_approve: 1 },
        { id: uuidv4(), email: 'manager@aksuccess.com', password: hashedPassword, name: 'David Wong', role: 'service_manager', department: 'Service', can_approve: 0 },
        { id: uuidv4(), email: 'tech@aksuccess.com', password: hashedPassword, name: 'Rajan Kumar', role: 'technician', department: 'Service', can_approve: 0 },
        { id: uuidv4(), email: 'hr@aksuccess.com', password: hashedPassword, name: 'Lisa Chen', role: 'hr_manager', department: 'HR', can_approve: 1 },
        { id: uuidv4(), email: 'finance@aksuccess.com', password: hashedPassword, name: 'Michael Lee', role: 'finance', department: 'Finance', can_approve: 1 },
      ];

      for (const user of users) {
        await connection.execute(
          'INSERT INTO users (id, email, password, name, role, department, can_approve, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
          [user.id, user.email, user.password, user.name, user.role, user.department, user.can_approve, now]
        );
      }
      console.log('✓ Users created');

      const managerId = users.find(u => u.email === 'manager@aksuccess.com').id;
      const techId = users.find(u => u.email === 'tech@aksuccess.com').id;
      const adminId = users.find(u => u.email === 'admin@aksuccess.com').id;

      // Clients
      const clients = [
        { id: uuidv4(), name: 'Lim Wei Ming', company_name: 'Golden Dragon Restaurant', email: 'weiming@goldendragon.com.my', phone: '+60 12-345 6789', address: '123 Jalan Bukit Bintang', city: 'Kuala Lumpur', state: 'WP Kuala Lumpur', industry: 'F&B - Restaurant', assigned_to: managerId },
        { id: uuidv4(), name: 'Tan Siew Ling', company_name: 'Ocean Breeze Hotel', email: 'siewling@oceanbreeze.com.my', phone: '+60 16-789 0123', address: '456 Jalan Pantai', city: 'Penang', state: 'Penang', industry: 'Hospitality - Hotel', assigned_to: managerId },
        { id: uuidv4(), name: 'Ahmad Razak', company_name: 'Spice Garden Catering', email: 'razak@spicegarden.com.my', phone: '+60 19-456 7890', address: '789 Jalan Sultan Ismail', city: 'Johor Bahru', state: 'Johor', industry: 'F&B - Catering', assigned_to: techId },
        { id: uuidv4(), name: 'Chen Mei Hua', company_name: 'Sunrise Bakery Chain', email: 'meihua@sunrisebakery.com.my', phone: '+60 17-234 5678', address: '321 Jalan Ampang', city: 'Kuala Lumpur', state: 'WP Kuala Lumpur', industry: 'F&B - Bakery', assigned_to: managerId },
      ];

      for (const client of clients) {
        await connection.execute(
          'INSERT INTO clients (id, name, company_name, email, phone, address, city, state, country, industry, assigned_to, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [client.id, client.name, client.company_name, client.email, client.phone, client.address, client.city, client.state, 'Malaysia', client.industry, client.assigned_to, 'active', now, adminId]
        );
      }
      console.log('✓ Clients created');

      // Equipment
      const equipment = [
        { id: uuidv4(), name: 'Commercial Dishwasher Pro-500', type: 'kitchen', model: 'DW-PRO-500', serial_number: 'DW2023001234', manufacturer: 'KitchenMaster', client_id: clients[0].id, location: 'Main Kitchen - Station A', status: 'operational' },
        { id: uuidv4(), name: 'Service Robot R-200', type: 'robot', model: 'SERV-R200', serial_number: 'SR2023005678', manufacturer: 'RoboServe', client_id: clients[0].id, location: 'Main Dining Hall', status: 'operational' },
        { id: uuidv4(), name: 'Industrial Oven IX-1000', type: 'kitchen', model: 'IX-1000', serial_number: 'IO2022009876', manufacturer: 'IndustrialChef', client_id: clients[1].id, location: 'Hotel Kitchen - Baking Section', status: 'maintenance_required' },
        { id: uuidv4(), name: 'Delivery Robot D-100', type: 'robot', model: 'DEL-D100', serial_number: 'DR2023003456', manufacturer: 'RoboServe', client_id: clients[1].id, location: 'Hotel Lobby - Floor 1', status: 'operational' },
      ];

      for (const eq of equipment) {
        await connection.execute(
          'INSERT INTO equipment (id, name, type, model, serial_number, manufacturer, client_id, location, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [eq.id, eq.name, eq.type, eq.model, eq.serial_number, eq.manufacturer, eq.client_id, eq.location, eq.status, now, adminId]
        );
      }
      console.log('✓ Equipment created');

      // Inventory
      const inventory = [
        { id: uuidv4(), sku: 'SPR-TS-001', name: 'Temperature Sensor - Universal', category: 'spare_parts', quantity: 15, min_quantity: 5, unit_price: 85, supplier: 'TechParts Sdn Bhd', location: 'Warehouse A - Shelf 3' },
        { id: uuidv4(), sku: 'SPR-HE-002', name: 'Heating Element - Dishwasher', category: 'spare_parts', quantity: 8, min_quantity: 3, unit_price: 120, supplier: 'KitchenMaster Parts', location: 'Warehouse A - Shelf 5' },
        { id: uuidv4(), sku: 'SPR-MT-003', name: 'Industrial Mixer Motor', category: 'spare_parts', quantity: 3, min_quantity: 2, unit_price: 450, supplier: 'MotorWorks Malaysia', location: 'Warehouse B - Heavy Parts' },
        { id: uuidv4(), sku: 'ROB-SEN-001', name: 'LIDAR Sensor Module', category: 'components', quantity: 6, min_quantity: 2, unit_price: 350, supplier: 'RoboServe Parts', location: 'Warehouse A - Electronics' },
        { id: uuidv4(), sku: 'CON-LUB-001', name: 'Food-Grade Lubricant', category: 'consumables', quantity: 25, min_quantity: 10, unit_price: 28, supplier: 'SafeLube Industries', location: 'Warehouse A - Consumables' },
      ];

      for (const item of inventory) {
        await connection.execute(
          'INSERT INTO inventory (id, sku, name, category, quantity, min_quantity, unit_price, supplier, location, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.id, item.sku, item.name, item.category, item.quantity, item.min_quantity, item.unit_price, item.supplier, item.location, 'active', now, adminId]
        );
      }
      console.log('✓ Inventory created');

      // Tickets
      const tickets = [
        { id: uuidv4(), ticket_number: 'TKT-2024-0001', title: 'Dishwasher not heating properly', priority: 'high', status: 'in_progress', client_id: clients[0].id, equipment_id: equipment[0].id, assigned_to: techId },
        { id: uuidv4(), ticket_number: 'TKT-2024-0002', title: 'Robot navigation calibration', priority: 'medium', status: 'assigned', client_id: clients[0].id, equipment_id: equipment[1].id, assigned_to: techId },
        { id: uuidv4(), ticket_number: 'TKT-2024-0003', title: 'Industrial oven temperature sensor replacement', priority: 'critical', status: 'pending_parts', client_id: clients[1].id, equipment_id: equipment[2].id, assigned_to: techId },
        { id: uuidv4(), ticket_number: 'TKT-2024-0004', title: 'Preventive maintenance - Delivery Robot', priority: 'low', status: 'new', client_id: clients[1].id, equipment_id: equipment[3].id },
      ];

      for (const ticket of tickets) {
        await connection.execute(
          'INSERT INTO tickets (id, ticket_number, title, priority, status, client_id, equipment_id, assigned_to, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [ticket.id, ticket.ticket_number, ticket.title, ticket.priority, ticket.status, ticket.client_id, ticket.equipment_id, ticket.assigned_to || null, now, managerId]
        );
      }
      console.log('✓ Tickets created');

      console.log('\n✅ Database initialized successfully!');
    }

    console.log('\nSeed accounts created:');
    console.log('  - ceo@aksuccess.com (CEO)');
    console.log('  - admin@aksuccess.com (Admin)');
    console.log('  - manager@aksuccess.com (Service Manager)');
    console.log('  - tech@aksuccess.com (Technician)');
    console.log('  - hr@aksuccess.com (HR Manager)');
    console.log('  - finance@aksuccess.com (Finance)');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

initMySQL().catch(console.error);
