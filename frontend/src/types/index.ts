// ============================================
// AK Success CRM - Core Type Definitions
// ============================================

// Base entity interface - all entities must extend this
export interface BaseEntity {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// User Roles
export type UserRole = 
  | 'ceo'
  | 'admin'
  | 'service_manager'
  | 'technician'
  | 'sales_manager'
  | 'hr_manager'
  | 'finance'
  | 'inventory_officer';

export interface User extends BaseEntity {
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  department: string;
  phone?: string;
  isActive: boolean;
  canApprove?: boolean;
}

// Client / Customer
export interface Client extends BaseEntity {
  clientCode: string;
  name: string;
  companyName: string;
  oldCompanyName?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  industry: string;
  assignedTo: string; // User ID
  notes?: string;
  totalRevenue: number;
  equipmentCount: number;
  robotCount: number;
  isActive: boolean;
}

// Equipment Types
export type OwnershipType = 'rental' | 'sold';

export type EquipmentStatus = 
  | 'operational'
  | 'maintenance_required'
  | 'under_maintenance'
  | 'decommissioned';

export type AMCRenewalStatus = 'active' | 'pending' | 'expired';

export interface Equipment extends BaseEntity {
  name: string;
  ownershipType: OwnershipType;
  model: string;
  modelNumbers: string[]; // Multiple model/serial numbers
  serialNumber: string; // Legacy field
  manufacturer: string;
  clientId: string;
  installationDate: Date;
  location: string;
  
  // Rental contract
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  rentalDurationMonths?: number;
  rentalAmount?: number;
  rentalTerms?: string;
  
  // Sold + AMC
  amcContractStart?: Date;
  amcContractEnd?: Date;
  amcAmount?: number;
  amcTerms?: string;
  amcRenewalStatus?: AMCRenewalStatus;
  
  // Service tracking
  warrantyExpiry?: Date;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  notes?: string;
  isActive: boolean;

  // SIM cards (optional, for robots) — multiple per contract
  simCards?: SimCard[];
  // Legacy single-SIM fields
  simNumber?: string;
  simCarrier?: string;
  simPhoneNumber?: string;
  simTopUpDate?: Date;
  simExpiredDate?: Date;
  simReminderAt?: Date;
}

export interface SimCard {
  id?: string;
  simNumber: string;
  simCarrier?: string;
  simPhoneNumber?: string;
  simTopUpDate?: Date;
  simExpiredDate?: Date;
  simReminderAt?: Date;
}

// Supplier (Manufacturer Master)
export interface Supplier extends BaseEntity {
  name: string;
  contact: string;
  email: string;
  whatsapp: string;
  wechat: string;
  lark: string;
  groupLink: string;
  qrCode: string;
  notes?: string;
  isActive: boolean;
}

// Service Ticket
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus = 
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'pending_parts'
  | 'on_hold'
  | 'resolved'
  | 'closed';

export interface ServiceTicket extends BaseEntity {
  ticketNumber: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  clientId: string;
  equipmentId?: string;
  assignedTo?: string;
  dueDate?: Date;
  nextActionDate?: Date;
  nextActionItem?: string;
  actionTaken?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  estimatedHours?: number;
  actualHours?: number;
  partsUsed: InventoryUsage[];
  laborCost: number;
  partsCost: number;
  totalCost: number;
  tags: string[];
  isActive: boolean;
  isBillable?: boolean;
}

// Inventory
export type InventoryCategory = 
  | 'spare_parts'
  | 'consumables'
  | 'tools'
  | 'components'
  | 'accessories';

export type InventoryCurrency = 'MYR' | 'USD' | 'SGD' | 'CNY';

export interface InventoryItem extends BaseEntity {
  sku: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  currency: InventoryCurrency;
  supplier?: string;
  location: string;
  compatibleEquipment: string[];
  trackSerialNumbers: boolean;
  isActive: boolean;
}

export interface InventorySerialNumber {
  id: string;
  inventoryId: string;
  serialNumber: string;
  status: 'available' | 'in_use' | 'defective' | 'retired';
  notes: string;
  createdAt: Date;
  createdBy: string;
}

export interface InventoryUsage {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

// HR & Leave
export type LeaveType = 
  | 'annual'
  | 'sick'
  | 'emergency'
  | 'unpaid'
  | 'maternity'
  | 'paternity'
  | 'compassionate';

export type LeaveStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface LeaveRequest extends BaseEntity {
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface Employee extends BaseEntity {
  userId: string;
  employeeId: string;
  department: string;
  position: string;
  joinDate: Date;
  salary?: number;
  manager?: string;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  isActive: boolean;
}

// Finance & Invoices
export type InvoiceStatus = 
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface Invoice extends BaseEntity {
  invoiceNumber: string;
  clientId: string;
  ticketId?: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  notes?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Audit Log
export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'status_change';
  previousValue?: unknown;
  newValue?: unknown;
  userId: string;
  timestamp: Date;
  ipAddress?: string;
}

// Workspace & Board
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  boards: Board[];
  members: string[];
  createdAt: Date;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: 'kanban' | 'table' | 'calendar';
  columns: BoardColumn[];
  filters?: BoardFilter[];
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string;
  order: number;
  limit?: number;
}

export interface BoardFilter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: unknown;
}

// Dashboard & KPIs
export interface KPIMetric {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  unit?: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage?: number;
}

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'list';
  title: string;
  data: unknown;
  config: Record<string, unknown>;
}
