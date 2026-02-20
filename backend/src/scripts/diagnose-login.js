/**
 * Run: node src/scripts/diagnose-login.js
 * Diagnoses login for a specific user/password
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const EMAIL = process.env.DIAG_EMAIL;
const PASSWORD = process.env.DIAG_PASSWORD;

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ Missing DIAG_EMAIL or DIAG_PASSWORD in environment.');
    console.error('   Example: DIAG_EMAIL=user@example.com DIAG_PASSWORD=yourPassword node src/scripts/diagnose-login.js');
    process.exit(1);
  }
  console.log('🔍 Login diagnose for', EMAIL, '\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  console.log('DB:', config.host + ':' + config.port, config.database);
  if (!config.user || !config.database) {
    console.error('❌ Missing DB_USER or DB_NAME in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ DB connected\n');

    // 1) Raw match on email (no LOWER/TRIM) to see if user exists at all
    const [byEmail] = await conn.execute('SELECT id, email, is_active, password, LENGTH(password) as plen FROM users WHERE email = ?', [EMAIL]);
    console.log('1) SELECT WHERE email = ? :', byEmail.length, 'row(s)');
    if (byEmail.length) {
      const r = byEmail[0];
      console.log('   id:', r.id, '| is_active:', r.is_active, '| password length:', r.plen);
      console.log('   password starts with:', String(r.password || '').slice(0, 20) + '...');
      console.log('   looks like bcrypt:', /^\$2[ab]\$/.test(String(r.password || '')));
    }

    // 2) Same query as auth.js
    const [rows] = await conn.execute(
      "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? AND (is_active = 1 OR is_active = '1') LIMIT 1",
      [EMAIL.toLowerCase()]
    );
    console.log('\n2) Auth-style query (LOWER(TRIM(email))=? AND is_active):', rows.length, 'row(s)');
    if (rows.length === 0) {
      // Try without is_active to see if user exists but inactive
      const [any] = await conn.execute("SELECT id, email, is_active FROM users WHERE LOWER(TRIM(email)) = ?", [EMAIL.toLowerCase()]);
      if (any.length) {
        console.log('   User exists but is_active filter excluded them. is_active =', any[0].is_active);
      } else {
        console.log('   No user with LOWER(TRIM(email)) =', EMAIL.toLowerCase());
      }
    } else {
      const u = rows[0];
      const pass = u.password ?? u.PASSWORD ?? u.Password ?? '';
      const passStr = Buffer.isBuffer(pass) ? pass.toString('utf8') : String(pass);
      console.log('   id:', u.id, '| password length:', passStr.length, '| bcrypt prefix:', passStr.slice(0, 7));

      // 3) Bcrypt compare
      try {
        const ok = bcrypt.compareSync(PASSWORD, passStr);
        console.log('\n3) bcrypt.compareSync(<password>, stored):', ok ? '✅ OK' : '❌ FALSE');
      } catch (e) {
        console.log('\n3) bcrypt.compareSync threw:', e.message);
      }
    }

    console.log('\n✅ Diagnose done.');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.code) console.error('   Code:', err.code);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
