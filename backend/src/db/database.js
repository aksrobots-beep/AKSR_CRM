import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {
  users: [],
  clients: [],
  equipment: [],
  tickets: [],
  inventory: [],
  leave_requests: [],
  invoices: [],
  audit_logs: [],
  suppliers: [],
});

// Initialize database
await db.read();

// Helper functions to simulate SQL-like operations
export function findAll(table) {
  return db.data[table] || [];
}

export function findById(table, id) {
  return (db.data[table] || []).find(item => item.id === id);
}

export function findOne(table, predicate) {
  return (db.data[table] || []).find(predicate);
}

export function findMany(table, predicate) {
  return (db.data[table] || []).filter(predicate);
}

export async function insert(table, item) {
  if (!db.data[table]) db.data[table] = [];
  db.data[table].push(item);
  await db.write();
  return item;
}

export async function update(table, id, updates) {
  const items = db.data[table] || [];
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    await db.write();
    return items[index];
  }
  return null;
}

export async function remove(table, id) {
  const items = db.data[table] || [];
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items.splice(index, 1);
    await db.write();
    return true;
  }
  return false;
}

export function count(table, predicate) {
  if (predicate) {
    return (db.data[table] || []).filter(predicate).length;
  }
  return (db.data[table] || []).length;
}

export function sum(table, field, predicate) {
  let items = db.data[table] || [];
  if (predicate) {
    items = items.filter(predicate);
  }
  return items.reduce((acc, item) => acc + (item[field] || 0), 0);
}

export async function initializeData(data) {
  db.data = { ...db.data, ...data };
  await db.write();
}

export default db;
