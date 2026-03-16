import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function migrateEquipmentSimCardsTable() {
  let connection;

  try {
    console.log('🔄 Creating equipment_sim_cards table and migrating data...\n');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'aksucce2_akcrm',
    });

    console.log('✅ Connected to database:', process.env.DB_NAME);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS equipment_sim_cards (
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
      )
    `);
    console.log('   ✓ equipment_sim_cards table ready');

    const [cols] = await connection.query(`SHOW COLUMNS FROM equipment LIKE 'sim_number'`);
    if (cols.length === 0) {
      console.log('   ⏭️  equipment has no sim_number column, skip data migration');
    } else {
      const [rows] = await connection.query(`
        SELECT id, sim_number, sim_carrier, sim_phone_number, sim_top_up_date, sim_expired_date, sim_reminder_at, sim_reminder_sent
        FROM equipment
        WHERE sim_number IS NOT NULL OR sim_carrier IS NOT NULL OR sim_phone_number IS NOT NULL
           OR sim_top_up_date IS NOT NULL OR sim_expired_date IS NOT NULL OR sim_reminder_at IS NOT NULL
      `);
      for (const row of rows || []) {
        const [existing] = await connection.query('SELECT id FROM equipment_sim_cards WHERE equipment_id = ? LIMIT 1', [row.id]);
        if (existing.length > 0) continue;
        const id = uuidv4();
        await connection.query(
          `INSERT INTO equipment_sim_cards (id, equipment_id, sim_number, sim_carrier, sim_phone_number, sim_top_up_date, sim_expired_date, sim_reminder_at, sim_reminder_sent, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [id, row.id, row.sim_number || null, row.sim_carrier || null, row.sim_phone_number || null, row.sim_top_up_date || null, row.sim_expired_date || null, row.sim_reminder_at || null, row.sim_reminder_sent ?? 0]
        );
        console.log(`   ✓ Migrated 1 SIM card for equipment ${row.id}`);
      }
      if (!rows || rows.length === 0) console.log('   ⏭️  No equipment with SIM data to migrate');
    }

    console.log('\n✅ Equipment SIM cards table migration completed.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

migrateEquipmentSimCardsTable()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
