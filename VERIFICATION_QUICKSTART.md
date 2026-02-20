# Password Hash Verification - Quick Start

## What You Need to Verify

Your production database should have this **exact** bcrypt hash for admin123:

```
$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu
```

## 3-Step Verification Process

### Step 1: Check Database (2 minutes)

Open phpMyAdmin → Select database `aksucce2_crm` → SQL tab

Run this query:
```sql
SELECT 
    CASE 
        WHEN password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu' 
        THEN 'CORRECT ✓'
        ELSE 'WRONG ✗'
    END as status
FROM users WHERE email = 'admin@aksuccess.com.my';
```

**Result:**
- ✅ Shows "CORRECT ✓" → Go to Step 2
- ❌ Shows "WRONG ✗" or no results → Run the fix below

**Fix (if needed):**
```sql
UPDATE users 
SET password = '$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu',
    is_active = 1
WHERE email = 'admin@aksuccess.com.my';
```

---

### Step 2: Test API with Postman (1 minute)

**Import Collection:**
1. Open Postman
2. Import → File → Select `postman-login-test.json`
3. Run "2. Login - Admin"

**Or create manually:**
- Method: POST
- URL: `https://api-crm.aksuccessrobotics.com.my/api/auth/login`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
  ```json
  {
    "email": "admin@aksuccess.com.my",
    "password": "admin123"
  }
  ```

**Expected Response:**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "email": "admin@aksuccess.com.my",
    "role": "admin"
  }
}
```

---

### Step 3: Test Frontend (30 seconds)

1. Open: https://crm.aksuccessrobotics.com.my/login
2. Enter:
   - Email: `admin@aksuccess.com.my`
   - Password: `admin123`
3. Click "Sign In"

✅ Should redirect to dashboard

---

## Files Created for You

| File | Purpose |
|------|---------|
| `backend/verify-password-hash.sql` | Complete SQL verification queries |
| `PRODUCTION_LOGIN_TEST.md` | Detailed testing guide |
| `postman-login-test.json` | Postman collection (import ready) |
| `VERIFICATION_QUICKSTART.md` | This file |

---

## Still Not Working?

### Check 1: Backend URL
Make sure you're using the **API** URL, not the frontend URL:
- ✅ Correct: `https://api-crm.aksuccessrobotics.com.my/api/auth/login`
- ❌ Wrong: `https://crm.aksuccessrobotics.com.my/login`

### Check 2: Email Exists
Maybe the user has a different email:
```sql
SELECT email, name, role FROM users WHERE role = 'admin';
```

Use the email shown in results.

### Check 3: Backend Running
Test health endpoint:
```
GET https://api-crm.aksuccessrobotics.com.my/api/health
```

Should return: `{"status":"ok",...}`

---

## Summary

✅ **Database hash:** `$2a$10$xk/bBQWa.lTG0khu.aYA0eP0Jhv6Ormq6YtJk9jvF90ZVeIF64tPu`  
✅ **Email:** `admin@aksuccess.com.my`  
✅ **Password:** `admin123`  
✅ **API Endpoint:** `POST https://api-crm.aksuccessrobotics.com.my/api/auth/login`

**Start with Step 1 above! ☝️**
