# Production Login Testing Guide

## Current Password Hash

The correct bcrypt hash for password `admin123`:
```
$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu
```

## Step-by-Step Verification

### 1. Verify Database (phpMyAdmin)

Open `verify-password-hash.sql` and run each query:

**Query 1: Check user exists**
```sql
SELECT email, name, role, is_active, LENGTH(password) as password_length
FROM users WHERE email = 'admin@aksuccess.com.my';
```

✅ Expected: 1 row, `is_active = 1`, `password_length = 60`

**Query 2: Verify exact hash**
```sql
SELECT 
    CASE 
        WHEN password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu' 
        THEN 'CORRECT HASH ✓'
        ELSE 'WRONG HASH ✗'
    END as hash_status
FROM users WHERE email = 'admin@aksuccess.com.my';
```

✅ Expected: Shows "CORRECT HASH ✓"

---

### 2. Test Backend API (Postman)

#### Test API Health
**GET** `https://api-crm.aksuccessrobotics.com.my/api/health`

✅ Expected Response:
```json
{"status":"ok","timestamp":"2026-02-19T..."}
```

#### Test Login
**POST** `https://api-crm.aksuccessrobotics.com.my/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "admin@aksuccess.com.my",
  "password": "admin123"
}
```

✅ **Expected Success Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@aksuccess.com.my",
    "name": "...",
    "role": "admin",
    "department": "Management",
    "can_approve": true
  }
}
```

❌ **Error Responses:**

**401 Unauthorized:**
```json
{"error": "Invalid credentials"}
```
→ Password hash is wrong or user not found

**500 Internal Server Error:**
```json
{"error": "Database connection failed"}
```
→ Backend can't connect to database

---

### 3. Test Frontend Login

Open: `https://crm.aksuccessrobotics.com.my/login`

**Credentials:**
- Email: `admin@aksuccess.com.my`
- Password: `admin123`

✅ Expected: Redirects to dashboard

---

## Troubleshooting

### Issue 1: "Invalid credentials" in Postman
**Cause:** Password hash doesn't match

**Fix:**
```sql
UPDATE users 
SET password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
    is_active = 1
WHERE email = 'admin@aksuccess.com.my';
```

### Issue 2: Frontend login fails but Postman works
**Cause:** CORS issue

**Fix:** Check backend `.env`:
```
CORS_ORIGIN=https://crm.aksuccessrobotics.com.my
```

### Issue 3: User not found
**Cause:** Email doesn't exist

**Find actual admin email:**
```sql
SELECT email, name, role FROM users WHERE role = 'admin';
```

Use the email found in the results.

### Issue 4: Backend not responding
**Cause:** Backend server not running or wrong URL

**Check:**
1. Backend should be at: `https://api-crm.aksuccessrobotics.com.my`
2. Test health endpoint: `https://api-crm.aksuccessrobotics.com.my/api/health`

---

## Quick Reference

| What | Value |
|------|-------|
| **Email** | admin@aksuccess.com.my |
| **Password** | admin123 |
| **Hash** | $2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu |
| **Backend API** | https://api-crm.aksuccessrobotics.com.my |
| **Frontend** | https://crm.aksuccessrobotics.com.my |
| **Login Endpoint** | POST /api/auth/login |

---

## Files Created

1. `verify-password-hash.sql` - SQL queries for database verification
2. `PRODUCTION_LOGIN_TEST.md` - This testing guide
3. `postman-login-test.json` - Postman collection (optional)
