-- =====================================================
-- DIAGNOSTIC: Check what's in the database
-- Run this to see the current admin user details
-- =====================================================

-- Check if admin user exists and what email it has
SELECT id, email, name, role, is_active, created_at
FROM users 
WHERE email LIKE '%admin%' OR role = 'admin';

-- Check the exact email you're trying to login with
SELECT id, email, name, role, is_active,
       LEFT(password, 20) as password_hash_start
FROM users 
WHERE email = 'admin@aksuccess.com.my';

-- Check all active users
SELECT email, name, role, is_active 
FROM users 
WHERE is_active = 1
ORDER BY role;
