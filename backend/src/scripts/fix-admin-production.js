/**
 * Fix admin login for production
 * Run: node src/scripts/fix-admin-production.js
 * 
 * This sets admin@aksuccess.com.my password to the exact bcrypt hash provided
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const EMAIL = process.env.ADMIN_EMAIL || 'admin@aksuccess.com.my';
const PLAIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PROVIDED_HASH = process.env.ADMIN_PASSWORD_HASH;
const BCRYPT_HASH = PROVIDED_HASH || (PLAIN_PASSWORD ? bcrypt.hashSync(PLAIN_PASSWORD, 10) : '');
const PASSWORD_TEXT = PLAIN_PASSWORD ? '(provided via ADMIN_PASSWORD)' : '(hidden)';

async function fixAdmin() {
  if (!BCRYPT_HASH) {
    console.error('❌ Missing ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in environment.');
    console.error('   Example: ADMIN_PASSWORD=yourPassword node src/scripts/fix-admin-production.js');
    process.exit(1);
  }
  console.log(`🔐 Fixing admin login for ${EMAIL}\n`);

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  console.log(`📊 Database: ${config.host}:${config.port} / ${config.database}`);

  if (!config.user || !config.password || !config.database) {
    console.error('❌ Missing DB_USER, DB_PASSWORD, or DB_NAME in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Check if user exists
    const [rows] = await conn.execute(
      'SELECT id, email, name, role, is_active FROM users WHERE email = ?',
      [EMAIL]
    );

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (rows.length === 0) {
      // Create new user
      const id = uuidv4();
      await conn.execute(
        `INSERT INTO users (id, email, password, name, role, department, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, EMAIL, BCRYPT_HASH, 'Admin', 'admin', 'Operations', now, now]
      );
      console.log('✅ Admin user CREATED successfully');
    } else {
      // Update existing user
      const user = rows[0];
      console.log(`Found existing user: ${user.name} (${user.role})`);
      console.log(`Current is_active: ${user.is_active}\n`);

      await conn.execute(
        'UPDATE users SET password = ?, is_active = 1, updated_at = ? WHERE email = ?',
        [BCRYPT_HASH, now, EMAIL]
      );
      console.log('✅ Admin password UPDATED and activated');
    }

    // Verify
    const [verify] = await conn.execute(
      'SELECT email, name, role, is_active, LEFT(password, 20) as pass_preview FROM users WHERE email = ?',
      [EMAIL]
    );

    if (verify.length > 0) {
      const v = verify[0];
      console.log('\n📋 Verification:');
      console.log(`   Email: ${v.email}`);
      console.log(`   Name: ${v.name}`);
      console.log(`   Role: ${v.role}`);
      console.log(`   Active: ${v.is_active}`);
      console.log(`   Password: ${v.pass_preview}...`);
    }

    console.log(`\n🎉 SUCCESS! You can now log in with:`);
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD_TEXT}\n`);

  } catch (err) {
    console.error('\n❌ Error:', err.message || err);
    if (err.code) console.error('   Code:', err.code);
    if (err.sql) console.error('   SQL:', err.sql);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

fixAdmin();
