import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findOne, findAll, insert, query } from '../db/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const e = String(email || '').trim();
    const p = String(password || '');

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
        console.error('Login DB error:', dbErr?.message || dbErr, 'code:', dbErr?.code);
        return res.status(500).json({
          error: 'Login failed',
          message: dbErr?.message || 'Database error',
          code: dbErr?.code || 'DB_ERROR',
        });
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
      if (process.env.DEBUG_LOGIN === '1') console.log('[DEBUG_LOGIN] No user found for:', e);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let pass = user.password ?? user.PASSWORD ?? user.Password ?? '';
    if (Buffer.isBuffer(pass)) pass = pass.toString('utf8');
    else pass = String(pass);
    if (!/^\$2[ab]\$/.test(pass)) {
      console.warn(`Login: password for ${e} does not look like bcrypt ($2a$...). Check DB.`);
    }
    let validPassword = false;
    try {
      validPassword = bcrypt.compareSync(p, pass);
    } catch (bcryptErr) {
      console.error('Login bcrypt error:', bcryptErr.message, 'for', e);
      return res.status(500).json({
        error: 'Login failed',
        message: bcryptErr?.message || 'Invalid password hash in DB. Use bcrypt ($2a$10$...).',
        code: bcryptErr?.code || 'BCRYPT_ERROR',
      });
    }
    if (!validPassword) {
      if (process.env.DEBUG_LOGIN === '1') console.log('[DEBUG_LOGIN] Bad password for:', e);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const u = (k) => user[k] ?? user[k.toUpperCase()];
    let token;
    try {
      token = generateToken({ id: u('id'), email: u('email'), role: u('role') });
    } catch (tokenErr) {
      console.error('Login token error:', tokenErr?.message || tokenErr);
      return res.status(500).json({
        error: 'Login failed',
        message: tokenErr?.message || 'Token generation failed',
        code: tokenErr?.code || 'TOKEN_ERROR',
      });
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
      },
    });
  } catch (error) {
    console.error('Login error:', error?.message || error);
    if (error?.stack) console.error(error.stack);
    res.status(500).json({
      error: 'Login failed',
      message: error?.message || String(error),
      code: error?.code || 'LOGIN_ERROR',
    });
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
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
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
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
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
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export { router as authRoutes };
