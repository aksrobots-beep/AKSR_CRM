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

async function createSuppliersTable() {
  console.log('🔧 Creating suppliers table...\n');

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS suppliers (
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
      )
    `);
    
    console.log('✅ Suppliers table created\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createSuppliersTable().catch(console.error);
