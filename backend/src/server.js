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
import { pushTokenRoutes } from './routes/pushTokens.js';
import { messageLogsRoutes } from './routes/messageLogs.js';
import { activityLogsRoutes } from './routes/activityLogs.js';
import { visitRoutes } from './routes/visits.js';
import { salesModuleRoutes } from './routes/salesModule.js';
import { taskRoutes } from './routes/tasks.js';
import { taskDiaryRoutes } from './routes/taskDiary.js';
import { taskReportRoutes } from './routes/taskReports.js';
import { microsoftTodoRoutes } from './routes/microsoftTodo.js';
import { runTaskReminderSweep } from './services/taskReminders.js';
import { authenticateToken } from './middleware/auth.js';
import { requireRole } from './middleware/auth.js';
import { toSafeMessage } from './utils/errorResponse.js';
import { isDebugRoutesEnabled } from './utils/debugRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin) {
      return callback(null, true);
    }
    if (allowed.includes('*')) {
      return callback(null, true);
    }
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    if (allowed.length === 0 && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
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
const appEnvLabel =
  process.env.APP_ENV || (process.env.VERCEL && process.env.NODE_ENV === 'production' ? 'production' : 'development');

function wantsDbHealthCheck(queryObj) {
  const d = queryObj?.db;
  if (d === '1' || d === 1 || d === true) return true;
  if (Array.isArray(d)) return d.some((x) => x === '1' || x === 1);
  if (typeof d === 'string' && d.trim() === '1') return true;
  return queryObj?.check === 'db';
}

const dbEngineLabel = () =>
  (process.env.DB_ENGINE || 'mysql').toLowerCase() === 'postgres' ? 'postgres' : 'mysql';

const healthDbHandler = async (req, res) => {
  if (typeof query !== 'function') {
    return res.json({ ok: true, database: 'json', app_env: appEnvLabel });
  }
  try {
    await query('SELECT 1');
    res.json({
      ok: true,
      database: dbEngineLabel(),
      app_env: appEnvLabel,
      db_name: process.env.DB_NAME || '(not set)',
      db_host: process.env.DB_HOST || '(not set)',
    });
  } catch (err) {
    console.error('Health DB error:', err?.message || err, 'code:', err?.code);
    res.status(500).json({
      ok: false,
      error: err?.message || 'Database connection failed',
      code: err?.code || 'DB_ERROR',
      app_env: appEnvLabel,
    });
  }
};

// Health check — GET /api/health or /api/health?db=1 for DB check (works when proxy blocks /api/health/db)
// Also supports ?test=login for login diagnostic
app.get('/api/health', async (req, res) => {
  // Login diagnostic test
  if (req.query.test === 'login') {
    if (!isDebugRoutesEnabled()) {
      return res.status(404).json({ error: 'Not found' });
    }
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
  if (wantsDbHealthCheck(req.query)) {
    return healthDbHandler(req, res);
  }
  
  // SMTP diagnostic
  if (req.query.check === 'smtp') {
    if (!isDebugRoutesEnabled()) {
      return res.status(404).json({ error: 'Not found' });
    }
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
  res.json({
    status: 'ok',
    version: '2026-03-19-v3',
    timestamp: new Date().toISOString(),
    app_env: appEnvLabel,
    db_name: process.env.DB_NAME || '(not set)',
    db_host: process.env.DB_HOST || '(not set)',
  });
});
app.get('/health', async (req, res) => {
  if (wantsDbHealthCheck(req.query)) {
    return healthDbHandler(req, res);
  }
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app_env: appEnvLabel });
});

// Dedicated DB health paths
app.get('/api/health/db', healthDbHandler);
app.get('/health/db', healthDbHandler);

// Debug endpoint - accessible via browser to diagnose login issues (non-production or ENABLE_DEBUG_ROUTES=1)
app.get('/api/debug/login-test', async (req, res) => {
  if (!isDebugRoutesEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
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

// Quick check you are on this API (wrong process on PORT often returns HTML 404 for /api/auth/login)
app.get('/api', (req, res) => {
  res.json({
    app: 'ak-crm-api',
    auth: { login: 'POST /api/auth/login' },
    health: 'GET /api/health',
  });
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
app.use('/api/push-tokens', authenticateToken, pushTokenRoutes);
app.use('/api/admin/message-logs', authenticateToken, requireRole('admin', 'ceo'), messageLogsRoutes);
app.use(
  '/api/admin/activity-logs',
  authenticateToken,
  requireRole('ceo', 'admin', 'service_manager', 'hr_manager', 'finance', 'sales', 'operations'),
  activityLogsRoutes
);
app.use('/api/visits', authenticateToken, visitRoutes);
app.use('/api/sales', authenticateToken, salesModuleRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/task-diary', authenticateToken, taskDiaryRoutes);
app.use('/api/task-reports', authenticateToken, taskReportRoutes);
app.use('/api/microsoft', microsoftTodoRoutes);

// 404 — if you get JSON here, request reached Node; if you still see "Cannot GET ...", the request never reached Node (proxy/config)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// CORS rejection (cors package passes callback(new Error('Not allowed by CORS')))
app.use((err, req, res, next) => {
  if (err && String(err.message || '').includes('Not allowed by CORS')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  next(err);
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
    console.log(`   Login: POST http://localhost:${PORT}/api/auth/login`);
    console.log(`   Sanity: GET  http://localhost:${PORT}/api  → JSON with app "ak-crm-api"`);
    console.log(`   APP_ENV=${appEnvLabel}  DB_NAME=${process.env.DB_NAME || '(not set)'}`);
    if (appEnvLabel === 'staging') {
      console.warn(
        '   [APP_ENV=staging] Use a staging MySQL only — see docs/STAGING-AND-PRODUCTION-MYSQL.md'
      );
    }
  });

  if (process.env.TASK_REMINDER_ENABLED === '1') {
    const intervalMs = Math.max(60_000, parseInt(process.env.TASK_REMINDER_INTERVAL_MS || '900000', 10) || 900000);
    console.log(`[task-reminders] enabled, interval ${intervalMs}ms`);
    setInterval(() => {
      runTaskReminderSweep().catch((err) => console.error('[task-reminders]', err?.message || err));
    }, intervalMs);
    setTimeout(() => {
      runTaskReminderSweep().catch((err) => console.error('[task-reminders]', err?.message || err));
    }, 15_000);
  }
}

export default app;
