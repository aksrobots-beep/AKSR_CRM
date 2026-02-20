import { useEffect, useState } from 'react';
import { Header } from '../components/layout';
import { DataTable, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import type { LeaveRequest } from '../types';
import { format } from 'date-fns';
import { Calendar, Check, X, Clock, Edit, Users } from 'lucide-react';
import { api } from '../services/api';
import { validateDate, DATE_INPUT_MIN, DATE_INPUT_MAX } from '../utils/validateDate';

export function HR() {
  const { leaveRequests, users, fetchUsers, updateLeaveStatus, fetchLeaveRequests, addLeaveRequest } = useAppStore();
  const { hasPermission } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [formData, setFormData] = useState({ type: 'annual', start_date: '', end_date: '', days: 1, reason: '' });
  const [editData, setEditData] = useState({ type: 'annual', start_date: '', end_date: '', days: 1, reason: '' });

  useEffect(() => { 
    fetchLeaveRequests(); 
    fetchUsers();
  }, []);

  const canApprove = hasPermission(['ceo', 'admin', 'hr_manager']);
  const pendingRequests = leaveRequests.filter((l) => l.status === 'pending');
  const approvedRequests = leaveRequests.filter((l) => l.status === 'approved');

  const handleApprove = (id: string) => { updateLeaveStatus(id, 'approved'); };
  const handleReject = (id: string) => { updateLeaveStatus(id, 'rejected'); };

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const startResult = validateDate(formData.start_date, { required: true, fieldName: 'Start date' });
    if (!startResult.valid) { alert(startResult.error); return; }
    const endResult = validateDate(formData.end_date, { required: true, fieldName: 'End date' });
    if (!endResult.valid) { alert(endResult.error); return; }
    try {
      await addLeaveRequest(formData as any);
      setShowAddModal(false);
      setFormData({ type: 'annual', start_date: '', end_date: '', days: 1, reason: '' });
    } catch (error) { console.error('Failed to add leave request:', error); }
  };

  const handleEditRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const startResult = validateDate(editData.start_date, { required: true, fieldName: 'Start date' });
    if (!startResult.valid) { alert(startResult.error); return; }
    const endResult = validateDate(editData.end_date, { required: true, fieldName: 'End date' });
    if (!endResult.valid) { alert(endResult.error); return; }
    try {
      await api.updateLeaveRequest(selectedRequest.id, editData);
      setShowEditModal(false);
      setSelectedRequest(null);
      fetchLeaveRequests();
    } catch (error) { console.error('Failed to update leave request:', error); }
  };

  const openEditModal = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setEditData({
      type: request.type,
      start_date: format(new Date(request.startDate), 'yyyy-MM-dd'),
      end_date: format(new Date(request.endDate), 'yyyy-MM-dd'),
      days: request.days,
      reason: request.reason || '',
    });
    setShowEditModal(true);
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = users.find((u: any) => u.id === employeeId);
    return employee?.name || 'Unknown';
  };

  const tableColumns: Column<LeaveRequest>[] = [
    { 
      key: 'employeeId', 
      header: 'Employee', 
      render: (request) => {
        const employee = users.find((u: any) => u.id === request.employeeId);
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm">
              {employee?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
            </div>
            <div>
              <p className="font-medium text-neutral-900">{employee?.name || 'Unknown'}</p>
              <p className="text-xs text-neutral-500">{employee?.department || '-'}</p>
            </div>
          </div>
        );
      } 
    },
    { key: 'type', header: 'Type', sortable: true, render: (request) => <span className="badge-neutral capitalize">{request.type}</span> },
    { key: 'startDate', header: 'From', sortable: true, render: (request) => format(new Date(request.startDate), 'MMM d, yyyy') },
    { key: 'endDate', header: 'To', sortable: true, render: (request) => format(new Date(request.endDate), 'MMM d, yyyy') },
    { key: 'days', header: 'Days', sortable: true, render: (request) => <span className="font-semibold">{request.days}</span> },
    { key: 'reason', header: 'Reason', render: (request) => <p className="text-sm text-neutral-600 max-w-xs truncate">{request.reason}</p> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (request) => { 
        const colors: Record<string, string> = { pending: 'bg-warning-100 text-warning-700', approved: 'badge-success', rejected: 'badge-danger', cancelled: 'badge-neutral' }; 
        return <span className={`badge ${colors[request.status]}`}>{request.status}</span>; 
      } 
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (request) => (
        <div className="flex items-center gap-2">
          {request.status === 'pending' && (
            <button onClick={(e) => { e.stopPropagation(); openEditModal(request); }} className="p-1.5 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors" title="Edit">
              <Edit className="w-4 h-4" />
            </button>
          )}
          {canApprove && request.status === 'pending' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleApprove(request.id); }} className="p-1.5 bg-success-100 text-success-600 rounded-lg hover:bg-success-200 transition-colors" title="Approve">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleReject(request.id); }} className="p-1.5 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200 transition-colors" title="Reject">
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {request.status !== 'pending' && <span className="text-sm text-neutral-400">-</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="HR & Leave Management" subtitle={`${pendingRequests.length} pending requests`} showAddButton addButtonText="New Request" onAddClick={() => setShowAddModal(true)} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{users.filter((u: any) => u.isActive).length}</p>
                <p className="text-sm text-neutral-500">Active Employees</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{pendingRequests.length}</p>
                <p className="text-sm text-neutral-500">Pending Approval</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{approvedRequests.length}</p>
                <p className="text-sm text-neutral-500">Approved</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{leaveRequests.reduce((sum, l) => sum + (l.status === 'approved' ? l.days : 0), 0)}</p>
                <p className="text-sm text-neutral-500">Total Days Taken</p>
              </div>
            </div>
          </div>
        </div>

        {canApprove && pendingRequests.length > 0 && (
          <div className="card p-4 border-warning-200 bg-warning-50">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-warning-600" />
              <h3 className="font-semibold text-warning-800">Pending Approval</h3>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center font-semibold text-sm">
                      {getEmployeeName(request.employeeId).split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{getEmployeeName(request.employeeId)}</p>
                      <p className="text-xs text-neutral-500">{format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')} ({request.days} days)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-neutral capitalize mr-2">{request.type}</span>
                    <button onClick={() => handleApprove(request.id)} className="btn-primary py-1.5 px-3 text-sm">Approve</button>
                    <button onClick={() => handleReject(request.id)} className="btn-secondary py-1.5 px-3 text-sm">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-neutral-900 mb-4">All Leave Requests</h3>
          <DataTable columns={tableColumns} data={leaveRequests} />
        </div>
      </div>

      {/* Add Leave Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">New Leave Request</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddRequest} className="p-6 space-y-4">
              <div>
                <label className="label">Leave Type</label>
                <select className="input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date *</label>
                  <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} required readOnly value={formData.start_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">End Date *</label>
                  <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} required readOnly value={formData.end_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Number of Days *</label>
                <input type="number" className="input" min="1" required value={formData.days} onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea className="input min-h-[80px]" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Reason for leave..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Leave Request Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Leave Request</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedRequest(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditRequest} className="p-6 space-y-4">
              <div>
                <label className="label">Leave Type</label>
                <select className="input" value={editData.type} onChange={(e) => setEditData({ ...editData, type: e.target.value })}>
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date *</label>
                  <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} required readOnly value={editData.start_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setEditData({ ...editData, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">End Date *</label>
                  <input type="date" className="input" min={DATE_INPUT_MIN} max={DATE_INPUT_MAX} required readOnly value={editData.end_date} onKeyDown={(e) => e.preventDefault()} onChange={(e) => setEditData({ ...editData, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Number of Days *</label>
                <input type="number" className="input" min="1" required value={editData.days} onChange={(e) => setEditData({ ...editData, days: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea className="input min-h-[80px]" value={editData.reason} onChange={(e) => setEditData({ ...editData, reason: e.target.value })} placeholder="Reason for leave..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedRequest(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
