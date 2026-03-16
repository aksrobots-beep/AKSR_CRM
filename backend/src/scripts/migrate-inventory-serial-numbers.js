/**
 * Migration: Add serial number tracking to inventory.
 * Usage: node src/scripts/migrate-inventory-serial-numbers.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: Inventory Serial Numbers ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inventory' AND COLUMN_NAME = 'track_serial_numbers'`,
      [process.env.DB_NAME]
    );

    if (Array.isArray(cols) && cols.length > 0) {
      console.log('  track_serial_numbers column already exists — skipping.');
    } else {
      await connection.execute('ALTER TABLE inventory ADD COLUMN track_serial_numbers TINYINT DEFAULT 0 AFTER compatible_equipment');
      console.log('  ✓ Added track_serial_numbers column to inventory table.');
    }

    await connection.execute(`CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
      id VARCHAR(36) PRIMARY KEY,
      inventory_id VARCHAR(36) NOT NULL,
      serial_number VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'available',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(36),
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
      UNIQUE KEY unique_sn (inventory_id, serial_number)
    )`);
    console.log('  ✓ inventory_serial_numbers table ready.');

  } finally {
    await connection.end();
  }

  console.log('\n  Done.\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
