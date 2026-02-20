import { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { DataTable, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import type { Client } from '../types';
import { X, Mail, Phone, MapPin, Wrench, DollarSign, Ticket, Trash2, Edit, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { validatePhoneNumber, validateEmail } from '../utils/validation';

export function Clients() {
  const { clients, equipment, fetchClients, fetchEquipment, fetchTickets, addClient, updateClient, deleteClient, toggleClientActive, addTicket } = useAppStore();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    industry: '',
  });
  const [ticketData, setTicketData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    client_id: '',
  });

  useEffect(() => {
    fetchClients();
    fetchEquipment();
    fetchTickets();
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    if (formData.email) {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.valid) {
        alert(emailValidation.error);
        return;
      }
    }
    
    // Validate phone
    if (formData.phone) {
      const phoneValidation = validatePhoneNumber(formData.phone);
      if (!phoneValidation.valid) {
        alert(phoneValidation.error);
        return;
      }
      formData.phone = phoneValidation.formatted || formData.phone;
    }
    
    try {
      await addClient(formData as any);
      setShowAddModal(false);
      setFormData({ name: '', company_name: '', email: '', phone: '', address: '', city: '', state: '', industry: '' });
    } catch (error) {
      console.error('Failed to add client:', error);
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    
    // Validate email
    if (formData.email) {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.valid) {
        alert(emailValidation.error);
        return;
      }
    }
    
    // Validate phone
    if (formData.phone) {
      const phoneValidation = validatePhoneNumber(formData.phone);
      if (!phoneValidation.valid) {
        alert(phoneValidation.error);
        return;
      }
      formData.phone = phoneValidation.formatted || formData.phone;
    }
    
    try {
      await updateClient(selectedClient.id, formData as any);
      setShowEditModal(false);
      setSelectedClient(null);
      setFormData({ name: '', company_name: '', email: '', phone: '', address: '', city: '', state: '', industry: '' });
    } catch (error) {
      console.error('Failed to update client:', error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addTicket(ticketData as any);
      setShowTicketModal(false);
      setTicketData({ title: '', description: '', priority: 'medium', client_id: '' });
      setSelectedClient(null);
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  const openEditModal = () => {
    if (!selectedClient) return;
    setFormData({
      name: selectedClient.name,
      company_name: selectedClient.companyName,
      email: selectedClient.email || '',
      phone: selectedClient.phone || '',
      address: selectedClient.address || '',
      city: selectedClient.city || '',
      state: selectedClient.state || '',
      industry: selectedClient.industry || '',
    });
    setShowEditModal(true);
  };

  const openTicketModal = () => {
    if (!selectedClient) return;
    setTicketData({
      title: '',
      description: '',
      priority: 'medium',
      client_id: selectedClient.id,
    });
    setShowTicketModal(true);
  };

  const handleToggleActive = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleClientActive(client.id, !client.isActive);
    } catch (error) {
      console.error('Failed to toggle client status:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    if (!confirm(`Are you sure you want to delete ${selectedClient.companyName}?`)) return;
    try {
      await deleteClient(selectedClient.id);
      setSelectedClient(null);
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const handleDeleteFromTable = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete ${client.companyName}?`)) return;
    try {
      await deleteClient(client.id);
      await fetchClients();
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const tableColumns: Column<Client>[] = [
    {
      key: 'companyName',
      header: 'Company',
      sortable: true,
      render: (client) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-semibold text-sm">
            {client.companyName.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-neutral-900">{client.companyName}</p>
            <p className="text-xs text-neutral-500">{client.name}</p>
          </div>
        </div>
      ),
    },
    { key: 'industry', header: 'Industry', sortable: true },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      render: (client) => `${client.city || '-'}${client.state ? `, ${client.state}` : ''}`,
    },
    {
      key: 'equipmentCount',
      header: 'Equipment',
      sortable: true,
      render: (client) => (
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-neutral-400" />
          {client.equipmentCount || 0}
        </div>
      ),
    },
    {
      key: 'robotCount',
      header: 'Rental',
      sortable: true,
      render: (client) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          {client.robotCount || 0}
        </div>
      ),
    },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      sortable: true,
      render: (client) => (
        <span className="font-medium text-success-600">
          RM {(client.totalRevenue || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (client) => (
        <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
          {client.status}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Active',
      render: (client) => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={client.isActive}
            onChange={(e) => handleToggleActive(client, e as any)}
            onClick={(e) => e.stopPropagation()}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-500"></div>
        </label>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (client) => (
        <div className="text-sm">
          <div className="text-neutral-900">{format(new Date(client.updatedAt), 'MMM d, yyyy')}</div>
          <div className="text-xs text-neutral-500">{format(new Date(client.updatedAt), 'h:mm a')}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (client) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedClient(client);
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
              handleDeleteFromTable(client);
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

  const getClientEquipment = (clientId: string) => equipment.filter((e) => e.clientId === clientId);

  return (
    <div className="min-h-screen">
      <Header
        title="Clients"
        subtitle={`${clients.length} active clients`}
        showAddButton
        addButtonText="Add Client"
        onAddClick={() => setShowAddModal(true)}
      />

      <div className="p-6">
        <DataTable columns={tableColumns} data={clients} onRowClick={(client) => setSelectedClient(client)} />
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add New Client</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact Name *</label>
                  <input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Company Name *</label>
                  <input type="text" className="input" required value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input type="text" className="input" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">City</label>
                  <input type="text" className="input" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <label className="label">State</label>
                  <input type="text" className="input" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div>
                  <label className="label">Industry</label>
                  <input type="text" className="input" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Client</h2>
              <button onClick={() => { setShowEditModal(false); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditClient} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact Name *</label>
                  <input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Company Name *</label>
                  <input type="text" className="input" required value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input type="text" className="input" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">City</label>
                  <input type="text" className="input" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <label className="label">State</label>
                  <input type="text" className="input" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div>
                  <label className="label">Industry</label>
                  <input type="text" className="input" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
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

      {/* Create Ticket Modal */}
      {showTicketModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Service Ticket</h2>
                <p className="text-sm text-neutral-500 mt-1">For: {selectedClient.companyName}</p>
              </div>
              <button onClick={() => setShowTicketModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
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

      {/* Client Detail Modal */}
      {selectedClient && !showEditModal && !showTicketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-bold text-2xl">
                  {selectedClient.companyName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">{selectedClient.companyName}</h2>
                  <p className="text-neutral-500">{selectedClient.name}</p>
                  <span className="badge-success mt-1">{selectedClient.status}</span>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-neutral-50 rounded-xl text-center">
                  <Wrench className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-neutral-900">{selectedClient.equipmentCount || 0}</p>
                  <p className="text-sm text-neutral-500">Equipment</p>
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl text-center">
                  <Calendar className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-neutral-900">{selectedClient.robotCount || 0}</p>
                  <p className="text-sm text-neutral-500">Rental</p>
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl text-center">
                  <DollarSign className="w-6 h-6 text-success-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-neutral-900">RM {((selectedClient.totalRevenue || 0) / 1000).toFixed(0)}K</p>
                  <p className="text-sm text-neutral-500">Revenue</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-neutral-900 mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                    <Mail className="w-5 h-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Email</p>
                      <p className="text-sm font-medium">{selectedClient.email || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                    <Phone className="w-5 h-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Phone</p>
                      <p className="text-sm font-medium">{selectedClient.phone || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg col-span-2">
                    <MapPin className="w-5 h-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Address</p>
                      <p className="text-sm font-medium">
                        {selectedClient.address || '-'}{selectedClient.city ? `, ${selectedClient.city}` : ''}{selectedClient.state ? `, ${selectedClient.state}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-neutral-900 mb-3">Equipment ({getClientEquipment(selectedClient.id).length})</h4>
                <div className="space-y-2">
                  {getClientEquipment(selectedClient.id).length === 0 ? (
                    <p className="text-sm text-neutral-500 text-center py-4">No equipment registered</p>
                  ) : (
                    getClientEquipment(selectedClient.id).map((eq) => (
                      <div key={eq.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {eq.ownershipType === 'rental' ? <Calendar className="w-5 h-5 text-primary-500" /> : <Wrench className="w-5 h-5 text-success-500" />}
                          <div>
                            <p className="font-medium text-sm">{eq.name}</p>
                            <p className="text-xs text-neutral-500">{eq.model} • {eq.ownershipType === 'rental' ? 'Rental' : 'Sold'}</p>
                          </div>
                        </div>
                        <span className={`badge ${eq.status === 'operational' ? 'badge-success' : eq.status === 'maintenance_required' ? 'badge-warning' : 'badge-neutral'}`}>
                          {eq.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-neutral-200">
                <button onClick={openEditModal} className="btn-primary flex-1">Edit Client</button>
                <button onClick={openTicketModal} className="btn-secondary flex-1">
                  <Ticket className="w-4 h-4 mr-2" />
                  Create Ticket
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
