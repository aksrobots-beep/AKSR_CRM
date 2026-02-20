import './load-env.js'; // load .env from project root first (must be before any module that uses process.env)
import express from 'express'; // Restart trigger
import cors from 'cors';
import { query } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { ticketRoutes } from './routes/tickets.js';
import { equipmentRoutes } from './routes/equipment.js';
import { inventoryRoutes } from './routes/inventory.js';
import { leaveRoutes } from './routes/leave.js';
import { invoiceRoutes } from './routes/invoices.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { employeeRoutes } from './routes/employees.js';
import { supplierRoutes } from './routes/suppliers.js';
import { authenticateToken } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

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
app.get('/api/health', async (req, res) => {
  if (req.query.db === '1' || req.query.check === 'db') {
    return healthDbHandler(req, res);
  }
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/tickets', authenticateToken, ticketRoutes);
app.use('/api/equipment', authenticateToken, equipmentRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/leave', authenticateToken, leaveRoutes);
app.use('/api/invoices', authenticateToken, invoiceRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/employees', authenticateToken, employeeRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);

// 404 — if you get JSON here, request reached Node; if you still see "Cannot GET ...", the request never reached Node (proxy/config)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 AK Success CRM API running on http://localhost:${PORT}`);
});
