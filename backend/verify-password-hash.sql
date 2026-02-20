-- =====================================================
-- AK Success CRM - Password Hash Verification
-- Run these queries in phpMyAdmin to verify your setup
-- =====================================================

-- STEP 1: Check current admin user details
-- This shows what's currently in your database
SELECT 
    email, 
    name, 
    role, 
    is_active,
    LENGTH(password) as password_length,
    LEFT(password, 20) as password_start
FROM users 
WHERE email = 'admin@aksuccess.com.my';

-- Expected Results:
-- email: admin@aksuccess.com.my
-- role: admin
-- is_active: 1
-- password_length: 60
-- password_start: $2a$10$xk/bBQWa.lTG

-- =====================================================

-- STEP 2: Verify the EXACT hash is correct
-- This checks if your password hash matches exactly
SELECT 
    CASE 
        WHEN password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu' THEN 'CORRECT HASH ✓'
        ELSE 'WRONG HASH ✗'
    END as hash_status,
    email,
    is_active
FROM users 
WHERE email = 'admin@aksuccess.com.my';

-- Should show: "CORRECT HASH ✓"

-- =====================================================

-- STEP 3: Count matching records
-- This verifies the update worked
SELECT COUNT(*) as affected_rows
FROM users 
WHERE email = 'admin@aksuccess.com.my' 
AND password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu';

-- Should return: 1

-- =====================================================

-- STEP 4: If email doesn't exist, find admin users
-- Run this if above queries return no results
SELECT email, name, role, is_active 
FROM users 
WHERE role = 'admin' OR role = 'ceo'
ORDER BY email;

-- =====================================================

-- STEP 5: Check all active users
-- See all users who can login
SELECT email, name, role, department, is_active
FROM users 
WHERE is_active = 1
ORDER BY role, email;

-- =====================================================

-- If the hash is WRONG, run this to fix it:
-- UPDATE users 
-- SET password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
--     is_active = 1
-- WHERE email = 'admin@aksuccess.com.my';

-- =====================================================
-- After verification, login credentials are:
-- Email: admin@aksuccess.com.my
-- Password: admin123
-- =====================================================
