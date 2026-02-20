/**
 * Test all CRM APIs and optionally seed data via the API (realtime).
 * Usage: node src/scripts/test-and-seed-api.js [--seed]
 * Requires backend running at API_BASE (default http://localhost:3001/api).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = process.env.API_BASE || process.env.VITE_API_URL || 'http://localhost:3001/api';
const LOGIN_EMAIL = process.env.TEST_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.TEST_LOGIN_PASSWORD;

let token = null;
const results = { ok: [], fail: [] };

async function request(method, endpoint, body = null) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data };
}

function pass(name, detail = '') {
  results.ok.push(name + (detail ? `: ${detail}` : ''));
  console.log('  ✓', name, detail ? detail : '');
}

function fail(name, err) {
  results.fail.push(`${name}: ${err}`);
  console.log('  ✗', name, err);
}

async function test(name, fn) {
  try {
    await fn();
  } catch (e) {
    fail(name, e.message || String(e));
  }
}

async function main() {
  const doSeed = process.argv.includes('--seed');
  console.log('\n🧪 API Test & Seed (realtime)\n');
  console.log('  API_BASE:', API_BASE);
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.error('\n❌ Missing TEST_LOGIN_EMAIL or TEST_LOGIN_PASSWORD in .env');
    console.error('   Example: TEST_LOGIN_EMAIL=user@example.com TEST_LOGIN_PASSWORD=yourPassword');
    process.exit(1);
  }
  console.log('  Login:', LOGIN_EMAIL);
  console.log('  Seed:', doSeed ? 'yes' : 'no (use --seed to seed data)\n');

  // Health
  await test('GET /api/health', async () => {
    const r = await request('GET', '/health');
    if (r.ok && (r.data?.status === 'ok' || r.data?.ok === true)) pass('GET /api/health');
    else fail('GET /api/health', r.status + ' ' + JSON.stringify(r.data));
  });

  await test('GET /api/health?db=1', async () => {
    const r = await request('GET', '/health?db=1');
    if (r.ok && r.data?.ok === true) pass('GET /api/health (DB)');
    else fail('GET /api/health (DB)', r.status + ' ' + JSON.stringify(r.data));
  });

  // Auth
  await test('POST /api/auth/login', async () => {
    const r = await request('POST', '/auth/login', { email: LOGIN_EMAIL, password: LOGIN_PASSWORD });
    if (!r.ok) throw new Error(r.status + ' ' + (r.data?.error || JSON.stringify(r.data)));
    if (!r.data?.token) throw new Error('No token in response');
    token = r.data.token;
    pass('POST /api/auth/login', 'token received');
  });

  if (!token) {
    console.log('\n❌ Cannot continue without token. Fix login and retry.\n');
    process.exit(1);
  }

  await test('GET /api/auth/me', async () => {
    const r = await request('GET', '/auth/me');
    if (!r.ok) throw new Error(r.status + ' ' + (r.data?.error || JSON.stringify(r.data)));
    pass('GET /api/auth/me', r.data?.email || r.data?.user?.email);
  });

  // Clients
  await test('GET /api/clients', async () => {
    const r = await request('GET', '/clients');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    const arr = Array.isArray(r.data) ? r.data : [];
    pass('GET /api/clients', `${arr.length} clients`);
  });

  let createdClientId = null;
  await test('POST /api/clients (create)', async () => {
    const r = await request('POST', '/clients', {
      name: 'API Test Contact',
      company_name: 'API Test Company Sdn Bhd',
      email: 'api-test@example.com',
      phone: '+60 12-000 0000',
      address: '123 Test Street',
      city: 'Kuala Lumpur',
      state: 'WP',
      industry: 'F&B',
    });
    if (!r.ok) throw new Error(r.status + ' ' + (r.data?.message || r.data?.error || JSON.stringify(r.data)));
    if (!r.data?.id) throw new Error('No id in response');
    createdClientId = r.data.id;
    pass('POST /api/clients', 'id=' + createdClientId);
  });

  if (createdClientId) {
    await test('GET /api/clients/:id', async () => {
      const r = await request('GET', `/clients/${createdClientId}`);
      if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
      pass('GET /api/clients/:id');
    });
    await test('PUT /api/clients/:id', async () => {
      const r = await request('PUT', `/clients/${createdClientId}`, { notes: 'Updated by API test' });
      if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
      pass('PUT /api/clients/:id');
    });
  }

  // Dashboard
  await test('GET /api/dashboard/stats', async () => {
    const r = await request('GET', '/dashboard/stats');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/dashboard/stats');
  });
  await test('GET /api/dashboard/activity', async () => {
    const r = await request('GET', '/dashboard/activity');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/dashboard/activity');
  });

  // Tickets
  await test('GET /api/tickets', async () => {
    const r = await request('GET', '/tickets');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/tickets', Array.isArray(r.data) ? r.data.length + ' tickets' : '');
  });

  // Equipment
  await test('GET /api/equipment', async () => {
    const r = await request('GET', '/equipment');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/equipment', Array.isArray(r.data) ? r.data.length + ' items' : '');
  });

  // Inventory
  await test('GET /api/inventory', async () => {
    const r = await request('GET', '/inventory');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/inventory', Array.isArray(r.data) ? r.data.length + ' items' : '');
  });

  // Employees
  await test('GET /api/employees', async () => {
    const r = await request('GET', '/employees');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/employees', Array.isArray(r.data) ? r.data.length + ' employees' : '');
  });

  // Suppliers
  await test('GET /api/suppliers', async () => {
    const r = await request('GET', '/suppliers');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/suppliers', Array.isArray(r.data) ? r.data.length + ' suppliers' : '');
  });

  // Invoices
  await test('GET /api/invoices', async () => {
    const r = await request('GET', '/invoices');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/invoices');
  });

  // Leave
  await test('GET /api/leave', async () => {
    const r = await request('GET', '/leave');
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
    pass('GET /api/leave');
  });

  // Seed via API (optional)
  if (doSeed && createdClientId) {
    console.log('\n  Seeding via API...');
    const seedClients = [
      { name: 'Lim Wei Ming', company_name: 'Golden Dragon Restaurant', email: 'weiming@goldendragon.com.my', phone: '+60 12-345 6789', address: '123 Jalan Bukit Bintang', city: 'Kuala Lumpur', state: 'WP Kuala Lumpur', industry: 'F&B - Restaurant' },
      { name: 'Tan Siew Ling', company_name: 'Ocean Breeze Hotel', email: 'siewling@oceanbreeze.com.my', phone: '+60 16-789 0123', address: '456 Jalan Pantai', city: 'Penang', state: 'Penang', industry: 'Hospitality - Hotel' },
    ];
    for (const c of seedClients) {
      await test('Seed client: ' + c.company_name, async () => {
        const r = await request('POST', '/clients', c);
        if (!r.ok) throw new Error(r.status + ' ' + (r.data?.message || r.data?.error || ''));
        pass('Seed client', c.company_name);
      });
    }
  }

  // Delete test client if we created one (optional cleanup)
  if (createdClientId && !doSeed) {
    await test('DELETE /api/clients/:id (cleanup)', async () => {
      const r = await request('DELETE', `/clients/${createdClientId}`);
      if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(r.data));
      pass('DELETE /api/clients/:id (test client removed)');
    });
  }

  console.log('\n--- Summary ---');
  console.log('  Passed:', results.ok.length);
  if (results.fail.length) {
    console.log('  Failed:', results.fail.length);
    results.fail.forEach((f) => console.log('    ', f));
    process.exit(1);
  }
  console.log('  All API tests passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
