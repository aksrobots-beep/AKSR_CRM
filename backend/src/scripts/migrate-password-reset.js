import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('\n--- Migration: Password Reset Tokens ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) DEFAULT NULL,
        request_email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) DEFAULT NULL,
        request_ip VARCHAR(45),
        user_agent VARCHAR(255),
        expires_at DATETIME DEFAULT NULL,
        used_at DATETIME DEFAULT NULL,
        invalidated_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_reset_token_hash (token_hash),
        INDEX idx_reset_email_created (request_email, created_at),
        INDEX idx_reset_ip_created (request_ip, created_at),
        INDEX idx_reset_user (user_id),
        INDEX idx_reset_expires (expires_at)
      )`
    );
    console.log('  - ensured table: password_reset_tokens');
  } finally {
    await connection.end();
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
