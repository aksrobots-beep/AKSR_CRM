import 'dotenv/config';
import mysql from 'mysql2/promise';

async function ensureTable(connection, sql, tableName) {
  await connection.execute(sql);
  console.log(`  - ensured table: ${tableName}`);
}

async function main() {
  console.log('\n--- Migration: Report Module ---\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await ensureTable(
      connection,
      `CREATE TABLE IF NOT EXISTS report_definitions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        module_key VARCHAR(100) NOT NULL,
        config_json JSON NOT NULL,
        is_public TINYINT DEFAULT 0,
        owner_user_id VARCHAR(36) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      'report_definitions'
    );

    await ensureTable(
      connection,
      `CREATE TABLE IF NOT EXISTS report_runs (
        id VARCHAR(36) PRIMARY KEY,
        report_definition_id VARCHAR(36) DEFAULT NULL,
        requested_by VARCHAR(36) DEFAULT NULL,
        module_key VARCHAR(100) NOT NULL,
        format VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'completed',
        row_count INT DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_definition_id) REFERENCES report_definitions(id) ON DELETE SET NULL,
        FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
      )`,
      'report_runs'
    );

    await ensureTable(
      connection,
      `CREATE TABLE IF NOT EXISTS report_column_policies (
        id VARCHAR(36) PRIMARY KEY,
        module_key VARCHAR(100) NOT NULL,
        column_name VARCHAR(100) NOT NULL,
        allowed_roles_json JSON,
        is_blocked TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_report_col_policy (module_key, column_name)
      )`,
      'report_column_policies'
    );
  } finally {
    await connection.end();
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
