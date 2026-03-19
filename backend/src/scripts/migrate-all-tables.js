/**
 * Ensures all required tables exist in the production DB.
 * Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS).
 * Run: cd backend && node src/scripts/migrate-all-tables.js
 */
import '../load-env.js';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: ensure all tables ---\n');
  console.log('DB:', process.env.DB_HOST, '/', process.env.DB_NAME);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const tables = [
    {
      name: 'password_reset_tokens',
      sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
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
    },
    {
      name: 'employees',
      sql: `CREATE TABLE IF NOT EXISTS employees (
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
    },
    {
      name: 'equipment_sim_cards',
      sql: `CREATE TABLE IF NOT EXISTS equipment_sim_cards (
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
    },
    {
      name: 'inventory_serial_numbers',
      sql: `CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
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
    },
    {
      name: 'ticket_parts',
      sql: `CREATE TABLE IF NOT EXISTS ticket_parts (
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
    },
    {
      name: 'stock_movements',
      sql: `CREATE TABLE IF NOT EXISTS stock_movements (
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
    },
    {
      name: 'notifications',
      sql: `CREATE TABLE IF NOT EXISTS notifications (
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
    },
    {
      name: 'leave_requests',
      sql: `CREATE TABLE IF NOT EXISTS leave_requests (
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
    },
    {
      name: 'invoices',
      sql: `CREATE TABLE IF NOT EXISTS invoices (
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
    },
    {
      name: 'audit_logs',
      sql: `CREATE TABLE IF NOT EXISTS audit_logs (
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
    },
    {
      name: 'report_definitions',
      sql: `CREATE TABLE IF NOT EXISTS report_definitions (
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
    },
    {
      name: 'report_runs',
      sql: `CREATE TABLE IF NOT EXISTS report_runs (
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
    },
    {
      name: 'report_column_policies',
      sql: `CREATE TABLE IF NOT EXISTS report_column_policies (
        id VARCHAR(36) PRIMARY KEY,
        module_key VARCHAR(100) NOT NULL,
        column_name VARCHAR(100) NOT NULL,
        allowed_roles_json JSON,
        is_blocked TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_report_col_policy (module_key, column_name)
      )`,
    },
    {
      name: 'suppliers',
      sql: `CREATE TABLE IF NOT EXISTS suppliers (
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
    },
  ];

  try {
    for (const t of tables) {
      try {
        await connection.execute(t.sql);
        console.log(`  OK  ${t.name}`);
      } catch (err) {
        console.error(`  ERR ${t.name}: ${err.message}`);
      }
    }

    // Column migrations (safe — skips if column already exists)
    const columnMigrations = [
      { table: 'tickets', column: 'is_billable', sql: 'ALTER TABLE tickets ADD COLUMN is_billable TINYINT DEFAULT 1' },
      { table: 'tickets', column: 'resolved_at', sql: 'ALTER TABLE tickets ADD COLUMN resolved_at DATETIME NULL' },
      { table: 'tickets', column: 'closed_at', sql: 'ALTER TABLE tickets ADD COLUMN closed_at DATETIME NULL' },
      { table: 'tickets', column: 'total_cost', sql: 'ALTER TABLE tickets ADD COLUMN total_cost DECIMAL(12,2) DEFAULT 0' },
      { table: 'equipment', column: 'sim_number', sql: 'ALTER TABLE equipment ADD COLUMN sim_number VARCHAR(100) NULL' },
      { table: 'equipment', column: 'sim_carrier', sql: 'ALTER TABLE equipment ADD COLUMN sim_carrier VARCHAR(100) NULL' },
      { table: 'equipment', column: 'sim_phone_number', sql: 'ALTER TABLE equipment ADD COLUMN sim_phone_number VARCHAR(50) NULL' },
      { table: 'equipment', column: 'sim_top_up_date', sql: 'ALTER TABLE equipment ADD COLUMN sim_top_up_date DATE NULL' },
      { table: 'equipment', column: 'sim_expired_date', sql: 'ALTER TABLE equipment ADD COLUMN sim_expired_date DATE NULL' },
      { table: 'equipment', column: 'sim_reminder_at', sql: 'ALTER TABLE equipment ADD COLUMN sim_reminder_at DATETIME NULL' },
      { table: 'equipment', column: 'sim_reminder_sent', sql: 'ALTER TABLE equipment ADD COLUMN sim_reminder_sent TINYINT DEFAULT 0' },
      { table: 'inventory', column: 'currency', sql: "ALTER TABLE inventory ADD COLUMN currency VARCHAR(10) DEFAULT 'MYR'" },
      { table: 'inventory', column: 'track_serial_numbers', sql: 'ALTER TABLE inventory ADD COLUMN track_serial_numbers TINYINT DEFAULT 0' },
      { table: 'clients', column: 'client_code', sql: 'ALTER TABLE clients ADD COLUMN client_code VARCHAR(50) DEFAULT NULL' },
      { table: 'clients', column: 'old_company_name', sql: 'ALTER TABLE clients ADD COLUMN old_company_name VARCHAR(255) DEFAULT NULL' },
    ];

    console.log('\n--- Column migrations ---\n');
    for (const m of columnMigrations) {
      try {
        const [cols] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [process.env.DB_NAME, m.table, m.column]
        );
        if (cols.length === 0) {
          await connection.execute(m.sql);
          console.log(`  ADD ${m.table}.${m.column}`);
        } else {
          console.log(`  OK  ${m.table}.${m.column} (exists)`);
        }
      } catch (err) {
        console.error(`  ERR ${m.table}.${m.column}: ${err.message}`);
      }
    }
  } finally {
    await connection.end();
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
