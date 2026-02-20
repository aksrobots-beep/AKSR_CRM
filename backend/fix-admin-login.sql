-- =====================================================
-- RESET ADMIN - Try these options
-- =====================================================

-- OPTION 1: Update existing admin user
-- Run this first
UPDATE `users` 
SET `password` = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
    `is_active` = 1
WHERE `email` = 'admin@aksuccess.com.my';

-- Then check if it worked
SELECT email, name, role, is_active 
FROM `users` 
WHERE `email` = 'admin@aksuccess.com.my';

-- OPTION 2: If the email doesn't exist, try these other emails
SELECT email, name, role, is_active 
FROM `users` 
WHERE `role` = 'admin' OR `role` = 'ceo'
ORDER BY `email`;

-- OPTION 3: If you see a different admin email, update that one instead
-- Replace 'ACTUAL_EMAIL_HERE' with the email from above query
-- UPDATE `users` 
-- SET `password` = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
--     `is_active` = 1
-- WHERE `email` = 'ACTUAL_EMAIL_HERE';

-- OPTION 4: Create a brand new admin user
-- Only run this if admin@aksuccess.com.my doesn't exist
INSERT INTO `users` (
  `id`,
  `email`,
  `password`,
  `name`,
  `phone`,
  `role`,
  `department`,
  `can_approve`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES (
  CONCAT('admin-', UNIX_TIMESTAMP()),
  'admin@aksuccess.com.my',
  '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
  'System Administrator',
  NULL,
  'admin',
  'Management',
  1,
  1,
  NOW(),
  NOW()
);
