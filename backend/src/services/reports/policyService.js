const MODULE_TABLES = {
  clients: 'clients',
  equipment: 'equipment',
  inventory: 'inventory',
  tickets: 'tickets',
  invoices: 'invoices',
  suppliers: 'suppliers',
  users: 'users',
  employees: 'employees',
  leave_requests: 'leave_requests',
  stock_movements: 'stock_movements',
  ticket_parts: 'ticket_parts',
  inventory_serial_numbers: 'inventory_serial_numbers',
  audit_logs: 'audit_logs',
};

const MODULE_LABELS = {
  clients: 'Clients',
  equipment: 'Equipment / Robots',
  inventory: 'Inventory',
  tickets: 'Service Tickets',
  invoices: 'Invoices',
  suppliers: 'Suppliers',
  users: 'Users',
  employees: 'Employees',
  leave_requests: 'Leave Requests',
  stock_movements: 'Stock Movements',
  ticket_parts: 'Ticket Parts',
  inventory_serial_numbers: 'Inventory Serial Numbers',
  audit_logs: 'Audit Logs',
};

const SENSITIVE_COLUMN_PATTERNS = [
  /^password$/i,
  /token/i,
  /secret/i,
  /^qr_code$/i,
];

const ROLE_MODULE_ACCESS = {
  ceo: Object.keys(MODULE_TABLES),
  admin: Object.keys(MODULE_TABLES),
  finance: ['clients', 'invoices', 'suppliers'],
  service_manager: [
    'clients',
    'equipment',
    'tickets',
    'inventory',
    'suppliers',
    'stock_movements',
    'ticket_parts',
    'inventory_serial_numbers',
  ],
  technician: ['clients', 'equipment', 'tickets', 'inventory', 'stock_movements', 'ticket_parts', 'inventory_serial_numbers'],
  hr_manager: ['employees', 'leave_requests', 'users'],
};

export function getModulesForRole(role) {
  const allowed = ROLE_MODULE_ACCESS[role] || [];
  return allowed.map((key) => ({
    key,
    label: MODULE_LABELS[key] || key,
    table: MODULE_TABLES[key],
  }));
}

export function getTableForModule(moduleKey) {
  return MODULE_TABLES[moduleKey] || null;
}

export function canAccessModule(role, moduleKey) {
  return getModulesForRole(role).some((m) => m.key === moduleKey);
}

export function isSensitiveColumn(columnName) {
  return SENSITIVE_COLUMN_PATTERNS.some((pattern) => pattern.test(columnName));
}

export function filterColumnsForRole(role, moduleKey, columns) {
  if (!canAccessModule(role, moduleKey)) return [];
  return columns.filter((c) => !isSensitiveColumn(c.column_name));
}

export function canManageDefinition(user, definition) {
  if (!user || !definition) return false;
  if (user.role === 'ceo' || user.role === 'admin') return true;
  return definition.owner_user_id === user.id;
}
