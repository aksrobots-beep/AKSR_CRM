/**
 * Creates tasks and task_logs tables if missing (idempotent).
 * Run: cd backend && node src/scripts/migrate-tasks-module.js
 */
import '../load-env.js';
import mysql from 'mysql2/promise';

const TASKS_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  ticket_id VARCHAR(36) NULL,
  assigned_to VARCHAR(36) NOT NULL,
  assigned_by VARCHAR(36) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  due_at DATETIME NULL,
  completed_at DATETIME NULL,
  in_progress_started_at DATETIME NULL,
  reminder_at DATETIME NULL,
  reminder_sent_at DATETIME NULL,
  last_activity_at DATETIME NULL,
  reminder_due_day_sent_for DATE NULL,
  reminder_due_hour_sent_at DATETIME NULL,
  manager_overdue_notified_at DATE NULL,
  manager_stale_notified_at DATE NULL,
  microsoft_todo_item_id VARCHAR(128) NULL,
  task_category VARCHAR(32) NOT NULL DEFAULT 'meeting',
  is_active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
  INDEX idx_tasks_assignee_status_due (assigned_to, status, due_date),
  INDEX idx_tasks_assigner (assigned_by),
  INDEX idx_tasks_due_status (due_date, status),
  INDEX idx_tasks_last_activity (last_activity_at),
  INDEX idx_tasks_ticket (ticket_id)
)`;

const TASK_LOGS_SQL = `
CREATE TABLE IF NOT EXISTS task_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NULL,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_minutes INT NOT NULL,
  notes TEXT,
  work_category VARCHAR(32) NULL,
  attachment_path VARCHAR(512) NULL,
  attachment_original_name VARCHAR(255) NULL,
  attachment_mime VARCHAR(128) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_task_logs_user_date (user_id, work_date),
  INDEX idx_task_logs_task (task_id),
  INDEX idx_task_logs_work_date (work_date)
)`;

async function addTaskCategoryColumns(conn) {
  const alters = [
    "ALTER TABLE tasks ADD COLUMN task_category VARCHAR(32) NOT NULL DEFAULT 'meeting'",
    'ALTER TABLE tasks ADD COLUMN in_progress_started_at DATETIME NULL',
    'ALTER TABLE tasks ADD COLUMN reminder_at DATETIME NULL',
    'ALTER TABLE tasks ADD COLUMN reminder_sent_at DATETIME NULL',
    'ALTER TABLE task_logs ADD COLUMN work_category VARCHAR(32) NULL',
  ];
  for (const sql of alters) {
    try {
      await conn.execute(sql);
      console.log('✓ task category migration step ok');
    } catch (e) {
      const code = e?.code;
      const msg = String(e?.message || '');
      if (code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column')) {
        continue;
      }
      throw e;
    }
  }
}

async function addTaskLogAttachmentColumns(conn) {
  const alters = [
    'ALTER TABLE task_logs ADD COLUMN attachment_path VARCHAR(512) NULL',
    'ALTER TABLE task_logs ADD COLUMN attachment_original_name VARCHAR(255) NULL',
    'ALTER TABLE task_logs ADD COLUMN attachment_mime VARCHAR(128) NULL',
  ];
  for (const sql of alters) {
    try {
      await conn.execute(sql);
      console.log('✓', sql.slice(0, 60) + '…');
    } catch (e) {
      const code = e?.code;
      const msg = String(e?.message || '');
      if (code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column')) {
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  const database = process.env.DB_NAME || 'ak_crm';
  console.log('\n--- migrate-tasks-module ---\nDB:', database);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });

  try {
    await conn.execute(TASKS_SQL);
    console.log('✓ tasks table ready');
    await conn.execute(TASK_LOGS_SQL);
    console.log('✓ task_logs table ready');
    await addTaskLogAttachmentColumns(conn);
    await addTaskCategoryColumns(conn);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
