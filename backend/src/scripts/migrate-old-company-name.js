import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: Old Company Name (clients) ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'old_company_name'`,
      [process.env.DB_NAME]
    );

    if (Array.isArray(cols) && cols.length > 0) {
      console.log('  old_company_name column already exists — skipping.');
    } else {
      await connection.execute(
        "ALTER TABLE clients ADD COLUMN old_company_name VARCHAR(255) DEFAULT NULL AFTER company_name"
      );
      console.log('  Added old_company_name column to clients table.');
    }
  } finally {
    await connection.end();
  }

  console.log('\n  Done.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
