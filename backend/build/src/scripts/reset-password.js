import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL = 'admin@aksuccess.com.my';
const NEW_PASSWORD = 'demo123';

async function ensureAdmin() {
  console.log(`🔐 Ensuring admin ${EMAIL} can sign in (password: ${NEW_PASSWORD})...\n`);

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (!config.user || !config.password || !config.database) {
    console.error('❌ Missing DB_USER, DB_PASSWORD, or DB_NAME in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(config);

    const [rows] = await conn.execute('SELECT id, email, name, is_active FROM users WHERE email = ?', [EMAIL]);
    const hashed = bcrypt.hashSync(NEW_PASSWORD, 10);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (rows.length === 0) {
      const id = uuidv4();
      await conn.execute(
        `INSERT INTO users (id, email, password, name, role, department, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, EMAIL, hashed, 'Admin', 'admin', 'Operations', now, now]
      );
      console.log('✅ User created and ready to sign in.');
    } else {
      await conn.execute(
        'UPDATE users SET password = ?, is_active = 1, updated_at = ? WHERE email = ?',
        [hashed, now, EMAIL]
      );
      console.log('✅ Password reset and is_active set to 1.');
    }

    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log('\n🟢 You can now log in with these credentials.');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    if (err.code) console.error('   Code:', err.code);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

ensureAdmin();
