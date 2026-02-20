/**
 * Check all users in production database
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkUsers() {
  console.log('🔍 Checking all users in production database\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  console.log(`📊 Database: ${config.host}:${config.port} / ${config.database}\n`);

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Get all users with email containing 'admin'
    const [rows] = await conn.execute(
      `SELECT id, email, name, role, is_active, 
              LEFT(password, 29) as pass_start,
              LENGTH(password) as pass_len,
              created_at, updated_at
       FROM users 
       WHERE LOWER(email) LIKE '%admin%'
       ORDER BY email`
    );

    console.log(`Found ${rows.length} user(s) with 'admin' in email:\n`);
    
    rows.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.is_active}`);
      console.log(`  Password: ${user.pass_start}... (${user.pass_len} chars)`);
      console.log(`  Created: ${user.created_at}`);
      console.log(`  Updated: ${user.updated_at}`);
      console.log('');
    });

    // Check exact email match
    const [exact] = await conn.execute(
      'SELECT COUNT(*) as count FROM users WHERE email = ?',
      ['admin@aksuccess.com.my']
    );
    
    console.log(`Exact match count for 'admin@aksuccess.com.my': ${exact[0].count}\n`);

    // Check case-insensitive match (like the API does)
    const [caseInsensitive] = await conn.execute(
      'SELECT COUNT(*) as count FROM users WHERE LOWER(TRIM(email)) = ?',
      ['admin@aksuccess.com.my'.toLowerCase()]
    );
    
    console.log(`Case-insensitive match: ${caseInsensitive[0].count}\n`);

  } catch (err) {
    console.error('\n❌ Error:', err.message || err);
    if (err.code) console.error('   Code:', err.code);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

checkUsers();
