import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function migrateEquipmentOwnership() {
  let connection;
  
  try {
    console.log('🔄 Starting equipment ownership migration...\n');
    
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'aksucce2_akcrm'
    });
    
    console.log('✅ Connected to database:', process.env.DB_NAME);
    
    // Check if migration is needed
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM equipment LIKE 'ownership_type'`
    );
    
    if (columns.length > 0) {
      console.log('⚠️  Migration already applied. ownership_type column exists.');
      await connection.end();
      return;
    }
    
    console.log('\n📋 Step 1: Counting existing equipment records...');
    const [countResult] = await connection.query('SELECT COUNT(*) as count FROM equipment');
    const existingCount = countResult[0].count;
    console.log(`   Found ${existingCount} existing equipment records\n`);
    
    // Start transaction
    await connection.beginTransaction();
    
    console.log('📋 Step 2: Altering equipment table schema...');
    
    // Change type to ownership_type
    await connection.query(`
      ALTER TABLE equipment 
      CHANGE COLUMN \`type\` \`ownership_type\` VARCHAR(20) NOT NULL DEFAULT 'sold'
    `);
    console.log('   ✓ Changed type to ownership_type');
    
    // Add model_numbers column
    await connection.query(`
      ALTER TABLE equipment 
      ADD COLUMN \`model_numbers\` TEXT AFTER \`model\`
    `);
    console.log('   ✓ Added model_numbers column');
    
    // Add rental fields
    await connection.query(`
      ALTER TABLE equipment 
      ADD COLUMN \`rental_start_date\` DATE AFTER \`location\`,
      ADD COLUMN \`rental_end_date\` DATE AFTER \`rental_start_date\`,
      ADD COLUMN \`rental_duration_months\` INT AFTER \`rental_end_date\`,
      ADD COLUMN \`rental_amount\` DECIMAL(10,2) AFTER \`rental_duration_months\`,
      ADD COLUMN \`rental_terms\` TEXT AFTER \`rental_amount\`
    `);
    console.log('   ✓ Added rental contract fields');
    
    // Add AMC fields
    await connection.query(`
      ALTER TABLE equipment 
      ADD COLUMN \`amc_contract_start\` DATE AFTER \`rental_terms\`,
      ADD COLUMN \`amc_contract_end\` DATE AFTER \`amc_contract_start\`,
      ADD COLUMN \`amc_amount\` DECIMAL(10,2) AFTER \`amc_contract_end\`,
      ADD COLUMN \`amc_terms\` TEXT AFTER \`amc_amount\`,
      ADD COLUMN \`amc_renewal_status\` VARCHAR(20) AFTER \`amc_terms\`
    `);
    console.log('   ✓ Added AMC contract fields\n');
    
    if (existingCount > 0) {
      console.log('📋 Step 3: Migrating existing data...');
      
      // Set all existing equipment to 'sold'
      await connection.query(`
        UPDATE equipment 
        SET ownership_type = 'sold' 
        WHERE ownership_type != 'sold'
      `);
      console.log('   ✓ Set ownership_type to "sold" for all existing records');
      
      // Migrate serial_number to model_numbers JSON array
      await connection.query(`
        UPDATE equipment 
        SET model_numbers = JSON_ARRAY(serial_number) 
        WHERE serial_number IS NOT NULL AND serial_number != ''
      `);
      console.log('   ✓ Migrated serial_number to model_numbers array\n');
    } else {
      console.log('📋 Step 3: No existing data to migrate\n');
    }
    
    // Commit transaction
    await connection.commit();
    
    console.log('📋 Step 4: Verifying migration...');
    const [verifyResult] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ownership_type = 'sold' THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN ownership_type = 'rental' THEN 1 ELSE 0 END) as rental_count,
        SUM(CASE WHEN model_numbers IS NOT NULL THEN 1 ELSE 0 END) as with_models
      FROM equipment
    `);
    
    const stats = verifyResult[0];
    console.log('   ✓ Total equipment:', stats.total);
    console.log('   ✓ Sold equipment:', stats.sold_count);
    console.log('   ✓ Rental equipment:', stats.rental_count);
    console.log('   ✓ With model numbers:', stats.with_models);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Notes:');
    console.log('   - All existing equipment set as "sold"');
    console.log('   - Serial numbers migrated to model_numbers array');
    console.log('   - Contract fields are NULL (can be filled in via UI)');
    console.log('   - Users should re-login to refresh tokens with new data\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (connection) {
      try {
        await connection.rollback();
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
migrateEquipmentOwnership()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
