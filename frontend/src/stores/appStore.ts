import { create } from 'zustand';
import type { Client, ServiceTicket, Equipment, InventoryItem, LeaveRequest, Invoice, User } from '../types';
import { api } from '../services/api';

interface AppState {
  // Data
  clients: Client[];
  tickets: ServiceTicket[];
  equipment: Equipment[];
  inventory: InventoryItem[];
  leaveRequests: LeaveRequest[];
  invoices: Invoice[];
  users: User[];
  dashboardStats: any;
  loading: boolean;
  error: string | null;

  // UI State
  sidebarOpen: boolean;
  activeWorkspace: string;
  activeView: 'kanban' | 'table' | 'calendar';

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setActiveWorkspace: (workspace: string) => void;
  setActiveView: (view: 'kanban' | 'table' | 'calendar') => void;

  // Data fetching
  fetchClients: () => Promise<void>;
  fetchTickets: () => Promise<void>;
  fetchEquipment: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchLeaveRequests: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>;

  // Client Actions
  addClient: (client: Partial<Client>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  toggleClientActive: (id: string, is_active: boolean) => Promise<void>;

  // Ticket Actions
  addTicket: (ticket: Partial<ServiceTicket>) => Promise<ServiceTicket>;
  updateTicket: (id: string, updates: Partial<ServiceTicket>) => Promise<void>;
  updateTicketStatus: (id: string, status: ServiceTicket['status']) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  toggleTicketActive: (id: string, is_active: boolean) => Promise<void>;

  // Equipment Actions
  addEquipment: (equipment: Partial<Equipment>) => Promise<Equipment>;
  updateEquipmentItem: (id: string, updates: Partial<Equipment>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  toggleEquipmentActive: (id: string, is_active: boolean) => Promise<void>;

  // Inventory Actions
  addInventoryItem: (item: Partial<InventoryItem>) => Promise<InventoryItem>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  adjustStock: (id: string, adjustment: number, reason?: string) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  toggleInventoryActive: (id: string, is_active: boolean) => Promise<void>;

  // Leave Actions
  addLeaveRequest: (request: Partial<LeaveRequest>) => Promise<LeaveRequest>;
  updateLeaveStatus: (id: string, status: LeaveRequest['status'], rejectionReason?: string) => Promise<void>;
  cancelLeaveRequest: (id: string) => Promise<void>;

  // Invoice Actions
  addInvoice: (invoice: any) => Promise<Invoice>;
  updateInvoice: (id: string, updates: any) => Promise<void>;
  recordPayment: (id: string, amount: number) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  clients: [],
  tickets: [],
  equipment: [],
  inventory: [],
  leaveRequests: [],
  invoices: [],
  users: [],
  dashboardStats: null,
  loading: false,
  error: null,
  sidebarOpen: true,
  activeWorkspace: 'dashboard',
  activeView: 'kanban',

  // UI Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setActiveView: (view) => set({ activeView: view }),

  // Fetch functions
  fetchClients: async () => {
    try {
      set({ loading: true, error: null });
      const clients = await api.getClients();
      set({ clients: clients.map(transformClient), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchTickets: async () => {
    try {
      set({ loading: true, error: null });
      const tickets = await api.getTickets();
      set({ tickets: tickets.map(transformTicket), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchEquipment: async () => {
    try {
      set({ loading: true, error: null });
      const equipment = await api.getEquipment();
      set({ equipment: equipment.map(transformEquipment), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchInventory: async () => {
    try {
      set({ loading: true, error: null });
      const inventory = await api.getInventory();
      set({ inventory: inventory.map(transformInventory), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchLeaveRequests: async () => {
    try {
      set({ loading: true, error: null });
      const requests = await api.getLeaveRequests();
      set({ leaveRequests: requests.map(transformLeaveRequest), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchInvoices: async () => {
    try {
      set({ loading: true, error: null });
      const invoices = await api.getInvoices();
      set({ invoices: invoices.map(transformInvoice), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchUsers: async () => {
    try {
      set({ loading: true, error: null });
      const users = await api.getUsers();
      set({ users: users.map(transformUser), loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchDashboardStats: async () => {
    try {
      const stats = await api.getDashboardStats();
      set({ dashboardStats: stats });
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  },

  // Client actions
  addClient: async (clientData) => {
    const client = await api.createClient(clientData);
    set((state) => ({ clients: [...state.clients, transformClient(client)] }));
    return transformClient(client);
  },

  updateClient: async (id, updates) => {
    await api.updateClient(id, updates);
    await get().fetchClients();
  },

  deleteClient: async (id) => {
    await api.deleteClient(id);
    set((state) => ({ clients: state.clients.filter((c) => c.id !== id) }));
  },

  toggleClientActive: async (id, is_active) => {
    await api.toggleClientActive(id, is_active);
    await get().fetchClients();
  },

  // Ticket actions
  addTicket: async (ticketData) => {
    const ticket = await api.createTicket(ticketData);
    set((state) => ({ tickets: [...state.tickets, transformTicket(ticket)] }));
    return transformTicket(ticket);
  },

  updateTicket: async (id, updates) => {
    await api.updateTicket(id, updates);
    await get().fetchTickets();
  },

  updateTicketStatus: async (id, status) => {
    await api.updateTicketStatus(id, status);
    set((state) => ({
      tickets: state.tickets.map((t) =>
        t.id === id ? { ...t, status, updatedAt: new Date() } : t
      ),
    }));
  },

  deleteTicket: async (id) => {
    await api.deleteTicket(id);
    set((state) => ({ tickets: state.tickets.filter((t) => t.id !== id) }));
  },

  toggleTicketActive: async (id, is_active) => {
    await api.toggleTicketActive(id, is_active);
    await get().fetchTickets();
  },

  // Equipment actions
  addEquipment: async (equipmentData) => {
    const equipment = await api.createEquipment(equipmentData);
    set((state) => ({ equipment: [...state.equipment, transformEquipment(equipment)] }));
    return transformEquipment(equipment);
  },

  updateEquipmentItem: async (id, updates) => {
    await api.updateEquipment(id, updates);
    await get().fetchEquipment();
  },

  deleteEquipment: async (id) => {
    await api.deleteEquipment(id);
    set((state) => ({ equipment: state.equipment.filter((e) => e.id !== id) }));
  },

  toggleEquipmentActive: async (id, is_active) => {
    await api.toggleEquipmentActive(id, is_active);
    await get().fetchEquipment();
  },

  // Inventory actions
  addInventoryItem: async (itemData) => {
    const item = await api.createInventoryItem(itemData);
    set((state) => ({ inventory: [...state.inventory, transformInventory(item)] }));
    return transformInventory(item);
  },

  updateInventoryItem: async (id, updates) => {
    await api.updateInventoryItem(id, updates);
    await get().fetchInventory();
  },

  adjustStock: async (id, adjustment, reason) => {
    await api.adjustStock(id, adjustment, reason);
    await get().fetchInventory();
  },

  deleteInventoryItem: async (id) => {
    await api.deleteInventoryItem(id);
    set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) }));
  },

  toggleInventoryActive: async (id, is_active) => {
    await api.toggleInventoryActive(id, is_active);
    await get().fetchInventory();
  },

  // Leave actions
  addLeaveRequest: async (requestData) => {
    const request = await api.createLeaveRequest(requestData);
    set((state) => ({ leaveRequests: [...state.leaveRequests, transformLeaveRequest(request)] }));
    return transformLeaveRequest(request);
  },

  updateLeaveStatus: async (id, status, rejectionReason) => {
    await api.updateLeaveStatus(id, status as 'approved' | 'rejected', rejectionReason);
    await get().fetchLeaveRequests();
  },

  cancelLeaveRequest: async (id) => {
    await api.cancelLeaveRequest(id);
    await get().fetchLeaveRequests();
  },

  // Invoice actions
  addInvoice: async (invoiceData) => {
    const invoice = await api.createInvoice(invoiceData);
    set((state) => ({ invoices: [...state.invoices, transformInvoice(invoice)] }));
    return transformInvoice(invoice);
  },

  updateInvoice: async (id, updates) => {
    await api.updateInvoice(id, updates);
    await get().fetchInvoices();
  },

  recordPayment: async (id, amount) => {
    await api.recordPayment(id, amount);
    await get().fetchInvoices();
  },

  deleteInvoice: async (id) => {
    await api.deleteInvoice(id);
    set((state) => ({ invoices: state.invoices.filter((i) => i.id !== id) }));
  },
}));

// Transform functions to convert API response to frontend types
function transformClient(data: any): Client {
  return {
    id: data.id,
    name: data.name,
    companyName: data.company_name,
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || 'Malaysia',
    postalCode: data.postal_code || '',
    industry: data.industry || '',
    assignedTo: data.assigned_to || '',
    notes: data.notes,
    totalRevenue: data.total_revenue || 0,
    equipmentCount: data.equipment_count || 0,
    robotCount: data.robot_count || 0,
    status: data.status || 'active',
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by || '',
    updatedBy: data.updated_by || '',
    isActive: data.is_active === 1 || data.is_active === true || data.is_active === undefined || data.is_active === null,
  };
}

function transformTicket(data: any): ServiceTicket & { assignedToName?: string } {
  return {
    id: data.id,
    ticketNumber: data.ticket_number,
    title: data.title,
    description: data.description || '',
    priority: data.priority,
    status: data.status,
    clientId: data.client_id,
    equipmentId: data.equipment_id,
    assignedTo: data.assigned_to,
    assignedToName: data.assigned_to_name,
    dueDate: data.due_date ? new Date(data.due_date) : undefined,
    nextActionDate: data.next_action_date ? new Date(data.next_action_date) : undefined,
    nextActionItem: data.next_action_item || '',
    actionTaken: data.action_taken || '',
    resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
    closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    estimatedHours: data.estimated_hours,
    actualHours: data.actual_hours,
    partsUsed: [],
    laborCost: data.labor_cost || 0,
    partsCost: data.parts_cost || 0,
    totalCost: data.total_cost || 0,
    tags: JSON.parse(data.tags || '[]'),
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by || '',
    updatedBy: data.updated_by || '',
    isActive: data.is_active === 1 || data.is_active === true || data.is_active === undefined || data.is_active === null,
  };
}

function transformEquipment(data: any): Equipment {
  return {
    id: data.id,
    name: data.name,
    ownershipType: data.ownership_type || 'sold',
    model: data.model || '',
    modelNumbers: Array.isArray(data.model_numbers) ? data.model_numbers : [],
    serialNumber: data.serial_number || '',
    manufacturer: data.manufacturer || '',
    clientId: data.client_id,
    installationDate: new Date(data.installation_date || Date.now()),
    warrantyExpiry: data.warranty_expiry ? new Date(data.warranty_expiry) : undefined,
    lastServiceDate: data.last_service_date ? new Date(data.last_service_date) : undefined,
    nextServiceDate: data.next_service_date ? new Date(data.next_service_date) : undefined,
    location: data.location || '',
    notes: data.notes,
    status: data.status,
    // Rental contract fields
    rentalStartDate: data.rental_start_date ? new Date(data.rental_start_date) : undefined,
    rentalEndDate: data.rental_end_date ? new Date(data.rental_end_date) : undefined,
    rentalDurationMonths: data.rental_duration_months || undefined,
    rentalAmount: data.rental_amount || undefined,
    rentalTerms: data.rental_terms || undefined,
    // AMC contract fields
    amcContractStart: data.amc_contract_start ? new Date(data.amc_contract_start) : undefined,
    amcContractEnd: data.amc_contract_end ? new Date(data.amc_contract_end) : undefined,
    amcAmount: data.amc_amount || undefined,
    amcTerms: data.amc_terms || undefined,
    amcRenewalStatus: data.amc_renewal_status || undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by || '',
    updatedBy: data.updated_by || '',
    isActive: data.is_active === 1 || data.is_active === true || data.is_active === undefined || data.is_active === null,
  };
}

function transformInventory(data: any): InventoryItem {
  return {
    id: data.id,
    sku: data.sku,
    name: data.name,
    description: data.description,
    category: data.category,
    quantity: typeof data.quantity === 'number' ? data.quantity : parseInt(data.quantity) || 0,
    minQuantity: typeof data.min_quantity === 'number' ? data.min_quantity : parseInt(data.min_quantity) || 0,
    unitPrice: typeof data.unit_price === 'number' ? data.unit_price : parseFloat(data.unit_price) || 0,
    supplier: data.supplier,
    location: data.location,
    compatibleEquipment: JSON.parse(data.compatible_equipment || '[]'),
    status: data.status || 'active',
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by || '',
    updatedBy: data.updated_by || '',
    isActive: data.is_active === 1 || data.is_active === true || data.is_active === undefined || data.is_active === null,
  };
}

function transformLeaveRequest(data: any): LeaveRequest {
  return {
    id: data.id,
    employeeId: data.employee_id,
    type: data.type,
    startDate: new Date(data.start_date),
    endDate: new Date(data.end_date),
    days: data.days,
    reason: data.reason || '',
    status: data.status,
    approvedBy: data.approved_by,
    rejectionReason: data.rejection_reason,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.employee_id,
    updatedBy: data.approved_by || data.employee_id,
  };
}

function transformInvoice(data: any): Invoice {
  return {
    id: data.id,
    invoiceNumber: data.invoice_number,
    clientId: data.client_id,
    ticketId: data.ticket_id,
    issueDate: new Date(data.issue_date),
    dueDate: new Date(data.due_date),
    items: data.items || [],
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    paidAmount: data.paid_amount,
    notes: data.notes,
    status: data.status,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by || '',
    updatedBy: data.updated_by || '',
  };
}

function transformUser(data: any): User {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    department: data.department || '',
    avatar: data.avatar,
    phone: data.phone,
    isActive: data.is_active === 1 || data.is_active === true,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at || data.created_at),
    createdBy: data.created_by || '',
    updatedBy: data.updated_by || '',
    status: data.is_active === 1 || data.is_active === true ? 'active' : 'inactive',
  };
}
