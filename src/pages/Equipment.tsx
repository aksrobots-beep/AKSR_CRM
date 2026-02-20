import { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { DataTable, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import type { Equipment } from '../types';
import { format } from 'date-fns';
import { X, Wrench, Bot, Calendar, MapPin, Shield, AlertTriangle, Ticket } from 'lucide-react';

interface EquipmentPageProps {
  robotsOnly?: boolean;
}

export function EquipmentPage({ robotsOnly = false }: EquipmentPageProps) {
  const { equipment, clients, tickets, fetchEquipment, fetchClients, fetchTickets, addEquipment, updateEquipmentItem, addTicket } = useAppStore();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [filter, setFilter] = useState<'all' | 'kitchen' | 'robot'>(robotsOnly ? 'robot' : 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    type: robotsOnly ? 'robot' : 'kitchen', 
    model: '', 
    serial_number: '', 
    manufacturer: '', 
    client_id: '', 
    location: '',
    status: 'operational',
    installation_date: '',
    last_service_date: '',
  });
  const [ticketData, setTicketData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    client_id: '',
    equipment_id: '',
  });

  useEffect(() => {
    fetchEquipment();
    fetchClients();
    fetchTickets();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await api.getSuppliers();
      const transformed = data.map((s: any) => ({
        id: s.id,
        name: s.name,
      }));
      setSuppliers(transformed);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  useEffect(() => {
    if (robotsOnly) setFilter('robot');
  }, [robotsOnly]);

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // For robots, calculate next service date if status is operational
      let nextServiceDate = null;
      if (robotsOnly && formData.status === 'operational') {
        // If adding a new robot, next service will be calculated after first service
        // For now, set to 3 months from today as initial estimate
        const date = new Date();
        date.setMonth(date.getMonth() + 3);
        nextServiceDate = date.toISOString().split('T')[0];
      }
      
      await addEquipment({
        ...formData,
        next_service_date: nextServiceDate,
      } as any);
      setShowAddModal(false);
      setFormData({ name: '', type: robotsOnly ? 'robot' : 'kitchen', model: '', serial_number: '', manufacturer: '', client_id: '', location: '', status: 'operational', installation_date: '', last_service_date: '' });
    } catch (error) {
      console.error('Failed to add equipment:', error);
    }
  };

  const handleEditEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    try {
      const updateData: any = { ...formData };
      if (robotsOnly && formData.installation_date) {
        updateData.installation_date = formData.installation_date;
      }
      if (robotsOnly) {
        if (formData.last_service_date) {
          updateData.last_service_date = formData.last_service_date;
        } else {
          // Allow clearing the last service date
          updateData.last_service_date = null;
        }
      }
      await updateEquipmentItem(selectedEquipment.id, updateData);
      setShowEditModal(false);
      setSelectedEquipment(null);
      setFormData({ name: '', type: robotsOnly ? 'robot' : 'kitchen', model: '', serial_number: '', manufacturer: '', client_id: '', location: '', status: 'operational', installation_date: '', last_service_date: '' });
    } catch (error) {
      console.error('Failed to update equipment:', error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addTicket(ticketData as any);
      setShowTicketModal(false);
      setTicketData({ title: '', description: '', priority: 'medium', client_id: '', equipment_id: '' });
      setSelectedEquipment(null);
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  const openEditModal = () => {
    if (!selectedEquipment) return;
    const installationDate = selectedEquipment.installationDate 
      ? new Date(selectedEquipment.installationDate).toISOString().split('T')[0]
      : '';
    
    // Calculate last service date from resolved tickets
    const equipmentTickets = tickets.filter(t => t.equipmentId === selectedEquipment.id && t.status === 'resolved');
    let lastServiceDate = '';
    if (equipmentTickets.length > 0) {
      const serviceDates = equipmentTickets
        .map(t => t.resolvedAt ? new Date(t.resolvedAt).getTime() : 0)
        .filter(d => d > 0)
        .sort((a, b) => b - a);
      if (serviceDates.length > 0) {
        lastServiceDate = new Date(serviceDates[0]).toISOString().split('T')[0];
      }
    } else if (selectedEquipment.lastServiceDate) {
      lastServiceDate = new Date(selectedEquipment.lastServiceDate).toISOString().split('T')[0];
    }
    
    setFormData({
      name: selectedEquipment.name,
      type: selectedEquipment.type,
      model: selectedEquipment.model || '',
      serial_number: selectedEquipment.serialNumber || '',
      manufacturer: selectedEquipment.manufacturer || '',
      client_id: selectedEquipment.clientId || '',
      location: selectedEquipment.location || '',
      status: selectedEquipment.status || 'operational',
      installation_date: installationDate,
      last_service_date: lastServiceDate,
    });
    setShowEditModal(true);
  };

  const openTicketModal = () => {
    if (!selectedEquipment) return;
    setTicketData({
      title: `Service for ${selectedEquipment.name}`,
      description: '',
      priority: selectedEquipment.status === 'maintenance_required' ? 'high' : 'medium',
      client_id: selectedEquipment.clientId,
      equipment_id: selectedEquipment.id,
    });
    setShowTicketModal(true);
  };

  const filteredEquipment = equipment.filter((e) => filter === 'all' ? true : e.type === filter);

  // Count active robots (status is operational)
  const activeRobotsCount = robotsOnly 
    ? filteredEquipment.filter(eq => eq.status === 'operational').length 
    : 0;

  // Sort clients alphabetically
  const sortedClients = [...clients].sort((a, b) => 
    (a.companyName || '').localeCompare(b.companyName || '')
  );

  // Calculate last and next service dates from tickets for each equipment
  // Auto-calculate next service date as last service + 3 months if robot is active
  const equipmentWithServiceDates = filteredEquipment.map(eq => {
    const equipmentTickets = tickets.filter(t => t.equipmentId === eq.id && t.status === 'resolved');
    let lastServiceDate: Date | null = null;
    let nextServiceDate: Date | null = null;
    
    if (equipmentTickets.length > 0) {
      const serviceDates = equipmentTickets
        .map(t => t.resolvedAt ? new Date(t.resolvedAt).getTime() : 0)
        .filter(d => d > 0)
        .sort((a, b) => b - a); // Sort descending (most recent first)
      
      lastServiceDate = serviceDates.length > 0 ? new Date(serviceDates[0]) : null;
    } else if (eq.lastServiceDate) {
      lastServiceDate = new Date(eq.lastServiceDate);
    }
    
    // Auto-calculate next service date: last service + 3 months (if robot is active/operational)
    if (lastServiceDate && eq.status === 'operational' && eq.type === 'robot') {
      nextServiceDate = new Date(lastServiceDate);
      nextServiceDate.setMonth(nextServiceDate.getMonth() + 3);
    } else if (eq.nextServiceDate) {
      nextServiceDate = new Date(eq.nextServiceDate);
    }
    
    return {
      ...eq,
      lastServiceDate: lastServiceDate || eq.lastServiceDate,
      nextServiceDate: nextServiceDate || eq.nextServiceDate,
    };
  });

  const tableColumns: Column<Equipment>[] = [
    { key: 'name', header: 'Equipment', sortable: true, searchable: true, render: (eq) => (
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${eq.type === 'robot' ? 'bg-purple-100 text-purple-600' : 'bg-primary-100 text-primary-600'}`}>
          {eq.type === 'robot' ? <Bot className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
        </div>
        <div><p className="font-medium text-neutral-900">{eq.name}</p><p className="text-xs text-neutral-500">{eq.model}</p></div>
      </div>
    )},
    { key: 'serialNumber', header: 'Serial #', searchable: true, render: (eq) => <span className="font-mono text-sm">{eq.serialNumber}</span> },
    { key: 'clientId', header: 'Client', searchable: true, render: (eq) => { const client = clients.find((c) => c.id === eq.clientId); return client?.companyName || '-'; } },
    { key: 'clientIndustry', header: 'Client Industry', searchable: true, render: (eq) => { const client = clients.find((c) => c.id === eq.clientId); return client?.industry || '-'; } },
    { key: 'location', header: 'Location', sortable: true, searchable: true, render: (eq) => {
      // If location is empty, try to get from client address
      if (!eq.location) {
        const client = clients.find((c) => c.id === eq.clientId);
        return client?.address || '-';
      }
      return eq.location;
    }},
    ...(robotsOnly ? [
      { key: 'installationDate', header: 'Installation Date', sortable: true, searchable: false, render: (eq: Equipment) => eq.installationDate ? format(new Date(eq.installationDate), 'MMM d, yyyy') : '-' },
    ] : []),
    { key: 'lastServiceDate', header: 'Last Service', sortable: true, searchable: false, render: (eq) => eq.lastServiceDate ? format(new Date(eq.lastServiceDate), 'MMM d, yyyy') : '-' },
    { key: 'nextServiceDate', header: 'Next Service', sortable: true, searchable: false, render: (eq) => { if (!eq.nextServiceDate) return '-'; const date = new Date(eq.nextServiceDate); const isOverdue = date < new Date(); return <span className={isOverdue ? 'text-danger-600 font-medium' : ''}>{format(date, 'MMM d, yyyy')}</span>; } },
    { key: 'status', header: 'Status', searchable: true, render: (eq) => { const colors: Record<string, string> = { operational: 'badge-success', maintenance_required: 'badge-warning', under_maintenance: 'badge-primary', decommissioned: 'badge-neutral' }; return <span className={`badge ${colors[eq.status]}`}>{eq.status.replace('_', ' ')}</span>; } },
  ];

  return (
    <div className="min-h-screen">
      <Header 
        title={robotsOnly ? 'Robots' : 'Equipment'} 
        subtitle={robotsOnly 
          ? `${filteredEquipment.length} total robots • ${activeRobotsCount} active` 
          : `${filteredEquipment.length} total units`} 
        showAddButton 
        addButtonText={robotsOnly ? 'Add Robot' : 'Add Equipment'} 
        onAddClick={() => setShowAddModal(true)} 
      />
      <div className="p-6">
        {!robotsOnly && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>All ({equipment.length})</button>
            <button onClick={() => setFilter('kitchen')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'kitchen' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}><Wrench className="w-4 h-4" />Kitchen ({equipment.filter((e) => e.type === 'kitchen').length})</button>
            <button onClick={() => setFilter('robot')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'robot' ? 'bg-purple-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}><Bot className="w-4 h-4" />Robots ({equipment.filter((e) => e.type === 'robot').length})</button>
          </div>
        )}
        <DataTable columns={tableColumns} data={equipmentWithServiceDates} onRowClick={(eq) => setSelectedEquipment(eq)} />
      </div>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add {robotsOnly ? 'Robot' : 'Equipment'}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddEquipment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><label className="label">Type</label><select className="input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}><option value="kitchen">Kitchen Equipment</option><option value="robot">Robot</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Model</label><input type="text" className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
                <div><label className="label">Serial Number</label><input type="text" className="input" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Manufacturer {robotsOnly ? '*' : ''}</label>
                  {robotsOnly ? (
                    <select 
                      className="input" 
                      required={robotsOnly}
                      value={formData.manufacturer} 
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    >
                      <option value="">Select manufacturer</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      className="input" 
                      value={formData.manufacturer} 
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} 
                    />
                  )}
                </div>
                <div>
                  <label className="label">Client *</label>
                  <select 
                    className="input" 
                    required 
                    value={formData.client_id} 
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">Select client</option>
                    {sortedClients.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div><label className="label">Location</label><input type="text" className="input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Main Kitchen - Station A" /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Add {robotsOnly ? 'Robot' : 'Equipment'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {showEditModal && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit {robotsOnly ? 'Robot' : 'Equipment'}</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditEquipment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><label className="label">Type</label><select className="input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}><option value="kitchen">Kitchen Equipment</option><option value="robot">Robot</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Model</label><input type="text" className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
                <div><label className="label">Serial Number</label><input type="text" className="input" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Manufacturer {robotsOnly ? '*' : ''}</label>
                  {robotsOnly ? (
                    <select 
                      className="input" 
                      required={robotsOnly}
                      value={formData.manufacturer} 
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    >
                      <option value="">Select manufacturer</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      className="input" 
                      value={formData.manufacturer} 
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} 
                    />
                  )}
                </div>
                <div>
                  <label className="label">Client *</label>
                  <select 
                    className="input" 
                    required 
                    value={formData.client_id} 
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">Select client</option>
                    {sortedClients.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Location</label><input type="text" className="input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Main Kitchen - Station A" /></div>
                <div><label className="label">Status</label><select className="input" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}><option value="operational">Operational</option><option value="maintenance_required">Maintenance Required</option><option value="under_maintenance">Under Maintenance</option><option value="decommissioned">Decommissioned</option></select></div>
              </div>
              {robotsOnly && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Installation Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={formData.installation_date} 
                      onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Last Service Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={formData.last_service_date} 
                      onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })} 
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Save Changes</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showTicketModal && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Service Ticket</h2>
                <p className="text-sm text-neutral-500 mt-1">For: {selectedEquipment.name}</p>
              </div>
              <button onClick={() => setShowTicketModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div className="p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedEquipment.type === 'robot' ? 'bg-purple-100 text-purple-600' : 'bg-primary-100 text-primary-600'}`}>
                    {selectedEquipment.type === 'robot' ? <Bot className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedEquipment.name}</p>
                    <p className="text-xs text-neutral-500">{selectedEquipment.model} • {selectedEquipment.serialNumber}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Title *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={ticketData.title}
                  onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
                  placeholder="Describe the issue briefly"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[100px]"
                  value={ticketData.description}
                  onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                  placeholder="Detailed description of the issue..."
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={ticketData.priority}
                  onChange={(e) => setTicketData({ ...ticketData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTicketModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">
                  <Ticket className="w-4 h-4 mr-2" />
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Equipment Detail Modal */}
      {selectedEquipment && !showEditModal && !showTicketModal && (() => {
        // Calculate last service date from resolved tickets for this equipment
        const equipmentTickets = tickets.filter(t => t.equipmentId === selectedEquipment.id && t.status === 'resolved');
        let calculatedLastServiceDate: Date | null = null;
        
        if (equipmentTickets.length > 0) {
          const serviceDates = equipmentTickets
            .map(t => t.resolvedAt ? new Date(t.resolvedAt).getTime() : 0)
            .filter(d => d > 0)
            .sort((a, b) => b - a); // Sort descending (most recent first)
          
          calculatedLastServiceDate = serviceDates.length > 0 ? new Date(serviceDates[0]) : null;
        } else if (selectedEquipment.lastServiceDate) {
          calculatedLastServiceDate = new Date(selectedEquipment.lastServiceDate);
        }

        // Calculate next service date
        let calculatedNextServiceDate: Date | null = null;
        if (calculatedLastServiceDate && selectedEquipment.status === 'operational' && selectedEquipment.type === 'robot') {
          calculatedNextServiceDate = new Date(calculatedLastServiceDate);
          calculatedNextServiceDate.setMonth(calculatedNextServiceDate.getMonth() + 3);
        } else if (selectedEquipment.nextServiceDate) {
          calculatedNextServiceDate = new Date(selectedEquipment.nextServiceDate);
        }

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className="p-6 border-b border-neutral-200 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${selectedEquipment.type === 'robot' ? 'bg-purple-100 text-purple-600' : 'bg-primary-100 text-primary-600'}`}>
                    {selectedEquipment.type === 'robot' ? <Bot className="w-7 h-7" /> : <Wrench className="w-7 h-7" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">{selectedEquipment.name}</h2>
                    <p className="text-neutral-500">{selectedEquipment.model} • {selectedEquipment.manufacturer}</p>
                    <span className={`badge mt-1 ${selectedEquipment.status === 'operational' ? 'badge-success' : selectedEquipment.status === 'maintenance_required' ? 'badge-warning' : 'badge-neutral'}`}>
                      {selectedEquipment.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedEquipment(null)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6">
                {selectedEquipment.status === 'maintenance_required' && (
                  <div className="flex items-center gap-3 p-4 bg-warning-50 border border-warning-200 rounded-lg"><AlertTriangle className="w-5 h-5 text-warning-600" /><div><p className="font-medium text-warning-800">Maintenance Required</p><p className="text-sm text-warning-700">This equipment needs servicing.</p></div></div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"><div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center"><span className="text-sm font-mono">#</span></div><div><p className="text-xs text-neutral-500">Serial Number</p><p className="font-mono font-medium">{selectedEquipment.serialNumber}</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"><MapPin className="w-5 h-5 text-neutral-400" /><div><p className="text-xs text-neutral-500">Location</p><p className="font-medium">{selectedEquipment.location || '-'}</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"><Calendar className="w-5 h-5 text-neutral-400" /><div><p className="text-xs text-neutral-500">Installation Date</p><p className="font-medium">{selectedEquipment.installationDate ? format(new Date(selectedEquipment.installationDate), 'MMMM d, yyyy') : '-'}</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"><Shield className="w-5 h-5 text-neutral-400" /><div><p className="text-xs text-neutral-500">Warranty Expires</p><p className="font-medium">{selectedEquipment.warrantyExpiry ? format(new Date(selectedEquipment.warrantyExpiry), 'MMMM d, yyyy') : 'No warranty'}</p></div></div>
                </div>
                <div>
                  <h4 className="font-medium text-neutral-900 mb-3">Service Schedule</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-success-50 rounded-lg border border-success-100">
                      <p className="text-xs text-success-600 uppercase tracking-wider mb-1">Last Service</p>
                      <p className="text-lg font-semibold text-success-700">
                        {calculatedLastServiceDate ? format(calculatedLastServiceDate, 'MMM d, yyyy') : 'Never serviced'}
                      </p>
                    </div>
                    <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
                      <p className="text-xs text-primary-600 uppercase tracking-wider mb-1">Next Service</p>
                      <p className="text-lg font-semibold text-primary-700">
                        {calculatedNextServiceDate ? format(calculatedNextServiceDate, 'MMM d, yyyy') : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-neutral-200 px-6 pb-6">
                <button onClick={openTicketModal} className="btn-primary flex-1">
                  <Ticket className="w-4 h-4 mr-2" />
                  Create Service Ticket
                </button>
                <button onClick={openEditModal} className="btn-secondary flex-1">Edit {robotsOnly ? 'Robot' : 'Equipment'}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
