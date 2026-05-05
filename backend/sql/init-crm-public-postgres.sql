-- AK Success CRM — create core tables in Postgres (Supabase `public` schema).
-- Derived from backend/src/db/init-mysql.js. Run in Supabase SQL Editor (or psql) once.
-- Does not seed data; use app admin / separate seed or init-mysql on MySQL for demo data.
--
-- Notes:
-- - TINYINT -> SMALLINT (0/1 flags)
-- - DATETIME -> TIMESTAMP (stores naive UTC wall clock like the Node app expects)
-- - MySQL ON UPDATE CURRENT_TIMESTAMP removed; routes should set updated_at on UPDATE where needed
-- - JSON -> JSONB

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  department VARCHAR(100),
  avatar VARCHAR(500),
  can_approve SMALLINT DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) DEFAULT NULL,
  request_email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) DEFAULT NULL,
  request_ip VARCHAR(45),
  user_agent VARCHAR(255),
  expires_at TIMESTAMP DEFAULT NULL,
  used_at TIMESTAMP DEFAULT NULL,
  invalidated_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT unique_reset_token_hash UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  position VARCHAR(100),
  join_date DATE,
  salary DECIMAL(12,2) DEFAULT 0,
  annual_leave_balance INT DEFAULT 14,
  sick_leave_balance INT DEFAULT 14,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT employees_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(36) PRIMARY KEY,
  client_code VARCHAR(50) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  old_company_name VARCHAR(255) DEFAULT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Malaysia',
  postal_code VARCHAR(20),
  industry VARCHAR(100),
  assigned_to VARCHAR(36),
  total_revenue DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  is_active SMALLINT DEFAULT 1,
  notes TEXT,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  geofence_radius_m INT NULL,
  geocoded_at TIMESTAMP NULL,
  geocode_source VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT clients_assigned_fk FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS equipment (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  serial_number VARCHAR(100),
  manufacturer VARCHAR(100),
  client_id VARCHAR(36),
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'operational',
  is_active SMALLINT DEFAULT 1,
  installation_date DATE,
  warranty_expiry DATE,
  last_service_date DATE,
  next_service_date DATE,
  notes TEXT,
  sim_number VARCHAR(100) NULL,
  sim_carrier VARCHAR(100) NULL,
  sim_phone_number VARCHAR(50) NULL,
  sim_top_up_date DATE NULL,
  sim_expired_date DATE NULL,
  sim_reminder_at TIMESTAMP NULL,
  sim_reminder_sent SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT equipment_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS equipment_sim_cards (
  id VARCHAR(36) PRIMARY KEY,
  equipment_id VARCHAR(36) NOT NULL,
  sim_number VARCHAR(100) NULL,
  sim_carrier VARCHAR(100) NULL,
  sim_phone_number VARCHAR(50) NULL,
  sim_top_up_date DATE NULL,
  sim_expired_date DATE NULL,
  sim_reminder_at TIMESTAMP NULL,
  sim_reminder_sent SMALLINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT equipment_sim_cards_eq_fk FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(36) PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'new',
  is_active SMALLINT DEFAULT 1,
  is_billable SMALLINT DEFAULT 1,
  client_id VARCHAR(36),
  equipment_id VARCHAR(36),
  assigned_to VARCHAR(36),
  due_date DATE,
  next_action_date DATE,
  next_action_item TEXT,
  action_taken TEXT,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  labor_cost DECIMAL(12,2) DEFAULT 0,
  parts_cost DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  tags JSONB,
  billing_items JSONB,
  billing_notes TEXT,
  support_attachments TEXT,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT tickets_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT tickets_equipment_fk FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL,
  CONSTRAINT tickets_assigned_fk FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(36) PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  quantity INT DEFAULT 0,
  min_quantity INT DEFAULT 0,
  unit_price DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'MYR',
  supplier VARCHAR(255),
  location VARCHAR(255),
  compatible_equipment JSONB,
  track_serial_numbers SMALLINT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
  id VARCHAR(36) PRIMARY KEY,
  inventory_id VARCHAR(36) NOT NULL,
  serial_number VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  notes TEXT,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  CONSTRAINT inv_sn_inventory_fk FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
  CONSTRAINT unique_sn UNIQUE (inventory_id, serial_number)
);

CREATE TABLE IF NOT EXISTS ticket_parts (
  id VARCHAR(36) PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  inventory_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  CONSTRAINT ticket_parts_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT ticket_parts_inv_fk FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  inventory_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  ticket_id VARCHAR(36),
  user_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_mov_inv_fk FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
  CONSTRAINT stock_mov_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
  CONSTRAINT stock_mov_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(20) DEFAULT 'info',
  link VARCHAR(500),
  is_read SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(512) NOT NULL,
  platform VARCHAR(20) DEFAULT 'android',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT push_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uniq_push_token UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS message_logs (
  id VARCHAR(36) PRIMARY KEY,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NULL,
  user_id VARCHAR(36) NULL,
  to_email VARCHAR(255) NULL,
  cc_email VARCHAR(500) NULL,
  title VARCHAR(255) NULL,
  subject VARCHAR(255) NULL,
  message TEXT NULL,
  link VARCHAR(500) NULL,
  error TEXT NULL,
  meta_json TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by VARCHAR(36),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leave_emp_fk FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT leave_approver_fk FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  client_id VARCHAR(36),
  ticket_id VARCHAR(36),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  items JSONB,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT invoices_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT invoices_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS client_site_visits (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NOT NULL,
  ticket_id VARCHAR(36) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  arrived_at TIMESTAMP NOT NULL,
  departed_at TIMESTAMP NULL,
  arrival_lat DECIMAL(10,8) NOT NULL,
  arrival_lng DECIMAL(11,8) NOT NULL,
  departure_lat DECIMAL(10,8) NULL,
  departure_lng DECIMAL(11,8) NULL,
  arrival_accuracy_m DECIMAL(10,2) NULL,
  departure_accuracy_m DECIMAL(10,2) NULL,
  checkout_outside_radius SMALLINT DEFAULT 0,
  ad_hoc_site SMALLINT NOT NULL DEFAULT 0,
  ad_hoc_center_lat DECIMAL(10,8) NULL,
  ad_hoc_center_lng DECIMAL(11,8) NULL,
  field_report_zip VARCHAR(512) NULL,
  field_report_manifest TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT csv_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT csv_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT csv_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  user_id VARCHAR(36),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  CONSTRAINT audit_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

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
  due_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  in_progress_started_at TIMESTAMP NULL,
  reminder_at TIMESTAMP NULL,
  reminder_sent_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP NULL,
  reminder_due_day_sent_for DATE NULL,
  reminder_due_hour_sent_at TIMESTAMP NULL,
  manager_overdue_notified_at DATE NULL,
  manager_stale_notified_at DATE NULL,
  microsoft_todo_item_id VARCHAR(128) NULL,
  task_category VARCHAR(32) NOT NULL DEFAULT 'meeting',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tasks_assignee_fk FOREIGN KEY (assigned_to) REFERENCES users(id),
  CONSTRAINT tasks_assigner_fk FOREIGN KEY (assigned_by) REFERENCES users(id),
  CONSTRAINT tasks_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
);

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT task_logs_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_microsoft_graph (
  user_id VARCHAR(36) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  ms_account_id VARCHAR(128) NULL,
  todo_list_id VARCHAR(128) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT umg_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_definitions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  module_key VARCHAR(100) NOT NULL,
  config_json JSONB NOT NULL,
  is_public SMALLINT DEFAULT 0,
  owner_user_id VARCHAR(36) NOT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT report_def_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_runs (
  id VARCHAR(36) PRIMARY KEY,
  report_definition_id VARCHAR(36) DEFAULT NULL,
  requested_by VARCHAR(36) DEFAULT NULL,
  module_key VARCHAR(100) NOT NULL,
  format VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'completed',
  row_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT report_runs_def_fk FOREIGN KEY (report_definition_id) REFERENCES report_definitions(id) ON DELETE SET NULL,
  CONSTRAINT report_runs_user_fk FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_column_policies (
  id VARCHAR(36) PRIMARY KEY,
  module_key VARCHAR(100) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  allowed_roles_json JSONB,
  is_blocked SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_report_col_policy UNIQUE (module_key, column_name)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  contact VARCHAR(255),
  email VARCHAR(255),
  whatsapp VARCHAR(50),
  wechat VARCHAR(50),
  lark VARCHAR(255),
  group_link VARCHAR(500),
  qr_code TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(36) PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NOT NULL,
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  line_items JSONB,
  valid_until DATE NULL,
  notes TEXT,
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT quot_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT quot_client_fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS client_purchase_orders (
  id VARCHAR(36) PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  quotation_id VARCHAR(36) NULL,
  po_number VARCHAR(100) NOT NULL,
  po_date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'requested',
  notes TEXT,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT cpo_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT cpo_quot_fk FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS delivery_orders (
  id VARCHAR(36) PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  delivery_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  notes TEXT,
  issued_at TIMESTAMP NULL,
  acknowledged_at TIMESTAMP NULL,
  acknowledged_by VARCHAR(36) NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT do_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT do_ack_user_fk FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS accounting_requests (
  id VARCHAR(36) PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  message TEXT,
  assigned_to VARCHAR(36) NULL,
  resolved_notes TEXT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  CONSTRAINT ar_ticket_fk FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT ar_assignee_fk FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes (MySQL inline INDEX -> Postgres)
CREATE INDEX IF NOT EXISTS idx_reset_email_created ON password_reset_tokens (request_email, created_at);
CREATE INDEX IF NOT EXISTS idx_reset_ip_created ON password_reset_tokens (request_ip, created_at);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_equipment_sim_reminder ON equipment_sim_cards (equipment_id, sim_reminder_at, sim_reminder_sent);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_message_logs_channel_status ON message_logs (channel, status, created_at);
CREATE INDEX IF NOT EXISTS idx_message_logs_user ON message_logs (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_push_user ON user_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_visits_user_client_status ON client_site_visits (user_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_client_arrived ON client_site_visits (client_id, arrived_at);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status_due ON tasks (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigner ON tasks (assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due_status ON tasks (due_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_last_activity ON tasks (last_activity_at);
CREATE INDEX IF NOT EXISTS idx_tasks_ticket ON tasks (ticket_id);

CREATE INDEX IF NOT EXISTS idx_task_logs_user_date ON task_logs (user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_work_date ON task_logs (work_date);

CREATE INDEX IF NOT EXISTS idx_quotations_ticket ON quotations (ticket_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations (status);

CREATE INDEX IF NOT EXISTS idx_cpo_ticket ON client_purchase_orders (ticket_id);

CREATE INDEX IF NOT EXISTS idx_do_ticket ON delivery_orders (ticket_id);

CREATE INDEX IF NOT EXISTS idx_ar_ticket ON accounting_requests (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ar_status ON accounting_requests (status);
CREATE INDEX IF NOT EXISTS idx_ar_type ON accounting_requests (request_type);

COMMIT;

-- ---------------------------------------------------------------------------
-- NOTE:
-- This init script is production-safe by default and does NOT seed any default
-- login credentials. Create admin users explicitly per environment.

-- Idempotent patches for DBs created before diary attachments (skip if table already has columns).
BEGIN;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_category VARCHAR(32) NOT NULL DEFAULT 'meeting';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS in_progress_started_at TIMESTAMP NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP NULL;
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(512);
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(255);
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(128);
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS work_category VARCHAR(32);
COMMIT;

-- Custom user: from backend/,  node -e "console.log(require('bcryptjs').hashSync('YourPassword',10))"
-- then INSERT ... or UPDATE users SET password = '...' WHERE email = '...';
