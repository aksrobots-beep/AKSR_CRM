const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on init
    const stored = localStorage.getItem('ak-crm-auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.token = parsed.state?.token || null;
      } catch {
        this.token = null;
      }
    }
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      const msg = err.message || err.error || 'Request failed';
      throw new Error(err.code ? `${msg} (${err.code})` : msg);
    }

    return response.json();
  }

  private async requestBlob(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Blob> {
    const headers: HeadersInit = {
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      const msg = err.message || err.error || 'Request failed';
      throw new Error(err.code ? `${msg} (${err.code})` : msg);
    }

    return response.blob();
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = result.token;
    return result;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  async getUsers() {
    return this.request<any[]>('/auth/users');
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async validateResetToken(token: string) {
    const query = new URLSearchParams({ token }).toString();
    return this.request<{ valid: boolean; message?: string }>(`/auth/reset-password/validate?${query}`);
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<any>('/dashboard/stats');
  }

  async getDashboardActivity() {
    return this.request<any>('/dashboard/activity');
  }

  // Clients
  async getClients() {
    return this.request<any[]>('/clients');
  }

  async getClient(id: string) {
    return this.request<any>(`/clients/${id}`);
  }

  async createClient(data: any) {
    return this.request<any>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: string, data: any) {
    return this.request<any>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: string) {
    return this.request<any>(`/clients/${id}`, { method: 'DELETE' });
  }

  async toggleClientActive(id: string, is_active: boolean) {
    return this.request<any>(`/clients/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  // Tickets
  async getTickets(params?: { status?: string; priority?: string; assigned_to?: string; client_id?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<any[]>(`/tickets${query}`);
  }

  async getTicket(id: string) {
    return this.request<any>(`/tickets/${id}`);
  }

  async createTicket(data: any) {
    return this.request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTicket(id: string, data: any) {
    return this.request<any>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateTicketStatus(id: string, status: string) {
    return this.request<any>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteTicket(id: string) {
    return this.request<any>(`/tickets/${id}`, { method: 'DELETE' });
  }

  async toggleTicketActive(id: string, is_active: boolean) {
    return this.request<any>(`/tickets/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  async getTechnicians() {
    return this.request<any[]>('/tickets/meta/technicians');
  }

  async assignTicket(id: string, assigned_to: string | null) {
    return this.request<any>(`/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to }),
    });
  }

  // Notifications
  async getNotifications() {
    return this.request<Array<{ id: string; title: string; message: string; type: string; link?: string; read: boolean; createdAt: string }>>('/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.request<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' });
  }

  // Equipment
  async getEquipment(params?: { type?: string; status?: string; client_id?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<any[]>(`/equipment${query}`);
  }

  async getEquipmentById(id: string) {
    return this.request<any>(`/equipment/${id}`);
  }

  async createEquipment(data: any) {
    return this.request<any>('/equipment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEquipment(id: string, data: any) {
    return this.request<any>(`/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEquipment(id: string) {
    return this.request<any>(`/equipment/${id}`, { method: 'DELETE' });
  }

  async toggleEquipmentActive(id: string, is_active: boolean) {
    return this.request<any>(`/equipment/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  // Inventory
  async getInventory(params?: { category?: string; low_stock?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<any[]>(`/inventory${query}`);
  }

  async getInventoryItem(id: string) {
    return this.request<any>(`/inventory/${id}`);
  }

  async createInventoryItem(data: any) {
    return this.request<any>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInventoryItem(id: string, data: any) {
    return this.request<any>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adjustStock(id: string, adjustment: number, reason?: string, serialNumberIds?: string[]) {
    return this.request<any>(`/inventory/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ adjustment, reason, serial_number_ids: serialNumberIds }),
    });
  }

  async getInventoryStockMovements(inventoryId: string) {
    return this.request<any[]>(`/inventory/${inventoryId}/movements`);
  }

  async deleteInventoryItem(id: string) {
    return this.request<any>(`/inventory/${id}`, { method: 'DELETE' });
  }

  async getSerialNumbers(inventoryId: string) {
    return this.request<any[]>(`/inventory/${inventoryId}/serial-numbers`);
  }

  async addSerialNumbers(inventoryId: string, serialNumbers: string[]) {
    return this.request<any>(`/inventory/${inventoryId}/serial-numbers`, {
      method: 'POST',
      body: JSON.stringify({ serial_numbers: serialNumbers }),
    });
  }

  async updateSerialNumber(inventoryId: string, snId: string, data: { status?: string; notes?: string }) {
    return this.request<any>(`/inventory/${inventoryId}/serial-numbers/${snId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSerialNumber(inventoryId: string, snId: string) {
    return this.request<any>(`/inventory/${inventoryId}/serial-numbers/${snId}`, { method: 'DELETE' });
  }

  async toggleInventoryActive(id: string, is_active: boolean) {
    return this.request<any>(`/inventory/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  // Leave Requests
  async getLeaveRequests(params?: { status?: string; employee_id?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<any[]>(`/leave${query}`);
  }

  async getLeaveRequest(id: string) {
    return this.request<any>(`/leave/${id}`);
  }

  async createLeaveRequest(data: any) {
    return this.request<any>('/leave', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLeaveStatus(id: string, status: 'approved' | 'rejected', rejection_reason?: string) {
    return this.request<any>(`/leave/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejection_reason }),
    });
  }

  async cancelLeaveRequest(id: string) {
    return this.request<any>(`/leave/${id}/cancel`, { method: 'PATCH' });
  }

  async updateLeaveRequest(id: string, data: any) {
    return this.request<any>(`/leave/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Parts Used on Tickets
  async addPartsToTicket(ticketId: string, parts: { inventory_id: string; quantity: number }[]) {
    return this.request<any>(`/tickets/${ticketId}/parts`, {
      method: 'POST',
      body: JSON.stringify({ parts }),
    });
  }

  async removePartFromTicket(ticketId: string, partUsageId: string) {
    return this.request<any>(`/tickets/${ticketId}/parts/${partUsageId}`, {
      method: 'DELETE',
    });
  }

  async getTicketParts(ticketId: string) {
    return this.request<any[]>(`/tickets/${ticketId}/parts`);
  }

  // Invoices
  async getInvoices(params?: { status?: string; client_id?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<any[]>(`/invoices${query}`);
  }

  async getInvoice(id: string) {
    return this.request<any>(`/invoices/${id}`);
  }

  async createInvoice(data: any) {
    return this.request<any>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id: string, data: any) {
    return this.request<any>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async recordPayment(id: string, amount: number) {
    return this.request<any>(`/invoices/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    });
  }

  async deleteInvoice(id: string) {
    return this.request<any>(`/invoices/${id}`, { method: 'DELETE' });
  }

  // Employees
  async getEmployees() {
    return this.request<any[]>('/employees');
  }

  async getEmployee(id: string) {
    return this.request<any>(`/employees/${id}`);
  }

  async createEmployee(data: any) {
    return this.request<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: any) {
    return this.request<any>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async toggleEmployeeActive(id: string, is_active: boolean) {
    return this.request<any>(`/employees/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  async deleteEmployee(id: string) {
    return this.request<any>(`/employees/${id}`, { method: 'DELETE' });
  }

  // Suppliers
  async getSuppliers() {
    return this.request<any[]>('/suppliers');
  }

  async getSupplier(id: string) {
    return this.request<any>(`/suppliers/${id}`);
  }

  async createSupplier(data: any) {
    return this.request<any>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request<any>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string) {
    return this.request<any>(`/suppliers/${id}`, { method: 'DELETE' });
  }

  async toggleSupplierActive(id: string, is_active: boolean) {
    return this.request<any>(`/suppliers/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  // Reports
  async getReportModules() {
    return this.request<any[]>('/reports/modules');
  }

  async getReportModuleSchema(moduleKey: string) {
    return this.request<any>(`/reports/modules/${moduleKey}/schema`);
  }

  async previewReport(data: any) {
    return this.request<any>('/reports/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async downloadReport(data: any) {
    return this.requestBlob('/reports/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async getReportDefinitions() {
    return this.request<any[]>('/reports/definitions');
  }

  async createReportDefinition(data: any) {
    return this.request<any>('/reports/definitions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReportDefinition(id: string, data: any) {
    return this.request<any>(`/reports/definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReportDefinition(id: string) {
    return this.request<any>(`/reports/definitions/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
