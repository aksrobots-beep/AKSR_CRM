import './load-env.js'; // load .env from project root first (must be before any module that uses process.env)
import express from 'express'; // Restart trigger
import cors from 'cors';
import { query } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { ticketRoutes } from './routes/tickets.js';
import { equipmentRoutes } from './routes/equipment.js';
import { inventoryRoutes } from './routes/inventory.js';
// HR-related imports hidden
// import { leaveRoutes } from './routes/leave.js';
import { invoiceRoutes } from './routes/invoices.js';
import { dashboardRoutes } from './routes/dashboard.js';
// import { employeeRoutes } from './routes/employees.js';
import { supplierRoutes } from './routes/suppliers.js';
import { reportRoutes } from './routes/reports.js';
import { notificationRoutes } from './routes/notifications.js';
import { visitRoutes } from './routes/visits.js';
import { authenticateToken } from './middleware/auth.js';
import { toSafeMessage } from './utils/errorResponse.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || allowed.length === 0 || allowed.includes('*') || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // allow all in practice; tighten via CORS_ORIGIN env var
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));

// Root ping — hit https://api-crm.../ or /ping to confirm Node is receiving requests
app.get('/', (req, res) => {
  res.json({ app: 'ak-crm-api', status: 'ok', health: '/api/health', healthDb: '/api/health?db=1' });
});
app.get('/ping', (req, res) => {
  res.json({ pong: true });
});

// DB connectivity check handler (reused by health routes)
const healthDbHandler = async (req, res) => {
  if (typeof query !== 'function') {
    return res.json({ ok: true, database: 'json' });
  }
  try {
    await query('SELECT 1');
    res.json({ ok: true, database: 'mysql' });
  } catch (err) {
    console.error('Health DB error:', err?.message || err, 'code:', err?.code);
    res.status(500).json({
      ok: false,
      error: err?.message || 'Database connection failed',
      code: err?.code || 'DB_ERROR',
    });
  }
};

// Health check — GET /api/health or /api/health?db=1 for DB check (works when proxy blocks /api/health/db)
// Also supports ?test=login for login diagnostic
app.get('/api/health', async (req, res) => {
  // Login diagnostic test
  if (req.query.test === 'login') {
    try {
      const bcrypt = await import('bcryptjs').then(m => m.default);
      const testEmail = process.env.DEBUG_LOGIN_EMAIL;
      const testPassword = process.env.DEBUG_LOGIN_PASSWORD;
      const logs = [];
      
      logs.push('🔍 LOGIN DIAGNOSTIC TEST');
      logs.push('========================');
      if (!testEmail || !testPassword) {
        logs.push('❌ Missing DEBUG_LOGIN_EMAIL or DEBUG_LOGIN_PASSWORD');
        logs.push('Set them in .env to run the login diagnostic.');
        return res.json({ success: false, logs });
      }
      logs.push(`Testing: ${testEmail} / ${'*'.repeat(Math.min(testPassword.length, 8))}`);
      logs.push('');
      
      // Test 1: Database connection
      logs.push('TEST 1: Database Connection');
      try {
        await query('SELECT 1');
        logs.push('✅ Database connected');
      } catch (err) {
        logs.push(`❌ Database error: ${err.message}`);
        return res.json({ success: false, logs });
      }
      logs.push('');
      
      // Test 2: Find user
      logs.push('TEST 2: Find User');
      let user = null;
      try {
        const raw = await query(
          "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
          [testEmail.toLowerCase()]
        );
        const rows = Array.isArray(raw) ? raw : [];
        user = rows[0] || null;
        
        if (user) {
          logs.push(`✅ User found: ${user.email}`);
          logs.push(`   ID: ${user.id}`);
          logs.push(`   is_active: ${user.is_active}`);
        } else {
          logs.push('❌ User not found in database');
          return res.json({ success: false, logs });
        }
      } catch (err) {
        logs.push(`❌ Query error: ${err.message}`);
        return res.json({ success: false, logs });
      }
      logs.push('');
      
      // Test 3: Check password
      logs.push('TEST 3: Password Verification');
      let pass = user.password ?? user.PASSWORD ?? '';
      if (Buffer.isBuffer(pass)) pass = pass.toString('utf8');
      else pass = String(pass);
      
      logs.push(`   Password hash: ${pass.substring(0, 29)}...`);
      logs.push(`   Hash length: ${pass.length} chars`);
      logs.push(`   Is bcrypt format: ${/^\$2[ab]\$/.test(pass) ? 'YES' : 'NO'}`);
      logs.push('');
      
      try {
        const match = bcrypt.compareSync(testPassword, pass);
        if (match) {
          logs.push('✅ PASSWORD MATCHES!');
          logs.push('');
          logs.push('🎉 LOGIN SHOULD WORK!');
          logs.push('');
          logs.push('If login still fails from frontend:');
          logs.push('1. Check frontend is sending correct email/password');
          logs.push('2. Check CORS settings in backend .env');
          logs.push('3. Check browser console for errors');
        } else {
          logs.push('❌ PASSWORD DOES NOT MATCH');
          logs.push('');
          logs.push('The password in database does not match the test password.');
          logs.push('Reset the user password and try again.');
        }
      } catch (err) {
        logs.push(`❌ Bcrypt error: ${err.message}`);
        return res.json({ success: false, logs });
      }
      
      return res.json({ success: true, logs });
    } catch (err) {
      return res.status(500).json({ 
        success: false, 
        error: err.message,
        logs: ['Fatal error during diagnostic']
      });
    }
  }
  
  // DB check
  if (req.query.db === '1' || req.query.check === 'db') {
    return healthDbHandler(req, res);
  }
  
  // SMTP diagnostic
  if (req.query.check === 'smtp') {
    const pass = process.env.SMTP_PASS || '';
    return res.json({
      smtp_host: process.env.SMTP_HOST || '(not set)',
      smtp_port: process.env.SMTP_PORT || '(not set)',
      smtp_user: process.env.SMTP_USER || '(not set)',
      smtp_pass_length: pass.length,
      smtp_pass_first2: pass.slice(0, 2),
      smtp_pass_last2: pass.slice(-2),
      smtp_secure: process.env.SMTP_SECURE || '(not set)',
      smtp_from: process.env.SMTP_FROM || '(not set)',
    });
  }

  // Default health check — version helps verify deployment
  res.json({ status: 'ok', version: '2026-03-19-v3', timestamp: new Date().toISOString(), db_name: process.env.DB_NAME || '(not set)', db_host: process.env.DB_HOST || '(not set)' });
});
app.get('/health', async (req, res) => {
  if (req.query.db === '1' || req.query.check === 'db') {
    return healthDbHandler(req, res);
  }
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dedicated DB health paths
app.get('/api/health/db', healthDbHandler);
app.get('/health/db', healthDbHandler);

// Debug endpoint - accessible via browser to diagnose login issues
app.get('/api/debug/login-test', async (req, res) => {
  try {
    const bcrypt = await import('bcryptjs').then(m => m.default);
    const testEmail = process.env.DEBUG_LOGIN_EMAIL;
    const testPassword = process.env.DEBUG_LOGIN_PASSWORD;
    const logs = [];
    
    logs.push('🔍 LOGIN DIAGNOSTIC TEST');
    logs.push('========================');
    if (!testEmail || !testPassword) {
      logs.push('❌ Missing DEBUG_LOGIN_EMAIL or DEBUG_LOGIN_PASSWORD');
      logs.push('Set them in .env to run the login diagnostic.');
      return res.json({ success: false, logs });
    }
    logs.push(`Testing: ${testEmail} / ${'*'.repeat(Math.min(testPassword.length, 8))}`);
    logs.push('');
    
    // Test 1: Database connection
    logs.push('TEST 1: Database Connection');
    try {
      await query('SELECT 1');
      logs.push('✅ Database connected');
    } catch (err) {
      logs.push(`❌ Database error: ${err.message}`);
      return res.json({ success: false, logs });
    }
    logs.push('');
    
    // Test 2: Find user
    logs.push('TEST 2: Find User');
    let user = null;
    try {
      const raw = await query(
        "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
        [testEmail.toLowerCase()]
      );
      const rows = Array.isArray(raw) ? raw : [];
      user = rows[0] || null;
      
      if (user) {
        logs.push(`✅ User found: ${user.email}`);
        logs.push(`   ID: ${user.id}`);
        logs.push(`   is_active: ${user.is_active}`);
      } else {
        logs.push('❌ User not found in database');
        return res.json({ success: false, logs });
      }
    } catch (err) {
      logs.push(`❌ Query error: ${err.message}`);
      return res.json({ success: false, logs });
    }
    logs.push('');
    
    // Test 3: Check password
    logs.push('TEST 3: Password Verification');
    let pass = user.password ?? user.PASSWORD ?? '';
    if (Buffer.isBuffer(pass)) pass = pass.toString('utf8');
    else pass = String(pass);
    
    logs.push(`   Password hash: ${pass.substring(0, 29)}...`);
    logs.push(`   Hash length: ${pass.length} chars`);
    logs.push(`   Is bcrypt format: ${/^\$2[ab]\$/.test(pass) ? 'YES' : 'NO'}`);
    logs.push('');
    
    try {
      const match = bcrypt.compareSync(testPassword, pass);
      if (match) {
        logs.push('✅ PASSWORD MATCHES!');
        logs.push('');
        logs.push('🎉 LOGIN SHOULD WORK!');
        logs.push('');
        logs.push('If login still fails from frontend:');
        logs.push('1. Check frontend is sending correct email/password');
        logs.push('2. Check CORS settings in backend .env');
        logs.push('3. Check browser console for errors');
      } else {
        logs.push('❌ PASSWORD DOES NOT MATCH');
        logs.push('');
        logs.push('The password in database does not match the test password.');
        logs.push('Reset the user password and try again.');
      }
    } catch (err) {
      logs.push(`❌ Bcrypt error: ${err.message}`);
      return res.json({ success: false, logs });
    }
    
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message,
      logs: ['Fatal error during diagnostic']
    });
  }
});

// ======================================================================
// TEMPORARY: Emergency admin reset — browser-accessible GET endpoint.
// >>> REMOVE THIS BLOCK after production login is confirmed working <<<
// Usage: GET /api/emergency-reset?secret=AK-EMERGENCY-2026-RESET
// ======================================================================
app.get('/api/emergency-reset', async (req, res) => {
  const RESET_SECRET = 'AK-EMERGENCY-2026-RESET';
  const ADMIN_EMAIL = 'admin@aksuccess.com.my';
  const NEW_PASSWORD = 'admin123';

  if (req.query.secret !== RESET_SECRET) {
    return res.status(403).json({ error: 'Append ?secret=AK-EMERGENCY-2026-RESET to URL' });
  }

  const bcrypt = await import('bcryptjs').then(m => m.default);
  const logs = [];

  try {
    logs.push('=== EMERGENCY ADMIN RESET ===');
    logs.push(`DB_HOST: ${process.env.DB_HOST || '(not set)'}`);
    logs.push(`DB_NAME: ${process.env.DB_NAME || '(not set)'}`);
    logs.push(`DB_USER: ${process.env.DB_USER || '(not set)'}`);

    if (typeof query !== 'function') {
      logs.push('ERROR: query function not available');
      return res.json({ success: false, logs });
    }

    await query('SELECT 1');
    logs.push('DB connection: OK');

    const allUsers = await query('SELECT id, email, role, is_active, LENGTH(password) as pass_len FROM users ORDER BY email');
    logs.push(`Total users: ${allUsers.length}`);
    for (const u of allUsers) {
      logs.push(`  ${u.email} | role=${u.role} | active=${u.is_active} | pass_len=${u.pass_len}`);
    }

    const rows = await query("SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1", [ADMIN_EMAIL.toLowerCase()]);
    const adminUser = (Array.isArray(rows) ? rows : [])[0] || null;

    const freshHash = bcrypt.hashSync(NEW_PASSWORD, 10);

    if (adminUser) {
      let oldHash = adminUser.password ?? '';
      if (Buffer.isBuffer(oldHash)) oldHash = oldHash.toString('utf8');
      else oldHash = String(oldHash);
      logs.push(`Admin found: id=${adminUser.id}, active=${adminUser.is_active}, hash_len=${oldHash.length}`);
      logs.push(`Old hash matches admin123: ${bcrypt.compareSync(NEW_PASSWORD, oldHash.trim())}`);

      await query("UPDATE users SET password = ?, is_active = 1, updated_at = NOW() WHERE id = ?", [freshHash, adminUser.id]);
      logs.push('Password UPDATED with fresh hash');
    } else {
      const { v4: uuidv4 } = await import('uuid');
      const newId = uuidv4();
      await query(
        "INSERT INTO users (id, email, password, name, role, department, can_approve, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
        [newId, ADMIN_EMAIL, freshHash, 'System Administrator', 'admin', 'Management', 1, 1]
      );
      logs.push(`Admin CREATED: id=${newId}`);
    }

    const verify = await query("SELECT email, is_active, LENGTH(password) as pass_len FROM users WHERE LOWER(TRIM(email)) = ?", [ADMIN_EMAIL.toLowerCase()]);
    const v = (Array.isArray(verify) ? verify : [])[0];
    if (v) logs.push(`Verified: email=${v.email}, active=${v.is_active}, pass_len=${v.pass_len}`);

    logs.push(`Login with: ${ADMIN_EMAIL} / ${NEW_PASSWORD}`);
    res.json({ success: true, logs });
  } catch (err) {
    logs.push(`ERROR: ${err.message}`);
    res.json({ success: false, error: err.message, logs });
  }
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/tickets', authenticateToken, ticketRoutes);
app.use('/api/equipment', authenticateToken, equipmentRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
// HR-related routes hidden
// app.use('/api/leave', authenticateToken, leaveRoutes);
app.use('/api/invoices', authenticateToken, invoiceRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
// app.use('/api/employees', authenticateToken, employeeRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/visits', authenticateToken, visitRoutes);

// 404 — if you get JSON here, request reached Node; if you still see "Cannot GET ...", the request never reached Node (proxy/config)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handling — return a proper message instead of generic "Internal server error"
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err?.message || err, err?.stack);
  const message = toSafeMessage(err, 'Internal server error');
  res.status(500).json({ error: message });
});

// Only listen when running directly (not on Vercel)
if (!process.env.VERCEL) {
  // Test database connection on startup
  Promise.resolve()
    .then(() => query('SELECT 1'))
    .then(() => console.log('✅ Database connected'))
    .catch((err) => {
      console.error('❌ Database not connected:', err.message);
      if (err.code) console.error('   Code:', err.code);
      console.error('   Check backend/.env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME');
      console.error('   Run from backend folder: node validate-db-connection.js');
    });

  app.listen(PORT, () => {
    console.log(`🚀 AK Success CRM API running on http://localhost:${PORT}`);
  });
}

export default app;
