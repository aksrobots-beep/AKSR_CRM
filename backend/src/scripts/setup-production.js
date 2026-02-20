import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function setupProduction() {
  let connection;
  
  try {
    console.log('🚀 Starting production database setup...\n');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log(`✅ Connected to: ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);
    
    // Step 1: Check and add phone column
    console.log('📋 Step 1: Checking phone column...');
    const [phoneColumns] = await connection.execute(
      "SHOW COLUMNS FROM users LIKE 'phone'"
    );
    
    if (phoneColumns.length === 0) {
      await connection.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(20) AFTER name');
      console.log('   ✓ Added phone column');
    } else {
      console.log('   ℹ️  Phone column already exists');
    }
    
    // Step 2: Check and add can_approve column
    console.log('\n📋 Step 2: Checking can_approve column...');
    const [approveColumns] = await connection.execute(
      "SHOW COLUMNS FROM users LIKE 'can_approve'"
    );
    
    if (approveColumns.length === 0) {
      await connection.execute('ALTER TABLE users ADD COLUMN can_approve TINYINT DEFAULT 0 AFTER department');
      await connection.execute(
        "UPDATE users SET can_approve = 1 WHERE role IN ('ceo', 'admin', 'hr_manager', 'finance')"
      );
      console.log('   ✓ Added can_approve column');
      console.log('   ✓ Set approval rights for admin roles');
    } else {
      console.log('   ℹ️  can_approve column already exists');
    }
    
    // Step 3: Check and migrate equipment table
    console.log('\n📋 Step 3: Checking equipment ownership columns...');
    const [ownershipColumns] = await connection.execute(
      "SHOW COLUMNS FROM equipment LIKE 'ownership_type'"
    );
    
    if (ownershipColumns.length === 0) {
      console.log('   Migrating equipment table...');
      await connection.execute('ALTER TABLE equipment CHANGE COLUMN type ownership_type VARCHAR(20) NOT NULL DEFAULT "sold"');
      await connection.execute('ALTER TABLE equipment ADD COLUMN model_numbers TEXT AFTER model');
      await connection.execute('ALTER TABLE equipment ADD COLUMN rental_start_date DATE AFTER location');
      await connection.execute('ALTER TABLE equipment ADD COLUMN rental_end_date DATE AFTER rental_start_date');
      await connection.execute('ALTER TABLE equipment ADD COLUMN rental_duration_months INT AFTER rental_end_date');
      await connection.execute('ALTER TABLE equipment ADD COLUMN rental_amount DECIMAL(10,2) AFTER rental_duration_months');
      await connection.execute('ALTER TABLE equipment ADD COLUMN rental_terms TEXT AFTER rental_amount');
      await connection.execute('ALTER TABLE equipment ADD COLUMN amc_contract_start DATE AFTER rental_terms');
      await connection.execute('ALTER TABLE equipment ADD COLUMN amc_contract_end DATE AFTER amc_contract_start');
      await connection.execute('ALTER TABLE equipment ADD COLUMN amc_amount DECIMAL(10,2) AFTER amc_contract_end');
      await connection.execute('ALTER TABLE equipment ADD COLUMN amc_terms TEXT AFTER amc_amount');
      await connection.execute('ALTER TABLE equipment ADD COLUMN amc_renewal_status VARCHAR(20) AFTER amc_terms');
      
      // Migrate existing data
      await connection.execute('UPDATE equipment SET ownership_type = "sold" WHERE ownership_type IS NULL OR ownership_type = ""');
      console.log('   ✓ Equipment table migrated');
    } else {
      console.log('   ℹ️  Equipment ownership columns already exist');
    }
    
    // Step 4: Reset admin password
    console.log('\n📋 Step 4: Resetting admin password...');
    const adminPassword = 'admin123';
    const hash = await bcrypt.hash(adminPassword, 10);
    
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hash, 'admin@aksuccess.com.my']
    );
    
    if (result.affectedRows > 0) {
      console.log('   ✓ Admin password reset successfully');
      console.log(`   📧 Email: admin@aksuccess.com.my`);
      console.log(`   🔑 Password: ${adminPassword}`);
    } else {
      console.log('   ⚠️  Admin user not found, creating new one...');
      
      const [users] = await connection.execute('SELECT id FROM users LIMIT 1');
      const userId = users.length > 0 ? users[0].id : 'system';
      
      await connection.execute(
        `INSERT INTO users (id, email, password, name, role, department, can_approve, is_active, created_at, updated_at) 
         VALUES (UUID(), ?, ?, 'Administrator', 'admin', 'Management', 1, 1, NOW(), NOW())`,
        ['admin@aksuccess.com.my', hash]
      );
      console.log('   ✓ Admin user created');
      console.log(`   📧 Email: admin@aksuccess.com.my`);
      console.log(`   🔑 Password: ${adminPassword}`);
    }
    
    // Step 5: Verify database state
    console.log('\n📋 Step 5: Verifying database...');
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const [equipment] = await connection.execute('SELECT COUNT(*) as count FROM equipment');
    const [clients] = await connection.execute('SELECT COUNT(*) as count FROM clients');
    
    console.log(`   ✓ Active users: ${users[0].count}`);
    console.log(`   ✓ Equipment: ${equipment[0].count}`);
    console.log(`   ✓ Clients: ${clients[0].count}`);
    
    console.log('\n✅ Production database setup complete!\n');
    console.log('🔐 You can now login with:');
    console.log('   📧 Email: admin@aksuccess.com.my');
    console.log('   🔑 Password: admin123\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.code) console.error('   Code:', error.code);
    if (error.sql) console.error('   SQL:', error.sql);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
    console.log('🔌 Database connection closed\n');
  }
}

setupProduction();
