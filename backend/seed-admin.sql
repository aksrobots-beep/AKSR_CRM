-- Seed admin user for AK Success CRM
-- Replace the bcrypt hash with your chosen password hash
-- Run in phpMyAdmin or MySQL CLI after tables exist

-- Use your database name (e.g. aksucce2_akcrm or aksucce2_crm)
-- USE `aksucce2_akcrm`;

-- Insert admin user (password hash required)
-- Replace the UUID if you need a specific id
INSERT INTO `users` (
  `id`,
  `email`,
  `password`,
  `name`,
  `role`,
  `department`,
  `avatar`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES (
  UUID(),
  'admin@aksuccess.com.my',
  'REPLACE_WITH_BCRYPT_HASH',
  'Admin',
  'admin',
  'Operations',
  NULL,
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `password` = 'REPLACE_WITH_BCRYPT_HASH',
  `name` = 'Admin',
  `role` = 'admin',
  `department` = 'Operations',
  `is_active` = 1,
  `updated_at` = NOW();

-- Login: admin@aksuccess.com.my / (your password)
