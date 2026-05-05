/** Must end with `/api` (handles mis-set env like `http://localhost:3001`). */
function normalizeApiBase(raw: string | undefined): string {
  const u = String(raw || 'http://localhost:3001/api').trim().replace(/\/+$/, '');
  if (u.endsWith('/api')) return u;
  return `${u}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

type AuthFailureHandler = () => void;
let authFailureHandler: AuthFailureHandler | null = null;

/** Called when an authenticated request returns invalid/expired token (logout + redirect to login). */
export function setApiAuthFailureHandler(fn: AuthFailureHandler | null) {
  authFailureHandler = fn;
}

type TokenRefreshHandler = (token: string, refreshToken?: string | null) => void;
let tokenRefreshHandler: TokenRefreshHandler | null = null;

/** Keeps Zustand auth state in sync after a silent refresh. */
export function setApiTokenRefreshHandler(fn: TokenRefreshHandler | null) {
  tokenRefreshHandler = fn;
}

function handleAuthErrorResponse(status: number, err: { error?: string; message?: string }, hadToken: boolean) {
  if (!hadToken || !authFailureHandler) return;
  const code = err.error || err.message || '';
  if (status === 403 && code === 'Invalid or expired token') {
    authFailureHandler();
  }
  if (status === 401 && code === 'Access token required') {
    authFailureHandler();
  }
}

async function throwForFailedResponse(response: Response, hadToken: boolean): Promise<never> {
  const ct = response.headers.get('content-type') || '';
  let err: { error?: string; message?: string; code?: string; path?: string } = {};
  if (ct.includes('application/json')) {
    err = await response.json().catch(() => ({}));
  }
  const hasBody = err && (err.error || err.message);
  if (!hasBody) {
    const base = API_BASE.replace(/\/api$/, '');
    const hint404 =
      response.status === 404
        ? ` Nothing on ${base}/api returned JSON? Stop whatever is using this port, then from the repo run: cd backend && npm run dev. Open ${base}/api in the browser — you should see {"app":"ak-crm-api",...}.`
        : '';
    throw new Error(`Request failed (${response.status}).${hint404}`);
  }
  const msg = err.message || err.error || 'Request failed';
  handleAuthErrorResponse(response.status, err, hadToken);
  throw new Error(err.code ? `${msg} (${err.code})` : msg);
}

class ApiService {
  private token: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    const stored = localStorage.getItem('ak-crm-auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.token = parsed.state?.token || null;
        this.refreshToken = parsed.state?.refreshToken || null;
      } catch {
        this.token = null;
        this.refreshToken = null;
      }
    }
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setRefreshToken(token: string | null) {
    this.refreshToken = token;
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as {
        token: string;
        refreshToken?: string;
      };
      if (!data.token) return false;
      this.token = data.token;
      if (data.refreshToken) this.refreshToken = data.refreshToken;
      tokenRefreshHandler?.(data.token, data.refreshToken ?? null);
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, allowRefreshRetry = true): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    let response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (
      !response.ok &&
      allowRefreshRetry &&
      this.refreshToken &&
      (response.status === 401 || response.status === 403)
    ) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        const headers2: HeadersInit = {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...options.headers,
        };
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers: headers2,
        });
      }
    }

    if (!response.ok) {
      await throwForFailedResponse(response, Boolean(this.token));
    }

    return response.json();
  }

  private async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const headers: HeadersInit = {
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    let response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok && this.refreshToken && (response.status === 401 || response.status === 403)) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        const headers2: HeadersInit = {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...options.headers,
        };
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers: headers2,
        });
      }
    }

    if (!response.ok) {
      await throwForFailedResponse(response, Boolean(this.token));
    }

    return response.blob();
  }

  /** POST multipart (do not set Content-Type — browser sets boundary). */
  private async requestFormData<T>(endpoint: string, formData: FormData, allowRefreshRetry = true): Promise<T> {
    const headers: HeadersInit = {
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };

    let response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (
      !response.ok &&
      allowRefreshRetry &&
      this.refreshToken &&
      (response.status === 401 || response.status === 403)
    ) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        const headers2: HeadersInit = {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        };
        response = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          body: formData,
          headers: headers2,
        });
      }
    }

    if (!response.ok) {
      await throwForFailedResponse(response, Boolean(this.token));
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ token: string; refreshToken?: string; user: any }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    );
    this.token = result.token;
    this.refreshToken = result.refreshToken ?? null;
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

  async getDashboardTicketDistribution() {
    return this.request<Array<{ status: string; count: number }>>('/dashboard/tickets/distribution');
  }

  async getDashboardUserSummary() {
    return this.request<{
      tasks: {
        totalAssigned: number;
        pending: number;
        inProgress: number;
        completed: number;
        overdue: number;
        completedToday: number;
      };
      tickets: {
        totalAssigned: number;
        open: number;
        inProgress: number;
        resolved: number;
      };
    }>('/dashboard/user-summary');
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

  async geocodeClientAddress(body: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  }) {
    return this.request<{ lat: number; lng: number; display_name: string; source: string }>('/clients/geocode', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getClientSite(id: string) {
    return this.request<{
      client_id: string;
      company_name: string;
      latitude: number | null;
      longitude: number | null;
      geofence_radius_m: number | null;
      effective_radius_m: number;
      site_configured: boolean;
    }>(`/clients/${id}/site`);
  }

  // Site visits (client-site attendance)
  async getVisits(params?: { client_id?: string; user_id?: string; from?: string; to?: string; name?: string }) {
    const q = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as any).toString()
      : '';
    return this.request<any[]>(`/visits${q}`);
  }

  async getOpenVisits() {
    return this.request<any[]>('/visits/open');
  }

  /** Managers: all users’ open visits with optional linked ticket (who is on site for which job). */
  async getOpenTeamVisits() {
    return this.request<any[]>('/visits/open-team');
  }

  async visitCheckIn(body: {
    client_id: string;
    lat: number;
    lng: number;
    accuracy_m?: number;
    ticket_id?: string;
    /** Demo / off-site: fixed 500 m radius around locked coordinates */
    ad_hoc_site?: boolean;
    ad_hoc_lat?: number;
    ad_hoc_lng?: number;
    /** ISO-8601 when the user initiated check-in (device clock); server accepts if near server time */
    recorded_at?: string;
  }) {
    return this.request<any>('/visits/check-in', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async visitCheckOut(
    visitId: string,
    body: {
      lat: number;
      lng: number;
      accuracy_m?: number;
      force_outside?: boolean;
      recorded_at?: string;
    },
    files?: File[]
  ) {
    if (files && files.length > 0) {
      const maxTotal = Number(import.meta.env.VITE_MAX_CHECKOUT_ATTACH_BYTES);
      if (Number.isFinite(maxTotal) && maxTotal > 0) {
        const total = files.reduce((s, f) => s + f.size, 0);
        if (total > maxTotal) {
          const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
          throw new Error(
            `Attachments total ${mb(total)} MB exceeds the ${mb(maxTotal)} MB limit for this deployment (reduce size or number of files).`
          );
        }
      }
      const fd = new FormData();
      fd.append('lat', String(body.lat));
      fd.append('lng', String(body.lng));
      if (body.accuracy_m != null && body.accuracy_m !== undefined) {
        fd.append('accuracy_m', String(body.accuracy_m));
      }
      if (body.force_outside) fd.append('force_outside', 'true');
      if (body.recorded_at) fd.append('recorded_at', body.recorded_at);
      for (const f of files) fd.append('files', f);
      const headers: HeadersInit = {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      };
      const response = await fetch(`${API_BASE}/visits/${visitId}/check-out`, {
        method: 'PATCH',
        body: fd,
        headers,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        const msg = err.message || err.error || 'Request failed';
        handleAuthErrorResponse(response.status, err, Boolean(this.token));
        throw new Error(err.code ? `${msg} (${err.code})` : msg);
      }
      return response.json() as Promise<any>;
    }
    return this.request<any>(`/visits/${visitId}/check-out`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async downloadVisitFieldReport(visitId: string) {
    return this.requestBlob(`/visits/${visitId}/field-report`);
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

  async updateTicketStatus(id: string, status: string, billingData?: { billing_items?: any[]; billing_notes?: string; attachments?: { filename: string; content: string; contentType: string }[] }) {
    return this.request<any>(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...billingData }),
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

  async registerPushToken(token: string, platform: 'android' | 'ios' = 'android') {
    return this.request<{ ok: boolean }>('/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  async deletePushTokens() {
    return this.request<{ ok: boolean }>('/push-tokens', { method: 'DELETE' });
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

  // Admin: message logs (email/push)
  async getMessageLogs(params?: { channel?: 'email' | 'push'; status?: 'sent' | 'failed' | 'skipped'; q?: string; limit?: number; offset?: number }) {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request<{ items: any[]; total: number; warning?: 'message_logs_table_missing' }>(`/admin/message-logs${qs}`);
  }

  /** Inserts one diagnostic row; use to verify message_logs exists and the API can write. */
  async recordTestMessageLog() {
    return this.request<{ ok: boolean; warning?: string; message?: string }>(`/admin/message-logs/record-test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getActivityLogs(params?: {
    user_id?: string;
    entity_type?: string;
    action?: string;
    from?: string;
    to?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && String(v) !== '');
    const qs =
      entries.length > 0
        ? '?' + new URLSearchParams(Object.fromEntries(entries.map(([k, v]) => [k, String(v)]))).toString()
        : '';
    return this.request<{ items: any[]; total: number; warning?: 'audit_logs_table_missing' }>(`/admin/activity-logs${qs}`);
  }

  // Sales module (quotations, POs, delivery orders, accounting requests)
  async getQuotations(params?: { ticket_id?: string; status?: string }) {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as any).toString() : '';
    return this.request<any[]>(`/sales/quotations${qs}`);
  }

  async getQuotation(id: string) {
    return this.request<any>(`/sales/quotations/${id}`);
  }

  async createQuotation(body: {
    ticket_id: string;
    client_id: string;
    line_items?: { description: string; quantity: number; unit_price: number }[];
    valid_until?: string | null;
    notes?: string;
    status?: string;
  }) {
    return this.request<any>('/sales/quotations', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateQuotation(
    id: string,
    body: Partial<{
      line_items: { description: string; quantity: number; unit_price: number }[];
      valid_until: string | null;
      notes: string;
      status: string;
    }>
  ) {
    return this.request<any>(`/sales/quotations/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async getClientPOs(params?: { ticket_id?: string; status?: string }) {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as any).toString() : '';
    return this.request<any[]>(`/sales/client-pos${qs}`);
  }

  async createClientPO(body: {
    ticket_id: string;
    quotation_id?: string | null;
    po_number: string;
    po_date?: string | null;
    status?: string;
    notes?: string;
  }) {
    return this.request<any>('/sales/client-pos', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateClientPO(
    id: string,
    body: Partial<{
      po_number: string;
      po_date: string | null;
      status: string;
      notes: string;
      quotation_id: string | null;
    }>
  ) {
    return this.request<any>(`/sales/client-pos/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async getDeliveryOrders(params?: { ticket_id?: string; status?: string }) {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as any).toString() : '';
    return this.request<any[]>(`/sales/delivery-orders${qs}`);
  }

  async createDeliveryOrder(body: { ticket_id: string; notes?: string; status?: string }) {
    return this.request<any>('/sales/delivery-orders', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateDeliveryOrder(id: string, body: { notes?: string }) {
    return this.request<any>(`/sales/delivery-orders/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async issueDeliveryOrder(id: string) {
    return this.request<any>(`/sales/delivery-orders/${id}/issue`, { method: 'PATCH', body: JSON.stringify({}) });
  }

  async acknowledgeDeliveryOrder(id: string) {
    return this.request<any>(`/sales/delivery-orders/${id}/acknowledge`, { method: 'PATCH', body: JSON.stringify({}) });
  }

  async getAccountingRequests(params?: { ticket_id?: string; status?: string; request_type?: string }) {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as any).toString() : '';
    return this.request<any[]>(`/sales/accounting-requests${qs}`);
  }

  async createAccountingRequest(body: { ticket_id: string; request_type: string; message?: string }) {
    return this.request<any>('/sales/accounting-requests', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateAccountingRequest(
    id: string,
    body: Partial<{ status: string; assigned_to: string | null; resolved_notes: string }>
  ) {
    return this.request<any>(`/sales/accounting-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async getSalesTicketSummary(ticketId: string) {
    return this.request<{
      quotations: any[];
      client_purchase_orders: any[];
      delivery_orders: any[];
      accounting_requests: any[];
    }>(`/sales/ticket-summary/${ticketId}`);
  }

  // Tasks & employee diary
  async getTasks(params?: {
    assigned_to?: string;
    assigned_by?: string;
    status?: string;
    from?: string;
    to?: string;
    ticket_id?: string;
  }) {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as any).toString()
      : '';
    return this.request<any[]>(`/tasks${qs}`);
  }

  async createTask(body: {
    title?: string;
    description?: string;
    assigned_to?: string;
    ticket_id?: string | null;
    priority?: string;
    due_date?: string;
    due_at?: string | null;
    task_category?: string;
    reminder_at?: string | null;
  }) {
    return this.request<any>('/tasks', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateTask(id: string, body: { status?: string; task_category?: string; reminder_at?: string | null }) {
    return this.request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async updateTaskStatus(id: string, status: string) {
    return this.updateTask(id, { status });
  }

  async getTaskDiary(params?: { user_id?: string; date?: string; from?: string; to?: string; task_id?: string }) {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as any).toString()
      : '';
    return this.request<any[]>(`/task-diary${qs}`);
  }

  async createTaskDiary(
    body:
      | FormData
      | {
          task_id?: string | null;
          work_date: string;
          start_time: string;
          end_time: string;
          notes?: string;
          work_category?: string;
          user_id?: string;
        }
  ) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return this.requestFormData<any>('/task-diary', body);
    }
    return this.request<any>('/task-diary', { method: 'POST', body: JSON.stringify(body) });
  }

  async getTaskDiaryAttachment(logId: string) {
    return this.requestBlob(`/task-diary/${logId}/attachment`, { method: 'GET' });
  }

  async getTaskReportEmployeeTasks(params?: { user_id?: string; from?: string; to?: string }) {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as any).toString()
      : '';
    return this.request<any>(`/task-reports/employee-tasks${qs}`);
  }

  async getTaskReportDiary(params?: { user_id?: string; from?: string; to?: string }) {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as any).toString()
      : '';
    return this.request<any>(`/task-reports/diary${qs}`);
  }

  async getTaskReportPerformance(params?: { user_id?: string; from?: string; to?: string }) {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as any).toString()
      : '';
    return this.request<any>(`/task-reports/performance${qs}`);
  }

  // Microsoft To Do (Graph OAuth — connect in Settings → Integrations)
  async getMicrosoftTodoStatus() {
    return this.request<{
      configured: boolean;
      connected: boolean;
      msAccountId?: string | null;
      expiresAt?: string | null;
      error?: string;
    }>('/microsoft/status');
  }

  async getMicrosoftOAuthStartUrl() {
    return this.request<{ url: string }>('/microsoft/oauth/start');
  }

  async disconnectMicrosoftTodo() {
    return this.request<{ ok: boolean }>('/microsoft/disconnect', { method: 'POST', body: '{}' });
  }

  async syncTasksToMicrosoftTodo() {
    return this.request<{ synced: number; total: number; errors: { taskId: string; message: string }[] }>(
      '/microsoft/sync-tasks',
      { method: 'POST', body: '{}' }
    );
  }
}

export const api = new ApiService();
