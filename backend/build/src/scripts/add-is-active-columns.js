import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ak_crm',
};

async function addIsActiveColumns() {
  console.log('🔧 Adding is_active columns to tables...\n');

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    const tables = [
      { name: 'clients', hasStatus: true },
      { name: 'equipment', hasStatus: true },
      { name: 'tickets', hasStatus: true },
      { name: 'inventory', hasStatus: true },
      { name: 'suppliers', hasStatus: true },
    ];

    for (const table of tables) {
      try {
        // Check if column exists
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'is_active'`,
          [DB_CONFIG.database, table.name]
        );

        if (columns.length === 0) {
          // Add is_active column - set to 1 if status is active, 0 otherwise
          await connection.execute(
            `ALTER TABLE \`${table.name}\` ADD COLUMN is_active TINYINT DEFAULT 1 AFTER status`
          );
          
          // Migrate existing data: set is_active based on status
          if (table.hasStatus) {
            await connection.execute(
              `UPDATE \`${table.name}\` SET is_active = CASE 
                WHEN status IN ('active', 'operational', 'new', 'assigned', 'in_progress') THEN 1 
                ELSE 0 
               END`
            );
          }
          
          console.log(`✅ Added is_active to ${table.name}`);
        } else {
          console.log(`⚠️  ${table.name} already has is_active column`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${table.name}:`, error.message);
      }
    }

    console.log('\n✅ Migration complete!\n');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

addIsActiveColumns().catch(console.error);
