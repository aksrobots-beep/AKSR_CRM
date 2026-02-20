-- =====================================================
-- AK Success CRM - Production Database Migration
-- Run this in phpMyAdmin on your production database
-- =====================================================

-- Step 1: Add phone column to users table
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `phone` VARCHAR(20) AFTER `name`;

-- Step 2: Add can_approve column to users table
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `can_approve` TINYINT DEFAULT 0 AFTER `department`;

-- Grant approval rights to admin roles
UPDATE `users` 
SET `can_approve` = 1 
WHERE `role` IN ('ceo', 'admin', 'hr_manager', 'finance');

-- Step 3: Migrate equipment table for ownership tracking
-- Check if migration is needed (if ownership_type doesn't exist)
-- If the column already exists, skip this step

-- Rename type to ownership_type
ALTER TABLE `equipment` 
CHANGE COLUMN `type` `ownership_type` VARCHAR(20) NOT NULL DEFAULT 'sold';

-- Add model_numbers column
ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `model_numbers` TEXT AFTER `model`;

-- Add rental contract fields
ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `rental_start_date` DATE AFTER `location`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `rental_end_date` DATE AFTER `rental_start_date`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `rental_duration_months` INT AFTER `rental_end_date`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `rental_amount` DECIMAL(10,2) AFTER `rental_duration_months`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `rental_terms` TEXT AFTER `rental_amount`;

-- Add AMC contract fields
ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `amc_contract_start` DATE AFTER `rental_terms`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `amc_contract_end` DATE AFTER `amc_contract_start`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `amc_amount` DECIMAL(10,2) AFTER `amc_contract_end`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `amc_terms` TEXT AFTER `amc_amount`;

ALTER TABLE `equipment` 
ADD COLUMN IF NOT EXISTS `amc_renewal_status` VARCHAR(20) AFTER `amc_terms`;

-- Set all existing equipment as 'sold' if not set
UPDATE `equipment` 
SET `ownership_type` = 'sold' 
WHERE `ownership_type` IS NULL OR `ownership_type` = '';

-- Step 4: Reset admin password
-- This will reset the password to 'admin123'
-- The hash below is bcrypt hash for 'admin123'
UPDATE `users` 
SET `password` = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu'
WHERE `email` = 'admin@aksuccess.com.my';

-- If admin user doesn't exist, create it
INSERT IGNORE INTO `users` (
  `id`,
  `email`,
  `password`,
  `name`,
  `role`,
  `department`,
  `can_approve`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES (
  UUID(),
  'admin@aksuccess.com.my',
  '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
  'Administrator',
  'admin',
  'Management',
  1,
  1,
  NOW(),
  NOW()
);

-- =====================================================
-- Migration Complete!
-- You can now login with:
-- Email: admin@aksuccess.com.my
-- Password: admin123
-- =====================================================
