/**
 * Migration Script: Add can_approve column to users table
 * Run: node src/scripts/add-can-approve-column.js
 * 
 * This adds the can_approve column and sets default values based on role
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function migrate() {
  console.log('🔧 Adding can_approve column to users table...\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  console.log(`📊 Database: ${config.host}:${config.port} / ${config.database}\n`);

  if (!config.user || !config.password || !config.database) {
    console.error('❌ Missing DB_USER, DB_PASSWORD, or DB_NAME in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Step 1: Check if column already exists
    console.log('Checking if can_approve column exists...');
    const [columns] = await conn.execute(
      "SHOW COLUMNS FROM users LIKE 'can_approve'"
    );

    if (columns.length > 0) {
      console.log('⚠️  Column can_approve already exists. Skipping creation.\n');
    } else {
      // Step 2: Add the column
      console.log('Adding can_approve column...');
      await conn.execute(
        'ALTER TABLE users ADD COLUMN can_approve TINYINT DEFAULT 0 AFTER avatar'
      );
      console.log('✅ Column can_approve added successfully\n');
    }

    // Step 3: Update existing users based on their roles
    console.log('Setting can_approve based on existing roles...');
    
    // Grant approval to specific roles
    const [result] = await conn.execute(
      "UPDATE users SET can_approve = 1 WHERE role IN ('ceo', 'admin', 'hr_manager', 'finance')"
    );
    console.log(`✅ Updated ${result.affectedRows} users to can_approve = 1\n`);

    // Step 4: Verify the changes
    console.log('Verification:');
    const [approvers] = await conn.execute(
      'SELECT email, role, can_approve FROM users WHERE can_approve = 1'
    );
    console.log(`  Users with approval rights: ${approvers.length}`);
    approvers.forEach(user => {
      console.log(`    - ${user.email} (${user.role})`);
    });

    const [nonApprovers] = await conn.execute(
      'SELECT email, role, can_approve FROM users WHERE can_approve = 0'
    );
    console.log(`\n  Users without approval rights: ${nonApprovers.length}`);
    nonApprovers.forEach(user => {
      console.log(`    - ${user.email} (${user.role})`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNOTE: Users must re-login to get updated JWT tokens with can_approve flag.\n');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message || err);
    if (err.code) console.error('   Code:', err.code);
    if (err.sql) console.error('   SQL:', err.sql);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
