import { useEffect, useState } from 'react';
import { Header } from '../components/layout';
import { DataTable, StatsCard, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import type { Invoice } from '../types';
import { format } from 'date-fns';
import { DollarSign, FileText, Clock, CheckCircle, AlertCircle, X, Edit, CreditCard } from 'lucide-react';
import { api } from '../services/api';
import { validateDate, DATE_INPUT_MIN, DATE_INPUT_MAX } from '../utils/validateDate';
import { validateNumber } from '../utils/validation';

export function Accounts() {
  const { invoices, clients, fetchInvoices, fetchClients, addInvoice } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({ client_id: '', issue_date: '', due_date: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
  const [editData, setEditData] = useState({ status: 'draft', due_date: '', notes: '' });
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => { fetchInvoices(); fetchClients(); }, []);

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const issueResult = validateDate(formData.issue_date, { required: true, fieldName: 'Issue date' });
    if (!issueResult.valid) { alert(issueResult.error); return; }
    const dueResult = validateDate(formData.due_date, { required: true, fieldName: 'Due date' });
    if (!dueResult.valid) { alert(dueResult.error); return; }
    
    // Validate line items
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      
      // Validate quantity
      const qtyValidation = validateNumber(String(item.quantity), { 
        allowDecimal: false, 
        min: 1, 
        required: true 
      });
      if (!qtyValidation.valid) {
        alert(`Line item ${i + 1} - Quantity: ${qtyValidation.error}`);
        return;
      }
      
      // Validate unit price
      const priceValidation = validateNumber(String(item.unitPrice), { 
        allowDecimal: true, 
        min: 0, 
        required: true 
      });
      if (!priceValidation.valid) {
        alert(`Line item ${i + 1} - Unit Price: ${priceValidation.error}`);
        return;
      }
    }
    
    try {
      const itemsWithTotal = formData.items.map(item => ({ ...item, total: item.quantity * item.unitPrice }));
      await addInvoice({ ...formData, items: itemsWithTotal });
      setShowAddModal(false);
      setFormData({ client_id: '', issue_date: '', due_date: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
    } catch (error) { console.error('Failed to add invoice:', error); }
  };

  const handleEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (editData.due_date) {
      const r = validateDate(editData.due_date, { required: false, fieldName: 'Due date' });
      if (!r.valid) { alert(r.error); return; }
    }
    try {
      await api.updateInvoice(selectedInvoice.id, editData);
      setShowEditModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error) { console.error('Failed to update invoice:', error); }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    
    // Validate payment amount
    const maxPayment = selectedInvoice.total - selectedInvoice.paidAmount;
    const paymentValidation = validateNumber(String(paymentAmount), { 
      allowDecimal: true, 
      min: 0.01,
      max: maxPayment * 1.1, // Allow slight overpayment
      required: true 
    });
    if (!paymentValidation.valid) {
      alert('Payment Amount: ' + paymentValidation.error);
      return;
    }
    
    try {
      const newPaidAmount = selectedInvoice.paidAmount + paymentAmount;
      const newStatus = newPaidAmount >= selectedInvoice.total ? 'paid' : selectedInvoice.status;
      await api.updateInvoice(selectedInvoice.id, { paid_amount: newPaidAmount, status: newStatus });
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      setPaymentAmount(0);
      fetchInvoices();
    } catch (error) { console.error('Failed to record payment:', error); }
  };

  const openEditModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setEditData({
      status: invoice.status,
      due_date: format(new Date(invoice.dueDate), 'yyyy-MM-dd'),
      notes: invoice.notes || '',
    });
    setShowEditModal(true);
  };

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.total - invoice.paidAmount);
    setShowPaymentModal(true);
  };

  const addLineItem = () => setFormData({ ...formData, items: [...formData.items, { description: '', quantity: 1, unitPrice: 0 }] });
  const updateLineItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const pendingInvoices = invoices.filter((i) => ['sent', 'draft'].includes(i.status));
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
  const pendingAmount = pendingInvoices.reduce((sum, i) => sum + (i.total - i.paidAmount), 0);

  const tableColumns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', sortable: true, render: (invoice) => <span className="font-mono font-medium text-primary-600">{invoice.invoiceNumber}</span> },
    { key: 'clientId', header: 'Client', render: (invoice) => { const client = clients.find((c) => c.id === invoice.clientId); return client?.companyName || '-'; } },
    { key: 'issueDate', header: 'Issue Date', sortable: true, render: (invoice) => format(new Date(invoice.issueDate), 'MMM d, yyyy') },
    { key: 'dueDate', header: 'Due Date', sortable: true, render: (invoice) => { const date = new Date(invoice.dueDate); const isOverdue = date < new Date() && invoice.status !== 'paid'; return <span className={isOverdue ? 'text-danger-600 font-medium' : ''}>{format(date, 'MMM d, yyyy')}</span>; } },
    { key: 'total', header: 'Amount', sortable: true, render: (invoice) => <span className="font-semibold">RM {invoice.total.toLocaleString()}</span> },
    { key: 'paidAmount', header: 'Paid', render: (invoice) => <span className={invoice.paidAmount >= invoice.total ? 'text-success-600' : ''}>RM {invoice.paidAmount.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: (invoice) => { const colors: Record<string, string> = { draft: 'badge-neutral', sent: 'badge-primary', paid: 'badge-success', overdue: 'badge-danger', cancelled: 'badge-neutral' }; return <span className={`badge ${colors[invoice.status]}`}>{invoice.status}</span>; } },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); openEditModal(invoice); }} className="p-1.5 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button onClick={(e) => { e.stopPropagation(); openPaymentModal(invoice); }} className="p-1.5 bg-success-100 text-success-600 rounded-lg hover:bg-success-200 transition-colors" title="Record Payment">
              <CreditCard className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Accounts & Finance" subtitle={`${invoices.length} total invoices`} showAddButton addButtonText="Create Invoice" onAddClick={() => setShowAddModal(true)} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="Total Revenue" value={`RM ${totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="success" trend={{ value: 15, direction: 'up' }} />
          <StatsCard title="Pending Payments" value={`RM ${pendingAmount.toLocaleString()}`} icon={<Clock className="w-5 h-5" />} color="warning" />
          <StatsCard title="Paid Invoices" value={paidInvoices.length} icon={<CheckCircle className="w-5 h-5" />} color="success" />
          <StatsCard title="Overdue" value={overdueInvoices.length} icon={<AlertCircle className="w-5 h-5" />} color={overdueInvoices.length > 0 ? 'danger' : 'success'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-success-500" />
              <h3 className="font-semibold text-neutral-900">Recently Paid</h3>
            </div>
            <div className="space-y-3">
              {paidInvoices.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">No paid invoices</p>
              ) : (
                paidInvoices.slice(0, 3).map((invoice) => {
                  const client = clients.find((c) => c.id === invoice.clientId);
                  return (
                    <div key={invoice.id} className="flex items-center justify-between p-3 bg-success-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-neutral-500">{client?.companyName}</p>
                      </div>
                      <span className="font-semibold text-success-600">RM {invoice.total.toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-warning-500" />
              <h3 className="font-semibold text-neutral-900">Pending Payment</h3>
            </div>
            <div className="space-y-3">
              {pendingInvoices.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">No pending invoices</p>
              ) : (
                pendingInvoices.slice(0, 3).map((invoice) => {
                  const client = clients.find((c) => c.id === invoice.clientId);
                  return (
                    <div key={invoice.id} className="flex items-center justify-between p-3 bg-warning-50 rounded-lg cursor-pointer hover:bg-warning-100" onClick={() => openPaymentModal(invoice)}>
                      <div>
                        <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-neutral-500">{client?.companyName}</p>
                      </div>
                      <span className="font-semibold text-warning-600">RM {(invoice.total - invoice.paidAmount).toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-neutral-900">This Month</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Invoices Created</span>
                <span className="font-semibold">{invoices.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Collection Rate</span>
                <span className="font-semibold text-success-600">{invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Average Invoice</span>
                <span className="font-semibold">RM {invoices.length > 0 ? Math.round(invoices.reduce((sum, i) => sum + i.total, 0) / invoices.length).toLocaleString() : 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 mb-4">All Invoices</h3>
          <DataTable columns={tableColumns} data={invoices} />
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create Invoice</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddInvoice} className="p-6 space-y-4">
              <div>
                <label className="label">Client *</label>
                <select className="input" required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
                  <option value="">Select client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Issue Date *</label>
                  <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} required readOnly value={formData.issue_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Due Date *</label>
                  <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} required readOnly value={formData.due_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Line Items</label>
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2">
                      <input type="text" placeholder="Description" className="input col-span-6" value={item.description} onChange={(e) => updateLineItem(index, 'description', e.target.value)} />
                      <input type="number" placeholder="Qty" className="input col-span-2" value={item.quantity} onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                      <input type="number" placeholder="Price" className="input col-span-3" value={item.unitPrice} onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                      <span className="col-span-1 flex items-center justify-end text-sm font-medium">RM {(item.quantity * item.unitPrice).toFixed(0)}</span>
                    </div>
                  ))}
                  <button type="button" onClick={addLineItem} className="text-sm text-primary-600 hover:text-primary-700">+ Add Line Item</button>
                </div>
              </div>
              <div className="text-right border-t pt-4">
                <p className="text-lg font-semibold">Total: RM {formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Invoice {selectedInvoice.invoiceNumber}</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedInvoice(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditInvoice} className="p-6 space-y-4">
              <div>
                <label className="label">Status</label>
                <select className="input" value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} readOnly value={editData.due_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setEditData({ ...editData, due_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input min-h-[80px]" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} placeholder="Internal notes..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedInvoice(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Record Payment</h2>
              <button onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-neutral-600">Invoice</span>
                  <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-neutral-600">Total Amount</span>
                  <span className="font-medium">RM {selectedInvoice.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-neutral-600">Already Paid</span>
                  <span className="font-medium text-success-600">RM {selectedInvoice.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-neutral-900 font-medium">Balance Due</span>
                  <span className="font-bold text-danger-600">RM {(selectedInvoice.total - selectedInvoice.paidAmount).toLocaleString()}</span>
                </div>
              </div>
              <div>
                <label className="label">Payment Amount (RM) *</label>
                <input 
                  type="number" 
                  className="input" 
                  required 
                  min="0.01"
                  step="0.01"
                  max={selectedInvoice.total - selectedInvoice.paidAmount}
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
