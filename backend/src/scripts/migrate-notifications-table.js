/**
 * Creates the notifications table if it doesn't exist.
 * Run from backend folder: node src/scripts/migrate-notifications-table.js
 * Uses DB_* from backend/.env (or parent .env).
 */
import '../load-env.js';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: notifications table ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(20) DEFAULT 'info',
        link VARCHAR(500),
        is_read TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notifications_user_read (user_id, is_read),
        INDEX idx_notifications_created (user_id, created_at)
      )`
    );
    console.log('  - ensured table: notifications');
  } finally {
    await connection.end();
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
