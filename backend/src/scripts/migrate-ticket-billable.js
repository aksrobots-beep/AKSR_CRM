import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function migrateTicketBillable() {
  let connection;

  try {
    console.log('Starting tickets is_billable migration...\n');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'aksucce2_akcrm',
    });

    console.log('Connected to database:', process.env.DB_NAME);

    const [rows] = await connection.query(`SHOW COLUMNS FROM tickets LIKE 'is_billable'`);
    if (rows.length > 0) {
      console.log('   is_billable already exists, skip.');
    } else {
      await connection.query(
        `ALTER TABLE tickets ADD COLUMN is_billable TINYINT DEFAULT 1 AFTER is_active`
      );
      console.log('   Added is_billable');
    }

    console.log('\nTicket billable migration completed.');
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

migrateTicketBillable()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
