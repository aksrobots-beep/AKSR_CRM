import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function migrateEquipmentSim() {
  let connection;

  try {
    console.log('🔄 Starting equipment SIM card fields migration...\n');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'aksucce2_akcrm',
    });

    console.log('✅ Connected to database:', process.env.DB_NAME);

    const cols = [
      { name: 'sim_number', after: 'notes', sql: 'VARCHAR(100) NULL' },
      { name: 'sim_carrier', after: 'sim_number', sql: 'VARCHAR(100) NULL' },
      { name: 'sim_phone_number', after: 'sim_carrier', sql: 'VARCHAR(50) NULL' },
      { name: 'sim_top_up_date', after: 'sim_phone_number', sql: 'DATE NULL' },
      { name: 'sim_expired_date', after: 'sim_top_up_date', sql: 'DATE NULL' },
      { name: 'sim_reminder_at', after: 'sim_expired_date', sql: 'DATETIME NULL' },
      { name: 'sim_reminder_sent', after: 'sim_reminder_at', sql: 'TINYINT DEFAULT 0' },
    ];

    for (const col of cols) {
      const [rows] = await connection.query(`SHOW COLUMNS FROM equipment LIKE ?`, [col.name]);
      if (rows.length > 0) {
        console.log(`   ⏭️  ${col.name} already exists`);
        continue;
      }
      await connection.query(
        `ALTER TABLE equipment ADD COLUMN \`${col.name}\` ${col.sql} AFTER \`${col.after}\``
      );
      console.log(`   ✓ Added ${col.name}`);
    }

    console.log('\n✅ Equipment SIM migration completed.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

migrateEquipmentSim()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
