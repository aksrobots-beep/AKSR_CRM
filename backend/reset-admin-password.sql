-- =====================================================
-- AK Success CRM - Production Password Reset & Updates
-- For databases that already have all columns
-- =====================================================

-- Step 1: Set approval rights for admin roles
UPDATE `users` 
SET `can_approve` = 1 
WHERE `role` IN ('ceo', 'admin', 'hr_manager', 'finance');

-- Step 2: Set all existing equipment as 'sold' (if not already set)
UPDATE `equipment` 
SET `ownership_type` = 'sold' 
WHERE `ownership_type` IS NULL OR `ownership_type` = '';

-- Step 3: Reset admin password to 'admin123'
UPDATE `users` 
SET `password` = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu'
WHERE `email` = 'admin@aksuccess.com.my';

-- =====================================================
-- Done! You can now login with:
-- Email: admin@aksuccess.com.my
-- Password: admin123
-- =====================================================
