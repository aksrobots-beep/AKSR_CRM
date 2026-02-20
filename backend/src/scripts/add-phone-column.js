import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addPhoneColumn() {
  let connection;
  
  try {
    console.log('🔄 Starting phone column migration...\n');
    
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'aksucce2_crm'
    });
    
    console.log(`✅ Connected to database: ${process.env.DB_NAME || 'aksucce2_crm'}\n`);
    
    // Check if phone column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'phone'
    `, [process.env.DB_NAME || 'aksucce2_crm']);
    
    if (columns.length > 0) {
      console.log('ℹ️  Phone column already exists in users table');
      console.log('✅ Migration not needed\n');
      return;
    }
    
    console.log('📋 Adding phone column to users table...');
    
    // Add phone column after name
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN phone VARCHAR(20) AFTER name
    `);
    
    console.log('   ✓ Added phone column\n');
    
    console.log('📋 Verifying migration...');
    const [verify] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'phone'
    `, [process.env.DB_NAME || 'aksucce2_crm']);
    
    if (verify.length > 0) {
      console.log('   ✓ Phone column exists:', verify[0].COLUMN_TYPE);
    }
    
    console.log('\n✅ Migration completed successfully!\n');
    
    console.log('📝 Notes:');
    console.log('   - Phone column added to users table');
    console.log('   - Existing users will have NULL phone values');
    console.log('   - Users can update their phone via Edit User modal\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
    console.log('✨ Done!');
  }
}

addPhoneColumn();
