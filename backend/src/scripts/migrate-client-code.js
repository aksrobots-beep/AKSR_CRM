/**
 * Migration: Add client_code column to clients table.
 * Usage: node src/scripts/migrate-client-code.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: Add client_code to clients ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'client_code'`,
      [process.env.DB_NAME]
    );

    if (Array.isArray(cols) && cols.length > 0) {
      console.log('  client_code column already exists — skipping.\n');
    } else {
      await connection.execute('ALTER TABLE clients ADD COLUMN client_code VARCHAR(50) DEFAULT NULL AFTER id');
      console.log('  ✓ Added client_code column to clients table.\n');
    }
  } finally {
    await connection.end();
  }

  console.log('  Done.\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
