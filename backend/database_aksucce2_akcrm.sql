-- AK Success CRM Database Schema for cPanel/phpMyAdmin
-- Database: aksucce2_akcrm
-- Run this SQL in phpMyAdmin or MySQL CLI

-- Make sure you're using the correct database
USE `aksucce2_akcrm`;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20),
  `role` VARCHAR(50) NOT NULL,
  `department` VARCHAR(100),
  `can_approve` TINYINT DEFAULT 0,
  `avatar` VARCHAR(500),
  `is_active` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Employees table (extended user info)
CREATE TABLE IF NOT EXISTS `employees` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `position` VARCHAR(100),
  `join_date` DATE,
  `salary` DECIMAL(12,2) DEFAULT 0,
  `annual_leave_balance` INT DEFAULT 14,
  `sick_leave_balance` INT DEFAULT 14,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Clients table
CREATE TABLE IF NOT EXISTS `clients` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `phone` VARCHAR(50),
  `address` TEXT,
  `city` VARCHAR(100),
  `state` VARCHAR(100),
  `country` VARCHAR(100) DEFAULT 'Malaysia',
  `postal_code` VARCHAR(20),
  `industry` VARCHAR(100),
  `assigned_to` VARCHAR(36),
  `total_revenue` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'active',
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36),
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Equipment table
CREATE TABLE IF NOT EXISTS `equipment` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `ownership_type` VARCHAR(20) NOT NULL DEFAULT 'sold',
  `model` VARCHAR(100),
  `model_numbers` TEXT,
  `serial_number` VARCHAR(100),
  `manufacturer` VARCHAR(100),
  `client_id` VARCHAR(36),
  `location` VARCHAR(255),
  `rental_start_date` DATE,
  `rental_end_date` DATE,
  `rental_duration_months` INT,
  `rental_amount` DECIMAL(10,2),
  `rental_terms` TEXT,
  `amc_contract_start` DATE,
  `amc_contract_end` DATE,
  `amc_amount` DECIMAL(10,2),
  `amc_terms` TEXT,
  `amc_renewal_status` VARCHAR(20),
  `status` VARCHAR(50) DEFAULT 'operational',
  `installation_date` DATE,
  `warranty_expiry` DATE,
  `last_service_date` DATE,
  `next_service_date` DATE,
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tickets table
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `ticket_number` VARCHAR(50) UNIQUE NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `priority` VARCHAR(20) DEFAULT 'medium',
  `status` VARCHAR(50) DEFAULT 'new',
  `client_id` VARCHAR(36),
  `equipment_id` VARCHAR(36),
  `assigned_to` VARCHAR(36),
  `due_date` DATE,
  `next_action_date` DATE,
  `next_action_item` TEXT,
  `action_taken` TEXT,
  `estimated_hours` DECIMAL(5,2),
  `actual_hours` DECIMAL(5,2),
  `labor_cost` DECIMAL(12,2) DEFAULT 0,
  `parts_cost` DECIMAL(12,2) DEFAULT 0,
  `total_cost` DECIMAL(12,2) DEFAULT 0,
  `tags` JSON,
  `resolved_at` DATETIME,
  `closed_at` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Inventory table
CREATE TABLE IF NOT EXISTS `inventory` (
  `id` VARCHAR(36) PRIMARY KEY,
  `sku` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(50),
  `quantity` INT DEFAULT 0,
  `min_quantity` INT DEFAULT 0,
  `unit_price` DECIMAL(12,2) DEFAULT 0,
  `supplier` VARCHAR(255),
  `location` VARCHAR(255),
  `compatible_equipment` JSON,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36)
) ENGINE=InnoDB;

-- Suppliers table (Manufacturer Master)
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `contact` VARCHAR(255),
  `email` VARCHAR(255),
  `whatsapp` VARCHAR(50),
  `wechat` VARCHAR(50),
  `lark` VARCHAR(255),
  `group_link` VARCHAR(500),
  `qr_code` TEXT,
  `notes` TEXT,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36)
) ENGINE=InnoDB;

-- Ticket Parts table (parts used on tickets)
CREATE TABLE IF NOT EXISTS `ticket_parts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `ticket_id` VARCHAR(36) NOT NULL,
  `inventory_id` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(12,2) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Stock Movements table
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` VARCHAR(36) PRIMARY KEY,
  `inventory_id` VARCHAR(36) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `quantity` INT NOT NULL,
  `reason` TEXT,
  `ticket_id` VARCHAR(36),
  `user_id` VARCHAR(36),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Leave Requests table
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` VARCHAR(36) PRIMARY KEY,
  `employee_id` VARCHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `days` INT NOT NULL,
  `reason` TEXT,
  `status` VARCHAR(50) DEFAULT 'pending',
  `approved_by` VARCHAR(36),
  `rejection_reason` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Invoices table
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` VARCHAR(36) PRIMARY KEY,
  `invoice_number` VARCHAR(50) UNIQUE NOT NULL,
  `client_id` VARCHAR(36),
  `ticket_id` VARCHAR(36),
  `issue_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `items` JSON,
  `subtotal` DECIMAL(12,2) DEFAULT 0,
  `tax` DECIMAL(12,2) DEFAULT 0,
  `total` DECIMAL(12,2) DEFAULT 0,
  `paid_amount` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'draft',
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(36),
  `updated_by` VARCHAR(36),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Audit Logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(36) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `previous_value` JSON,
  `new_value` JSON,
  `user_id` VARCHAR(36),
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ========================================
-- NOTE: Tables created successfully!
-- 
-- Next Steps:
-- 1. Create an admin user via phpMyAdmin Insert or SQL
-- 2. Set up environment variables in backend/.env
-- 3. Deploy frontend and backend files
-- 4. See CPANEL_DEPLOYMENT_GUIDE.md for full deployment instructions
-- ========================================
