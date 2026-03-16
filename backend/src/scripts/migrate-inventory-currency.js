import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: Inventory Currency Column ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inventory' AND COLUMN_NAME = 'currency'`,
      [process.env.DB_NAME]
    );

    if (Array.isArray(cols) && cols.length > 0) {
      console.log('  currency column already exists — skipping.');
    } else {
      await connection.execute("ALTER TABLE inventory ADD COLUMN currency VARCHAR(10) DEFAULT 'MYR' AFTER unit_price");
      console.log('  Added currency column to inventory table.');
    }
  } finally {
    await connection.end();
  }

  console.log('\n  Done.\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
