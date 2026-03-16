import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { findOne, findAll, insert, update, query } from '../db/index.js';
import { getConnection } from '../db/mysql.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();
const FORGOT_GENERIC_MESSAGE = 'If an account exists for this email, a reset link has been sent.';
const RESET_TOKEN_BYTES = parseInt(process.env.RESET_TOKEN_BYTES || '32', 10);
const RESET_TOKEN_EXPIRES_MINUTES = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '30', 10);
const FORGOT_RATE_LIMIT_EMAIL_MAX = parseInt(process.env.FORGOT_RATE_LIMIT_EMAIL_MAX || '3', 10);
const FORGOT_RATE_LIMIT_EMAIL_WINDOW_MINUTES = parseInt(process.env.FORGOT_RATE_LIMIT_EMAIL_WINDOW_MINUTES || '30', 10);
const FORGOT_RATE_LIMIT_IP_MAX = parseInt(process.env.FORGOT_RATE_LIMIT_IP_MAX || '5', 10);
const FORGOT_RATE_LIMIT_IP_WINDOW_MINUTES = parseInt(process.env.FORGOT_RATE_LIMIT_IP_WINDOW_MINUTES || '15', 10);

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function getResetBaseUrl(req) {
  const envBase =
    process.env.RESET_PASSWORD_BASE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  const host = req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

async function findActiveUserByEmail(email) {
  const rows = await query(
    `SELECT id, email, name, is_active
     FROM users
     WHERE LOWER(TRIM(email)) = ?
     LIMIT 1`,
    [email]
  );
  const user = Array.isArray(rows) ? rows[0] : null;
  if (!user) return null;
  const active = user.is_active === 1 || user.is_active === true || String(user.is_active) === '1';
  return active ? user : null;
}

async function isForgotRateLimited(email, ipAddress) {
  const now = Date.now();
  const emailWindowStart = toSqlDateTime(new Date(now - FORGOT_RATE_LIMIT_EMAIL_WINDOW_MINUTES * 60 * 1000));
  const ipWindowStart = toSqlDateTime(new Date(now - FORGOT_RATE_LIMIT_IP_WINDOW_MINUTES * 60 * 1000));

  const emailCountRows = await query(
    `SELECT COUNT(*) AS count
     FROM password_reset_tokens
     WHERE request_email = ? AND created_at >= ?`,
    [email, emailWindowStart]
  );
  const emailCount = Number(emailCountRows?.[0]?.count || 0);
  if (emailCount >= FORGOT_RATE_LIMIT_EMAIL_MAX) {
    return true;
  }

  if (ipAddress) {
    const ipCountRows = await query(
      `SELECT COUNT(*) AS count
       FROM password_reset_tokens
       WHERE request_ip = ? AND created_at >= ?`,
      [ipAddress, ipWindowStart]
    );
    const ipCount = Number(ipCountRows?.[0]?.count || 0);
    if (ipCount >= FORGOT_RATE_LIMIT_IP_MAX) {
      return true;
    }
  }

  return false;
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const e = String(email || '').trim();
    const p = String(password || '');

    // DEBUG: Log what we received (remove after fixing)
    console.log('[LOGIN DEBUG] Received email:', JSON.stringify(e));
    console.log('[LOGIN DEBUG] Received password length:', p.length);
    console.log('[LOGIN DEBUG] Email after trim:', JSON.stringify(e));

    if (!e || !p) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Match email case-insensitively; accept is_active 1, true, or '1'
    let user = null;
    if (typeof query === 'function') {
      try {
        const raw = await query(
          "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
          [e.toLowerCase()]
        );
        const rows = Array.isArray(raw) ? raw : [];
        const row = rows[0] || null;
        if (row) {
          const a = row.is_active ?? row.IS_ACTIVE;
          const inactive = a === 0 || a === '0' || a === false;
          if (!inactive) user = row;
        }
      } catch (dbErr) {
        return send500(res, 'Login failed', dbErr);
      }
    } else {
      user = await findOne('users', u => {
        const uEmail = String(u.email || u.EMAIL || '').trim().toLowerCase();
        const uActive = u.is_active ?? u.IS_ACTIVE;
        const active = uActive === 1 || uActive === true || String(uActive) === '1';
        return uEmail === e.toLowerCase() && active;
      });
    }

    if (!user) {
      console.log('[LOGIN DEBUG] No user found for email:', e);
      if (process.env.DEBUG_LOGIN === '1') console.log('[DEBUG_LOGIN] No user found for:', e);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[LOGIN DEBUG] User found:', user.email, 'ID:', user.id);

    let pass = user.password ?? user.PASSWORD ?? user.Password ?? '';
    if (Buffer.isBuffer(pass)) pass = pass.toString('utf8').trim();
    else pass = String(pass).trim();
    console.log('[LOGIN DEBUG] Password hash from DB:', pass.substring(0, 20) + '...');
    if (!/^\$2[ab]\$/.test(pass)) {
      console.warn(`Login: password for ${e} does not look like bcrypt ($2a$...). Check DB.`);
    }
    let validPassword = false;
    try {
      validPassword = bcrypt.compareSync(p, pass);
      console.log('[LOGIN DEBUG] Password match result:', validPassword);
    } catch (bcryptErr) {
      console.error('[LOGIN DEBUG] Bcrypt error:', bcryptErr.message);
      return send500(res, 'Login failed', bcryptErr);
    }
    if (!validPassword) {
      console.log('[LOGIN DEBUG] Password does not match for:', e);
      if (process.env.DEBUG_LOGIN === '1') console.log('[DEBUG_LOGIN] Bad password for:', e);
      return res.status(401).json({ error: 'Invalid credentials password does not match' });
    }

    const u = (k) => user[k] ?? user[k.toUpperCase()];
    let token;
    try {
      token = generateToken({ id: u('id'), email: u('email'), role: u('role') });
    } catch (tokenErr) {
      return send500(res, 'Login failed', tokenErr);
    }

    res.json({
      token,
      user: {
        id: u('id'),
        email: u('email'),
        name: u('name'),
        role: u('role'),
        department: u('department'),
        avatar: u('avatar'),
        can_approve: u('can_approve') === 1 || u('can_approve') === true,
      },
    });
  } catch (error) {
    send500(res, 'Login failed', error);
  }
});

// Forgot password request (public)
router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const ipAddress = getClientIp(req);
    const userAgent = String(req.get('user-agent') || '').slice(0, 255);

    if (!email) {
      return res.json({ message: FORGOT_GENERIC_MESSAGE });
    }

    const limited = await isForgotRateLimited(email, ipAddress);
    if (limited) {
      return res.status(429).json({ error: 'Too many reset requests. Please try again later.' });
    }

    const user = await findActiveUserByEmail(email);

    if (!user) {
      await insert('password_reset_tokens', {
        id: uuidv4(),
        user_id: null,
        request_email: email,
        token_hash: null,
        request_ip: ipAddress,
        user_agent: userAgent,
        expires_at: null,
        used_at: null,
        invalidated_at: null,
      });
      return res.json({ message: FORGOT_GENERIC_MESSAGE });
    }

    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = toSqlDateTime(new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000));

    await query(
      `UPDATE password_reset_tokens
       SET invalidated_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND used_at IS NULL AND invalidated_at IS NULL`,
      [user.id]
    );

    await insert('password_reset_tokens', {
      id: uuidv4(),
      user_id: user.id,
      request_email: email,
      token_hash: tokenHash,
      request_ip: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt,
      used_at: null,
      invalidated_at: null,
    });

    const resetBaseUrl = getResetBaseUrl(req);
    const resetLink = `${resetBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetLink,
        expiresMinutes: RESET_TOKEN_EXPIRES_MINUTES,
      });
    } catch (mailErr) {
      console.error('[forgot-password] Failed to send reset email:', mailErr?.message || mailErr);
    }

    return res.json({ message: FORGOT_GENERIC_MESSAGE });
  } catch (error) {
    return send500(res, 'Forgot password failed', error);
  }
});

// Reset token validation (public)
router.get('/reset-password/validate', async (req, res) => {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) {
      return res.json({ valid: false, message: 'Reset link is invalid or expired.' });
    }

    const tokenHash = hashResetToken(token);
    const rows = await query(
      `SELECT prt.id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.invalidated_at IS NULL
         AND prt.expires_at > NOW()
         AND (u.is_active = 1 OR u.is_active = true)
       LIMIT 1`,
      [tokenHash]
    );

    return res.json({
      valid: Array.isArray(rows) && rows.length > 0,
      message: Array.isArray(rows) && rows.length > 0 ? 'Token is valid.' : 'Reset link is invalid or expired.',
    });
  } catch (error) {
    return send500(res, 'Failed to validate reset link', error);
  }
});

// Reset password with token (public)
router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Token and passwords are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const tokenHash = hashResetToken(token);
  const pool = await getConnection();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [tokenRows] = await conn.execute(
      `SELECT prt.id, prt.user_id, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.invalidated_at IS NULL
         AND prt.expires_at > NOW()
         AND (u.is_active = 1 OR u.is_active = true)
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );

    const tokenRow = Array.isArray(tokenRows) ? tokenRows[0] : null;
    if (!tokenRow) {
      await conn.rollback();
      return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await conn.execute(
      `UPDATE users
       SET password = ?, updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, tokenRow.user_id]
    );

    await conn.execute(
      `UPDATE password_reset_tokens
       SET used_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [tokenRow.id]
    );

    await conn.execute(
      `UPDATE password_reset_tokens
       SET invalidated_at = NOW(), updated_at = NOW()
       WHERE user_id = ?
         AND id <> ?
         AND used_at IS NULL
         AND invalidated_at IS NULL`,
      [tokenRow.user_id, tokenRow.id]
    );

    await conn.execute(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, new_value, user_id, ip_address)
       VALUES (?, 'users', ?, 'password_reset', ?, ?, ?)`,
      [
        uuidv4(),
        tokenRow.user_id,
        JSON.stringify({ source: 'forgot_password' }),
        tokenRow.user_id,
        getClientIp(req),
      ]
    );

    await conn.commit();
    return res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    await conn.rollback();
    return send500(res, 'Failed to reset password', error);
  } finally {
    conn.release();
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await findOne('users', u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      can_approve: user.can_approve === 1 || user.can_approve === true,
    });
  } catch (error) {
    send500(res, 'Failed to get user', error);
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const all = await findAll('users');
    const users = all.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      department: u.department,
      is_active: u.is_active,
      created_at: u.created_at,
    }));
    res.json(users);
  } catch (error) {
    send500(res, 'Failed to get users', error);
  }
});

// Register new user (admin only)
router.post('/register', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission
    if (!['ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { email, name, password, role, department } = req.body;

    if (!email || !name || !password || !role) {
      return res.status(400).json({ error: 'Email, name, password, and role are required' });
    }

    // Check if email already exists
    const existingUser = await findOne('users', u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const now = new Date().toISOString();
    const hashedPassword = bcrypt.hashSync(password, 10);

    const user = {
      id: uuidv4(),
      email,
      name,
      password: hashedPassword,
      role,
      department: department || '',
      is_active: 1,
      created_at: now,
      updated_at: now,
    };

    await insert('users', user);

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  } catch (error) {
    send500(res, 'Failed to create user', error);
  }
});

// Update user details (admin only)
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission
    if (!['ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { name, email, department, phone, avatar } = req.body;
    
    // Check if user exists
    const existingUser = await findOne('users', u => u.id === req.params.id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== existingUser.email) {
      const emailExists = await findOne('users', u => u.email === email && u.id !== req.params.id);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now };

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (department !== undefined) updates.department = department;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    const updatedUser = await update('users', req.params.id, updates);

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      department: updatedUser.department,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      can_approve: updatedUser.can_approve === 1 || updatedUser.can_approve === true,
      is_active: updatedUser.is_active,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
    });
  } catch (error) {
    send500(res, 'Failed to update user', error);
  }
});

// Update user permissions (admin only)
router.put('/users/:id/permissions', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission
    if (!['ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { role, department, can_approve, is_active } = req.body;
    
    // Validate role if provided
    const validRoles = ['ceo', 'admin', 'service_manager', 'technician', 'hr_manager', 'finance'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Valid roles: ' + validRoles.join(', ') });
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now };

    if (role !== undefined) updates.role = role;
    if (department !== undefined) updates.department = department;
    if (can_approve !== undefined) updates.can_approve = can_approve ? 1 : 0;
    if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;

    // Check if user exists
    const existingUser = await findOne('users', u => u.id === req.params.id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion for admins/CEOs
    if (req.user.id === req.params.id && role && !['ceo', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Cannot change your own admin/CEO role' });
    }

    const updatedUser = await update('users', req.params.id, updates);

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      department: updatedUser.department,
      can_approve: updatedUser.can_approve === 1 || updatedUser.can_approve === true,
      is_active: updatedUser.is_active,
      updated_at: updatedUser.updated_at,
    });
  } catch (error) {
    send500(res, 'Failed to update user permissions', error);
  }
});

// Delete user (admin only) - deactivates instead of hard delete
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission
    if (!['ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Check if user exists
    const existingUser = await findOne('users', u => u.id === req.params.id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-deletion
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const now = new Date().toISOString();
    
    // Soft delete: deactivate user instead of removing from database
    await update('users', req.params.id, { 
      is_active: 0, 
      updated_at: now 
    });

    res.json({ 
      message: 'User deactivated successfully',
      id: req.params.id 
    });
  } catch (error) {
    send500(res, 'Failed to delete user', error);
  }
});

// ======================================================================
// TEMPORARY: Emergency admin password reset & diagnostic endpoint.
// >>> REMOVE THIS ENTIRE BLOCK after production login is confirmed working <<<
// ======================================================================
router.post('/emergency-reset', async (req, res) => {
  const RESET_SECRET = 'AK-EMERGENCY-2026-RESET';
  const ADMIN_EMAIL = 'admin@aksuccess.com.my';
  const NEW_PASSWORD = 'admin123';

  try {
    const { secret } = req.body;
    if (secret !== RESET_SECRET) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }

    const logs = [];
    logs.push('=== EMERGENCY ADMIN RESET DIAGNOSTIC ===');
    logs.push('');

    // 1. Environment info
    logs.push('STEP 1: Environment');
    logs.push(`  DB_HOST: ${process.env.DB_HOST || '(not set)'}`);
    logs.push(`  DB_NAME: ${process.env.DB_NAME || '(not set)'}`);
    logs.push(`  DB_USER: ${process.env.DB_USER || '(not set)'}`);
    logs.push(`  DB_PORT: ${process.env.DB_PORT || '(not set)'}`);
    logs.push(`  NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
    logs.push('');

    // 2. Test DB connection
    logs.push('STEP 2: Database Connection');
    if (typeof query !== 'function') {
      logs.push('  SKIP: query function not available (JSON mode)');
      return res.json({ success: false, logs });
    }
    try {
      await query('SELECT 1');
      logs.push('  OK: Database connected successfully');
    } catch (dbErr) {
      logs.push(`  FAIL: ${dbErr.message}`);
      return res.json({ success: false, logs });
    }
    logs.push('');

    // 3. List all users
    logs.push('STEP 3: All Users in Database');
    let allUsers = [];
    try {
      allUsers = await query('SELECT id, email, name, role, is_active, LENGTH(password) as pass_len, SUBSTRING(password, 1, 10) as pass_prefix FROM users ORDER BY email');
      if (!allUsers.length) {
        logs.push('  WARNING: users table is EMPTY');
      }
      for (const u of allUsers) {
        logs.push(`  - ${u.email} | role=${u.role} | active=${u.is_active} | pass_len=${u.pass_len} | pass_prefix=${u.pass_prefix}...`);
      }
    } catch (err) {
      logs.push(`  FAIL: ${err.message}`);
    }
    logs.push('');

    // 4. Find admin user
    logs.push('STEP 4: Find Admin User');
    let adminUser = null;
    try {
      const rows = await query(
        "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
        [ADMIN_EMAIL.toLowerCase()]
      );
      adminUser = (Array.isArray(rows) ? rows : [])[0] || null;
    } catch (err) {
      logs.push(`  FAIL: ${err.message}`);
    }

    if (adminUser) {
      logs.push(`  FOUND: id=${adminUser.id}, email=${adminUser.email}, is_active=${adminUser.is_active}`);
      let existingHash = adminUser.password ?? adminUser.PASSWORD ?? '';
      if (Buffer.isBuffer(existingHash)) existingHash = existingHash.toString('utf8');
      else existingHash = String(existingHash);
      logs.push(`  Current hash (raw length): ${existingHash.length}`);
      logs.push(`  Current hash (trimmed length): ${existingHash.trim().length}`);
      logs.push(`  Current hash: ${existingHash.substring(0, 30)}...`);
      logs.push(`  Whitespace issue: ${existingHash.length !== existingHash.trim().length ? 'YES — trailing whitespace detected!' : 'No'}`);

      const oldMatch = bcrypt.compareSync(NEW_PASSWORD, existingHash.trim());
      logs.push(`  Old hash matches '${NEW_PASSWORD}' (after trim): ${oldMatch}`);
    } else {
      logs.push(`  NOT FOUND: No user with email ${ADMIN_EMAIL}`);
    }
    logs.push('');

    // 5. Generate fresh hash and update/insert
    logs.push('STEP 5: Generate Fresh Hash & Update');
    const freshHash = bcrypt.hashSync(NEW_PASSWORD, 10);
    logs.push(`  Fresh hash: ${freshHash}`);
    logs.push(`  Fresh hash length: ${freshHash.length}`);

    const verifyMatch = bcrypt.compareSync(NEW_PASSWORD, freshHash);
    logs.push(`  Self-verify (hash matches '${NEW_PASSWORD}'): ${verifyMatch}`);

    if (adminUser) {
      try {
        await query(
          "UPDATE users SET password = ?, is_active = 1, updated_at = NOW() WHERE id = ?",
          [freshHash, adminUser.id]
        );
        logs.push(`  UPDATED: Password reset for ${ADMIN_EMAIL} (id: ${adminUser.id})`);
      } catch (err) {
        logs.push(`  UPDATE FAIL: ${err.message}`);
        return res.json({ success: false, logs });
      }
    } else {
      const newId = uuidv4();
      try {
        await query(
          "INSERT INTO users (id, email, password, name, role, department, can_approve, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
          [newId, ADMIN_EMAIL, freshHash, 'System Administrator', 'admin', 'Management', 1, 1]
        );
        logs.push(`  INSERTED: New admin user created (id: ${newId})`);
      } catch (err) {
        logs.push(`  INSERT FAIL: ${err.message}`);
        return res.json({ success: false, logs });
      }
    }
    logs.push('');

    // 6. Verify the write
    logs.push('STEP 6: Verify Write');
    try {
      const verify = await query(
        "SELECT id, email, is_active, LENGTH(password) as pass_len, SUBSTRING(password, 1, 30) as pass_prefix FROM users WHERE LOWER(TRIM(email)) = ?",
        [ADMIN_EMAIL.toLowerCase()]
      );
      const v = (Array.isArray(verify) ? verify : [])[0];
      if (v) {
        logs.push(`  OK: email=${v.email}, active=${v.is_active}, pass_len=${v.pass_len}, prefix=${v.pass_prefix}...`);
      } else {
        logs.push('  FAIL: User not found after write');
      }
    } catch (err) {
      logs.push(`  FAIL: ${err.message}`);
    }
    logs.push('');
    logs.push(`Login with: ${ADMIN_EMAIL} / ${NEW_PASSWORD}`);

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export { router as authRoutes };
