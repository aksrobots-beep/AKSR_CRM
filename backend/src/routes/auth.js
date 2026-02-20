import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findOne, findAll, insert, update, query } from '../db/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();

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
