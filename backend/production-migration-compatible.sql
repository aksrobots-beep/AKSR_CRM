-- =====================================================
-- AK Success CRM - Production Database Migration
-- MySQL Compatible Version (for older MySQL versions)
-- Run this in phpMyAdmin on your production database
-- =====================================================

-- NOTE: If you get "Duplicate column" errors, that's OK - it means the column already exists.
-- Just continue with the next statement.

-- Step 1: Add phone column to users table
-- If this gives error "Duplicate column", skip to next statement
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) AFTER `name`;

-- Step 2: Add can_approve column to users table  
-- If this gives error "Duplicate column", skip to next statement
ALTER TABLE `users` ADD COLUMN `can_approve` TINYINT DEFAULT 0 AFTER `department`;

-- Grant approval rights to admin roles
UPDATE `users` 
SET `can_approve` = 1 
WHERE `role` IN ('ceo', 'admin', 'hr_manager', 'finance');

-- Step 3: Check if equipment table needs migration
-- Run this SELECT to see if you have 'type' or 'ownership_type' column:
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'equipment' AND COLUMN_NAME IN ('type', 'ownership_type');

-- If you see 'type' column, run this to rename it:
ALTER TABLE `equipment` CHANGE COLUMN `type` `ownership_type` VARCHAR(20) NOT NULL DEFAULT 'sold';

-- If you get error "Unknown column 'type'", that means it's already renamed. Skip above and continue.

-- Add model_numbers column
-- If error "Duplicate column", skip to next
ALTER TABLE `equipment` ADD COLUMN `model_numbers` TEXT AFTER `model`;

-- Add rental contract fields
-- If any give "Duplicate column" error, skip that one
ALTER TABLE `equipment` ADD COLUMN `rental_start_date` DATE AFTER `location`;
ALTER TABLE `equipment` ADD COLUMN `rental_end_date` DATE AFTER `rental_start_date`;
ALTER TABLE `equipment` ADD COLUMN `rental_duration_months` INT AFTER `rental_end_date`;
ALTER TABLE `equipment` ADD COLUMN `rental_amount` DECIMAL(10,2) AFTER `rental_duration_months`;
ALTER TABLE `equipment` ADD COLUMN `rental_terms` TEXT AFTER `rental_amount`;

-- Add AMC contract fields
-- If any give "Duplicate column" error, skip that one
ALTER TABLE `equipment` ADD COLUMN `amc_contract_start` DATE AFTER `rental_terms`;
ALTER TABLE `equipment` ADD COLUMN `amc_contract_end` DATE AFTER `amc_contract_start`;
ALTER TABLE `equipment` ADD COLUMN `amc_amount` DECIMAL(10,2) AFTER `amc_contract_end`;
ALTER TABLE `equipment` ADD COLUMN `amc_terms` TEXT AFTER `amc_amount`;
ALTER TABLE `equipment` ADD COLUMN `amc_renewal_status` VARCHAR(20) AFTER `amc_terms`;

-- Set all existing equipment as 'sold'
UPDATE `equipment` 
SET `ownership_type` = 'sold' 
WHERE `ownership_type` IS NULL OR `ownership_type` = '';

-- Step 4: Reset admin password to 'admin123'
UPDATE `users` 
SET `password` = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu'
WHERE `email` = 'admin@aksuccess.com.my';

-- =====================================================
-- Migration Complete!
-- Login with:
-- Email: admin@aksuccess.com.my
-- Password: admin123
-- =====================================================
