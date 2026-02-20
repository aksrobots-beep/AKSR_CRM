# User Management API Reference

Quick reference for admin user management endpoints.

## Authentication
All endpoints require authentication with `admin` or `ceo` role.

```
Authorization: Bearer <token>
```

---

## 1. List All Users
**GET** `/api/auth/users`

Returns all users with their basic information.

**Response:**
```json
[
  {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "finance",
    "department": "Finance",
    "is_active": 1,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

## 2. Create New User
**POST** `/api/auth/register`

Create a new user account.

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "securePassword123",
  "role": "finance",
  "department": "Finance"
}
```

**Response:**
```json
{
  "id": "new-user-id",
  "email": "newuser@example.com",
  "name": "New User",
  "role": "finance",
  "department": "Finance",
  "is_active": 1,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

---

## 3. Edit User Details
**PUT** `/api/auth/users/:id`

Update user's basic information (name, email, department, phone, avatar).

**Request:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "department": "Finance Department",
  "phone": "+60 12-345 6789",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "id": "user-id",
  "email": "updated@example.com",
  "name": "Updated Name",
  "role": "finance",
  "department": "Finance Department",
  "phone": "+60 12-345 6789",
  "avatar": "https://example.com/avatar.jpg",
  "can_approve": true,
  "is_active": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-02T00:00:00.000Z"
}
```

**Validations:**
- Email must be unique (returns 400 if duplicate)
- All fields are optional
- Only provided fields will be updated

---

## 4. Update User Permissions
**PUT** `/api/auth/users/:id/permissions`

Change user's role, department, approval permissions, and account status.

**Request:**
```json
{
  "role": "hr_manager",
  "department": "Human Resources",
  "can_approve": true,
  "is_active": true
}
```

**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "hr_manager",
  "department": "Human Resources",
  "can_approve": true,
  "is_active": 1,
  "updated_at": "2024-01-02T00:00:00.000Z"
}
```

**Valid Roles:**
- `ceo`
- `admin`
- `hr_manager`
- `finance`
- `service_manager`
- `technician`

**Safety Rules:**
- Admin cannot demote themselves from admin/CEO role
- Invalid roles are rejected with 400 error
- User must re-login to see permission changes

---

## 5. Delete User
**DELETE** `/api/auth/users/:id`

Deactivate a user account (soft delete - preserves data).

**Response:**
```json
{
  "message": "User deactivated successfully",
  "id": "user-id"
}
```

**Safety Rules:**
- Cannot delete your own account
- Performs soft delete (sets `is_active = 0`)
- User data is preserved
- User cannot login but data remains in database

---

## Quick Examples

### Promote User with Approval Rights
```bash
# 1. Update permissions
PUT /api/auth/users/{user-id}/permissions
{
  "role": "finance",
  "can_approve": true
}

# 2. Update department name
PUT /api/auth/users/{user-id}
{
  "department": "Finance Department"
}
```

### Complete User Setup Flow
```bash
# 1. Create user
POST /api/auth/register
{
  "email": "john@example.com",
  "name": "John Doe",
  "password": "secure123",
  "role": "technician",
  "department": "Service"
}

# 2. Update details
PUT /api/auth/users/{new-user-id}
{
  "phone": "+60 12-345 6789"
}

# 3. Later, promote to manager with approval
PUT /api/auth/users/{new-user-id}/permissions
{
  "role": "service_manager",
  "can_approve": true
}
```

### Deactivate and Reactivate User
```bash
# Deactivate
DELETE /api/auth/users/{user-id}

# Reactivate later
PUT /api/auth/users/{user-id}/permissions
{
  "is_active": true
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Email already exists"
}
```

### 403 Forbidden
```json
{
  "error": "Permission denied"
}
```

### 404 Not Found
```json
{
  "error": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to update user",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

---

## Testing with cURL

```bash
# Set your admin token
TOKEN="your-admin-token-here"

# List users
curl -X GET http://localhost:3001/api/auth/users \
  -H "Authorization: Bearer $TOKEN"

# Edit user
curl -X PUT http://localhost:3001/api/auth/users/{user-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","department":"Finance"}'

# Update permissions
curl -X PUT http://localhost:3001/api/auth/users/{user-id}/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"finance","can_approve":true}'

# Delete user
curl -X DELETE http://localhost:3001/api/auth/users/{user-id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Notes

1. **Soft Delete**: Delete endpoint deactivates users (sets `is_active = 0`) rather than removing from database
2. **Token Refresh**: Users must re-login after permission changes to get updated JWT
3. **Email Uniqueness**: System prevents duplicate emails across all users
4. **Self-Protection**: Admins cannot delete or demote themselves
5. **Audit Trail**: All updates include `updated_at` timestamp
