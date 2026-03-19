import { useMemo, useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { KanbanBoard, DataTable, Calendar, DatePickerField, type KanbanColumnDef, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import type { ServiceTicket, TicketStatus } from '../types';
import { format } from 'date-fns';
import { X, Calendar as CalendarIcon, User, Tag, AlertCircle, UserCheck, Edit, Clock, FileText, CalendarClock, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { validateDate, DATE_INPUT_MIN, DATE_INPUT_MAX } from '../utils/validateDate';

interface Technician {
  id: string;
  name: string;
  role: string;
}

const statusColumns: { id: TicketStatus; title: string; color: string }[] = [
  { id: 'new', title: 'New', color: 'bg-primary-500' },
  { id: 'assigned', title: 'Assigned', color: 'bg-purple-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-warning-500' },
  { id: 'pending_parts', title: 'Pending Parts', color: 'bg-orange-500' },
  { id: 'on_hold', title: 'On Hold', color: 'bg-neutral-500' },
  { id: 'resolved', title: 'Resolved', color: 'bg-success-500' },
];

export function ServiceTickets() {
  const { tickets, clients, equipment, updateTicketStatus, activeView, fetchTickets, fetchClients, fetchEquipment, addTicket, updateTicket, deleteTicket, toggleTicketActive } = useAppStore();
  const { user, hasPermission } = useAuthStore();
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    client_id: '', 
    assigned_to: '',
    due_date: '',
    next_action_date: '',
    next_action_item: '',
    is_billable: true,
  });
  const [editData, setEditData] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    status: 'new', 
    assigned_to: '',
    due_date: '',
    next_action_date: '',
    next_action_item: '',
    action_taken: '',
    is_billable: true,
  });

  const isTechnician = user?.role === 'technician';
  const canAssign = hasPermission(['ceo', 'admin', 'service_manager']);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetchTickets();
    fetchClients();
    fetchEquipment();
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      const data = await api.getTechnicians();
      setTechnicians(data);
    } catch (error) {
      console.error('Failed to load technicians:', error);
    }
  };

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const dueResult = validateDate(formData.due_date, { required: false, fieldName: 'Due date' });
    if (!dueResult.valid) { alert(dueResult.error); return; }
    const nextResult = validateDate(formData.next_action_date, { required: false, fieldName: 'Next action date' });
    if (!nextResult.valid) { alert(nextResult.error); return; }
    if (formData.due_date && formData.due_date < today) { alert('Due date cannot be in the past'); return; }
    if (formData.next_action_date && formData.next_action_date < today) { alert('Next action date cannot be in the past'); return; }
    try {
      await addTicket(formData as any);
      setShowAddModal(false);
      setFormData({ title: '', description: '', priority: 'medium', client_id: '', assigned_to: '', due_date: '', next_action_date: '', next_action_item: '', is_billable: true });
    } catch (error) {
      console.error('Failed to add ticket:', error);
    }
  };

  const handleEditTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const dueResult = validateDate(editData.due_date, { required: false, fieldName: 'Due date' });
    if (!dueResult.valid) { alert(dueResult.error); return; }
    const nextResult = validateDate(editData.next_action_date, { required: false, fieldName: 'Next action date' });
    if (!nextResult.valid) { alert(nextResult.error); return; }
    try {
      await updateTicket(selectedTicket.id, editData as any);
      setShowEditModal(false);
      setSelectedTicket(null);
      setEditData({ title: '', description: '', priority: 'medium', status: 'new', assigned_to: '', due_date: '', next_action_date: '', next_action_item: '', action_taken: '', is_billable: true });
    } catch (error: any) {
      console.error('Failed to update ticket:', error);
      alert(error?.message || 'Failed to update ticket');
    }
  };

  const handleAssignTicket = async (technicianId: string) => {
    if (!selectedTicket) return;
    try {
      await api.assignTicket(selectedTicket.id, technicianId || null);
      await fetchTickets();
      setShowAssignModal(false);
      setSelectedTicket(null);
    } catch (error) {
      console.error('Failed to assign ticket:', error);
    }
  };

  const openEditModal = () => {
    if (!selectedTicket) return;
    setEditData({
      title: selectedTicket.title,
      description: selectedTicket.description || '',
      priority: selectedTicket.priority,
      status: selectedTicket.status,
      assigned_to: selectedTicket.assignedTo || '',
      due_date: selectedTicket.dueDate ? format(new Date(selectedTicket.dueDate), 'yyyy-MM-dd') : '',
      next_action_date: selectedTicket.nextActionDate ? format(new Date(selectedTicket.nextActionDate), 'yyyy-MM-dd') : '',
      next_action_item: selectedTicket.nextActionItem || '',
      action_taken: selectedTicket.actionTaken || '',
      is_billable: selectedTicket.isBillable !== false,
    });
    setShowEditModal(true);
  };

  const getAssigneeName = (ticket: any) => {
    return ticket.assignedToName || (technicians.find(t => t.id === ticket.assignedTo)?.name) || null;
  };

  const handleToggleActive = async (ticket: ServiceTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleTicketActive(ticket.id, !ticket.isActive);
    } catch (error) {
      console.error('Failed to toggle ticket status:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTicket) return;
    if (!confirm(`Are you sure you want to delete ticket ${selectedTicket.ticketNumber}?`)) return;
    try {
      await deleteTicket(selectedTicket.id);
      setSelectedTicket(null);
    } catch (error) {
      console.error('Failed to delete ticket:', error);
    }
  };

  const handleDeleteFromTable = async (ticket: ServiceTicket) => {
    if (!confirm(`Are you sure you want to delete ticket ${ticket.ticketNumber}?`)) return;
    try {
      await deleteTicket(ticket.id);
      await fetchTickets();
    } catch (error) {
      console.error('Failed to delete ticket:', error);
    }
  };

  const kanbanColumns: KanbanColumnDef[] = useMemo(() => {
    return statusColumns.map((col) => ({
      id: col.id,
      title: col.title,
      color: col.color,
      items: tickets
        .filter((t) => t.status === col.id)
        .map((t) => {
          const client = clients.find((c) => c.id === t.clientId);
          const assigneeName = getAssigneeName(t);
          return {
            id: t.id,
            title: t.title,
            subtitle: client?.companyName || t.ticketNumber,
            priority: t.priority,
            dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
            tags: t.tags,
            assignee: assigneeName ? { name: assigneeName } : undefined,
          };
        }),
    }));
  }, [tickets, clients, technicians]);

  const handleDragEnd = async (itemId: string, _sourceColumnId: string, targetColumnId: string) => {
    try {
      await updateTicketStatus(itemId, targetColumnId as TicketStatus);
    } catch (error: any) {
      console.error('Failed to update ticket status:', error);
      alert(error?.message || 'Failed to update ticket status');
    }
  };

  const handleItemClick = (item: { id: string }) => {
    const ticket = tickets.find((t) => t.id === item.id);
    if (ticket) setSelectedTicket(ticket);
  };

  // Enrich tickets with equipment data for search
  const enrichedTickets = tickets.map(ticket => {
    const relatedEquipment = equipment.find(eq => eq.id === ticket.equipmentId);
    return {
      ...ticket,
      // Add searchable equipment fields
      equipmentName: relatedEquipment?.name || '',
      equipmentSerialNumber: relatedEquipment?.serialNumber || '',
      equipmentModel: relatedEquipment?.model || '',
    };
  });

  const tableColumns: Column<ServiceTicket>[] = [
    { key: 'ticketNumber', header: 'Ticket #', sortable: true, searchable: true, render: (ticket) => <span className="font-mono text-sm font-medium text-primary-600">{ticket.ticketNumber}</span> },
    { key: 'title', header: 'Title', sortable: true, searchable: true, render: (ticket) => <div className="max-w-xs"><p className="font-medium text-neutral-900 truncate">{ticket.title}</p></div> },
    { key: 'clientId', header: 'Client', searchable: true, render: (ticket) => { const client = clients.find((c) => c.id === ticket.clientId); return <span>{client?.companyName || '-'}</span>; } },
    { 
      key: 'equipmentId', 
      header: 'Contract', 
      searchable: true, 
      render: (ticket) => {
        const relatedEquipment = equipment.find(eq => eq.id === ticket.equipmentId);
        if (!relatedEquipment) return <span className="text-neutral-400">-</span>;
        return (
          <div>
            <p className="font-medium text-sm">{relatedEquipment.name}</p>
            {relatedEquipment.serialNumber && (
              <p className="text-xs text-neutral-500 font-mono">{relatedEquipment.serialNumber}</p>
            )}
          </div>
        );
      }
    },
    { 
      key: 'assignedTo', 
      header: 'Assigned To', 
      sortable: true,
      render: (ticket: any) => {
        const assigneeName = getAssigneeName(ticket);
        return assigneeName ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-medium text-primary-600">{assigneeName.charAt(0)}</span>
            </div>
            <span className="text-sm">{assigneeName}</span>
          </div>
        ) : (
          <span className="text-neutral-400 text-sm">Unassigned</span>
        );
      }
    },
    { key: 'priority', header: 'Priority', sortable: true, render: (ticket) => { const colors: Record<string, string> = { low: 'badge-neutral', medium: 'badge-primary', high: 'badge-warning', critical: 'badge-danger' }; return <span className={`badge ${colors[ticket.priority]}`}>{ticket.priority}</span>; } },
    { key: 'status', header: 'Status', sortable: true, render: (ticket) => { const colors: Record<string, string> = { new: 'bg-primary-100 text-primary-700', assigned: 'bg-purple-100 text-purple-700', in_progress: 'bg-warning-100 text-warning-700', pending_parts: 'bg-orange-100 text-orange-700', on_hold: 'bg-neutral-100 text-neutral-700', resolved: 'bg-success-100 text-success-700', closed: 'bg-neutral-200 text-neutral-700' }; return <span className={`badge ${colors[ticket.status]}`}>{ticket.status.replace('_', ' ')}</span>; } },
    { key: 'isBillable', header: 'Billable', sortable: true, render: (ticket) => (ticket.isBillable !== false ? <span className="badge bg-success-100 text-success-700">Billable</span> : <span className="badge bg-neutral-200 text-neutral-600">Non-billable</span>) },
    {
      key: 'isActive',
      header: 'Active',
      render: (ticket) => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={ticket.isActive}
            onChange={(e) => handleToggleActive(ticket, e as any)}
            onClick={(e) => e.stopPropagation()}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-500"></div>
        </label>
      ),
    },
    { key: 'createdAt', header: 'Created', sortable: true, render: (ticket) => format(new Date(ticket.createdAt), 'MMM d, yyyy') },
    { key: 'dueDate', header: 'Due Date', sortable: true, render: (ticket) => ticket.dueDate ? format(new Date(ticket.dueDate), 'MMM d, yyyy') : '-' },
    { key: 'nextActionDate', header: 'Next Action', sortable: true, render: (ticket) => ticket.nextActionDate ? <span className="text-primary-600 font-medium">{format(new Date(ticket.nextActionDate), 'MMM d')}</span> : '-' },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (ticket) => (
        <div className="text-sm">
          <div className="text-neutral-900">{format(new Date(ticket.updatedAt), 'MMM d, yyyy')}</div>
          <div className="text-xs text-neutral-500">{format(new Date(ticket.updatedAt), 'h:mm a')}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (ticket) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTicket(ticket);
              openEditModal();
            }}
            className="p-2 hover:bg-primary-50 rounded-lg text-primary-600"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFromTable(ticket);
            }}
            className="p-2 hover:bg-danger-50 rounded-lg text-danger-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header 
        title="Service Tickets" 
        subtitle={isTechnician ? `${tickets.length} assigned to you` : `${tickets.length} total tickets`} 
        showViewToggle 
        showAddButton={true}
        addButtonText="New Ticket" 
        onAddClick={() => setShowAddModal(true)} 
      />

      {isTechnician && (
        <div className="mx-6 mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary-600" />
            <span className="text-sm text-primary-700">Showing tickets assigned to you</span>
          </div>
          <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <span>New Ticket</span>
          </button>
        </div>
      )}

      <div className="p-6">
        {activeView === 'kanban' ? (
          <KanbanBoard columns={kanbanColumns} onDragEnd={handleDragEnd} onItemClick={handleItemClick} />
        ) : activeView === 'table' ? (
          <DataTable columns={tableColumns} data={enrichedTickets} onRowClick={(ticket) => setSelectedTicket(ticket)} />
        ) : (
          <Calendar 
            events={tickets.map(t => ({
              id: t.id,
              title: t.title,
              date: t.dueDate || t.nextActionDate || t.createdAt,
              priority: t.priority,
            }))}
            onEventClick={(event) => {
              const ticket = tickets.find(t => t.id === event.id);
              if (ticket) setSelectedTicket(ticket);
            }}
          />
        )}
      </div>

      {/* Add Ticket Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">New Service Ticket</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddTicket} className="p-6 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input type="text" className="input" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Describe the issue" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Detailed description..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Client *</label>
                  <select className="input" required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
                    <option value="">Select client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              {canAssign && (
                <div>
                  <label className="label">Assign To</label>
                  <select className="input" value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}>
                    <option value="">Unassigned</option>
                    {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role.replace('_', ' ')})</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Due Date</label>
                  <DatePickerField
                    value={formData.due_date}
                    onChange={(v) => setFormData({ ...formData, due_date: v })}
                    min={today}
                    max={DATE_INPUT_MAX}
                  />
                </div>
                <div>
                  <label className="label">Next Action Date</label>
                  <DatePickerField
                    value={formData.next_action_date}
                    onChange={(v) => setFormData({ ...formData, next_action_date: v })}
                    min={today}
                    max={DATE_INPUT_MAX}
                  />
                </div>
              </div>
              <div>
                <label className="label">Next Action Item</label>
                <input type="text" className="input" value={formData.next_action_item} onChange={(e) => setFormData({ ...formData, next_action_item: e.target.value })} placeholder="What needs to be done next?" />
              </div>
              <div>
                <label className="label">Billing</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billable"
                      checked={formData.is_billable === true}
                      onChange={() => setFormData({ ...formData, is_billable: true })}
                      className="rounded-full border-neutral-300 text-primary-600"
                    />
                    <span>Billable</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billable"
                      checked={formData.is_billable === false}
                      onChange={() => setFormData({ ...formData, is_billable: false })}
                      className="rounded-full border-neutral-300 text-primary-600"
                    />
                    <span>Non-billable</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {showEditModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Edit Ticket</h2>
                <p className="text-sm text-neutral-500">{selectedTicket.ticketNumber}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditTicket} className="p-6 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input type="text" className="input" required value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={editData.priority} onChange={(e) => setEditData({ ...editData, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>
                    {statusColumns.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              {canAssign && (
                <div>
                  <label className="label">Assign To</label>
                  <select className="input" value={editData.assigned_to} onChange={(e) => setEditData({ ...editData, assigned_to: e.target.value })}>
                    <option value="">Unassigned</option>
                    {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role.replace('_', ' ')})</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Due Date</label>
                  <DatePickerField
                    value={editData.due_date}
                    onChange={(v) => setEditData({ ...editData, due_date: v })}
                    min={DATE_INPUT_MIN}
                    max={DATE_INPUT_MAX}
                  />
                </div>
                <div>
                  <label className="label">Next Action Date</label>
                  <DatePickerField
                    value={editData.next_action_date}
                    onChange={(v) => setEditData({ ...editData, next_action_date: v })}
                    min={DATE_INPUT_MIN}
                    max={DATE_INPUT_MAX}
                  />
                </div>
              </div>
              <div>
                <label className="label">Next Action Item</label>
                <input type="text" className="input" value={editData.next_action_item} onChange={(e) => setEditData({ ...editData, next_action_item: e.target.value })} placeholder="What needs to be done next?" />
              </div>
              <div>
                <label className="label">Action Taken / Notes</label>
                <textarea className="input min-h-[100px]" value={editData.action_taken} onChange={(e) => setEditData({ ...editData, action_taken: e.target.value })} placeholder="Document actions taken, findings, updates..." />
              </div>
              <div>
                <label className="label">Billing</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-billable"
                      checked={editData.is_billable === true}
                      onChange={() => setEditData({ ...editData, is_billable: true })}
                      className="rounded-full border-neutral-300 text-primary-600"
                    />
                    <span>Billable</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-billable"
                      checked={editData.is_billable === false}
                      onChange={() => setEditData({ ...editData, is_billable: false })}
                      className="rounded-full border-neutral-300 text-primary-600"
                    />
                    <span>Non-billable</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Ticket Modal */}
      {showAssignModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Assign Ticket</h2>
                <p className="text-sm text-neutral-500">{selectedTicket.ticketNumber}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => handleAssignTicket('')}
                className="w-full p-3 text-left rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                <p className="font-medium text-neutral-600">Unassigned</p>
                <p className="text-xs text-neutral-400">Remove current assignment</p>
              </button>
              {technicians.map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => handleAssignTicket(tech.id)}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    selectedTicket.assignedTo === tech.id 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="font-medium text-primary-600">{tech.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{tech.name}</p>
                      <p className="text-xs text-neutral-500 capitalize">{tech.role.replace('_', ' ')}</p>
                    </div>
                    {selectedTicket.assignedTo === tech.id && (
                      <span className="ml-auto badge-success">Current</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && !showEditModal && !showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-start justify-between">
              <div>
                <span className="font-mono text-sm text-primary-600">{selectedTicket.ticketNumber}</span>
                <h2 className="text-xl font-semibold text-neutral-900 mt-1">{selectedTicket.title}</h2>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Key Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Priority</p>
                    <p className="font-medium capitalize">{selectedTicket.priority}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Status</p>
                    <p className="font-medium capitalize">{selectedTicket.status.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Assigned To</p>
                    <p className="font-medium">{getAssigneeName(selectedTicket) || 'Unassigned'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Billing</p>
                    <p className="font-medium">{selectedTicket.isBillable !== false ? 'Billable' : 'Non-billable'}</p>
                  </div>
                </div>
              </div>

              {/* Dates Section */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <span className="text-xs text-neutral-500">Created</span>
                  </div>
                  <p className="font-medium text-sm">{format(new Date(selectedTicket.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-4 h-4 text-neutral-400" />
                    <span className="text-xs text-neutral-500">Due Date</span>
                  </div>
                  <p className="font-medium text-sm">{selectedTicket.dueDate ? format(new Date(selectedTicket.dueDate), 'MMM d, yyyy') : 'Not set'}</p>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg border border-primary-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock className="w-4 h-4 text-primary-500" />
                    <span className="text-xs text-primary-600">Next Action</span>
                  </div>
                  <p className="font-medium text-sm text-primary-700">{selectedTicket.nextActionDate ? format(new Date(selectedTicket.nextActionDate), 'MMM d, yyyy') : 'Not set'}</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <span className="text-xs text-neutral-500">Updated</span>
                  </div>
                  <p className="font-medium text-sm">{format(new Date(selectedTicket.updatedAt), 'MMM d, yyyy')}</p>
                </div>
              </div>

              {/* Next Action Item */}
              {selectedTicket.nextActionItem && (
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarClock className="w-5 h-5 text-primary-600" />
                    <h4 className="font-medium text-primary-800">Next Action Item</h4>
                  </div>
                  <p className="text-primary-700">{selectedTicket.nextActionItem}</p>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="font-medium text-neutral-900 mb-2">Description</h4>
                <p className="text-neutral-600">{selectedTicket.description || 'No description'}</p>
              </div>

              {/* Action Taken */}
              {selectedTicket.actionTaken && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-neutral-500" />
                    <h4 className="font-medium text-neutral-900">Action Taken / Notes</h4>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-neutral-700 whitespace-pre-wrap">{selectedTicket.actionTaken}</p>
                  </div>
                </div>
              )}
              
              {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-900 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.tags.map((tag) => <span key={tag} className="badge-neutral">{tag}</span>)}
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 pt-4 border-t border-neutral-200">
                {canAssign && (
                  <button onClick={() => setShowAssignModal(true)} className="btn-primary flex-1">
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign
                  </button>
                )}
                <button onClick={openEditModal} className="btn-secondary flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Ticket
                </button>
                <button onClick={handleDelete} className="btn-secondary text-danger-600 hover:bg-danger-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
