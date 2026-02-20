/**
 * Validate MySQL connection (optionally to remote host).
 * Usage: node validate-db-connection.js
 *        node validate-db-connection.js 103.6.196.30
 * Loads .env from backend folder; override host via first arg or DB_HOST in .env.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const host = process.argv[2] || process.env.DB_HOST || 'localhost';

const config = {
  host,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function run() {
  console.log('\n🔍 Validating MySQL connection...\n');
  console.log('  Host:', config.host);
  console.log('  Port:', config.port);
  console.log('  User:', config.user);
  console.log('  Database:', config.database);
  console.log('  Password:', config.password ? '***' : '(not set)\n');

  if (!config.user || !config.database) {
    console.error('❌ Missing DB_USER or DB_NAME in .env');
    process.exit(1);
  }

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.execute('SELECT DATABASE() as db, USER() as user, VERSION() as v');
    console.log('✅ Connection successful!\n');
    console.log('   Database:', rows[0].db);
    console.log('   Connected as:', rows[0].user);
    console.log('   MySQL version:', rows[0].v);
    await conn.end();
    console.log('\n');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.code) console.error('   Code:', err.code);
    if (err.code === 'ECONNREFUSED') {
      console.error('\n   Check: host/port reachable, firewall, MySQL bind-address / remote access.');
    }
    console.log('\n');
    process.exit(1);
  }
}

run();
