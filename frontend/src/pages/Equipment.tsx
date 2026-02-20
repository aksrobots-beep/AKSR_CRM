import { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { DataTable, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import type { Equipment } from '../types';
import { format } from 'date-fns';
import { X, Calendar, MapPin, Shield, AlertTriangle, Ticket, Trash2, Edit } from 'lucide-react';
import { validateDate, DATE_INPUT_MIN, DATE_INPUT_MAX } from '../utils/validateDate';

interface EquipmentPageProps {
  robotsOnly?: boolean;
}

export function EquipmentPage({ robotsOnly = false }: EquipmentPageProps) {
  const { equipment, clients, tickets, fetchEquipment, fetchClients, fetchTickets, addEquipment, updateEquipmentItem, deleteEquipment, toggleEquipmentActive, addTicket } = useAppStore();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [filter, setFilter] = useState<'all' | 'rental' | 'sold'>(robotsOnly ? 'all' : 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    ownership_type: 'sold',
    model: '', 
    model_numbers: [''],
    serial_number: '', 
    manufacturer: '', 
    client_id: '', 
    location: '',
    status: 'operational',
    installation_date: '',
    last_service_date: '',
    // Rental fields
    rental_start_date: '',
    rental_end_date: '',
    rental_duration_months: 0,
    rental_amount: 0,
    rental_terms: '',
    // AMC fields
    amc_contract_start: '',
    amc_contract_end: '',
    amc_amount: 0,
    amc_terms: '',
    amc_renewal_status: 'active',
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
    if (robotsOnly) setFilter('all'); // Show all equipment for robots page
  }, [robotsOnly]);

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate ownership type specific fields
    if (formData.ownership_type === 'rental') {
      if (!formData.rental_start_date || !formData.rental_end_date) {
        alert('Rental start and end dates are required for rental equipment');
        return;
      }
      const rentalStart = validateDate(formData.rental_start_date, { required: true, fieldName: 'Rental start date' });
      if (!rentalStart.valid) { alert(rentalStart.error); return; }
      const rentalEnd = validateDate(formData.rental_end_date, { required: true, fieldName: 'Rental end date' });
      if (!rentalEnd.valid) { alert(rentalEnd.error); return; }
      
      // Validate end is after start
      if (new Date(formData.rental_end_date) <= new Date(formData.rental_start_date)) {
        alert('Rental end date must be after start date');
        return;
      }
    }
    
    if (formData.ownership_type === 'sold' && formData.amc_contract_start) {
      if (!formData.amc_contract_end) {
        alert('AMC end date is required when AMC start date is provided');
        return;
      }
      const amcStart = validateDate(formData.amc_contract_start, { required: false, fieldName: 'AMC contract start' });
      if (!amcStart.valid) { alert(amcStart.error); return; }
      const amcEnd = validateDate(formData.amc_contract_end, { required: false, fieldName: 'AMC contract end' });
      if (!amcEnd.valid) { alert(amcEnd.error); return; }
      
      // Validate end is after start
      if (new Date(formData.amc_contract_end) <= new Date(formData.amc_contract_start)) {
        alert('AMC contract end date must be after start date');
        return;
      }
    }
    
    if (formData.installation_date) {
      const r = validateDate(formData.installation_date, { required: false, fieldName: 'Installation date' });
      if (!r.valid) { alert(r.error); return; }
    }
    if (formData.last_service_date) {
      const r = validateDate(formData.last_service_date, { required: false, fieldName: 'Last service date' });
      if (!r.valid) { alert(r.error); return; }
    }
    
    try {
      // Filter out empty model numbers
      const filteredModelNumbers = formData.model_numbers.filter(m => m && m.trim());
      
      await addEquipment({
        ...formData,
        model_numbers: filteredModelNumbers,
      } as any);
      setShowAddModal(false);
      setFormData({ 
        name: '', 
        ownership_type: 'sold',
        model: '', 
        model_numbers: [''],
        serial_number: '', 
        manufacturer: '', 
        client_id: '', 
        location: '',
        status: 'operational',
        installation_date: '',
        last_service_date: '',
        rental_start_date: '',
        rental_end_date: '',
        rental_duration_months: 0,
        rental_amount: 0,
        rental_terms: '',
        amc_contract_start: '',
        amc_contract_end: '',
        amc_amount: 0,
        amc_terms: '',
        amc_renewal_status: 'active',
      });
    } catch (error) {
      console.error('Failed to add equipment:', error);
    }
  };

  const handleEditEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    
    // Validate ownership type specific fields
    if (formData.ownership_type === 'rental') {
      if (!formData.rental_start_date || !formData.rental_end_date) {
        alert('Rental start and end dates are required for rental equipment');
        return;
      }
      const rentalStart = validateDate(formData.rental_start_date, { required: true, fieldName: 'Rental start date' });
      if (!rentalStart.valid) { alert(rentalStart.error); return; }
      const rentalEnd = validateDate(formData.rental_end_date, { required: true, fieldName: 'Rental end date' });
      if (!rentalEnd.valid) { alert(rentalEnd.error); return; }
      
      if (new Date(formData.rental_end_date) <= new Date(formData.rental_start_date)) {
        alert('Rental end date must be after start date');
        return;
      }
    }
    
    if (formData.ownership_type === 'sold' && formData.amc_contract_start) {
      if (!formData.amc_contract_end) {
        alert('AMC end date is required when AMC start date is provided');
        return;
      }
      const amcStart = validateDate(formData.amc_contract_start, { required: false, fieldName: 'AMC contract start' });
      if (!amcStart.valid) { alert(amcStart.error); return; }
      const amcEnd = validateDate(formData.amc_contract_end, { required: false, fieldName: 'AMC contract end' });
      if (!amcEnd.valid) { alert(amcEnd.error); return; }
      
      if (new Date(formData.amc_contract_end) <= new Date(formData.amc_contract_start)) {
        alert('AMC contract end date must be after start date');
        return;
      }
    }
    
    if (formData.installation_date) {
      const r = validateDate(formData.installation_date, { required: false, fieldName: 'Installation date' });
      if (!r.valid) { alert(r.error); return; }
    }
    if (formData.last_service_date) {
      const r = validateDate(formData.last_service_date, { required: false, fieldName: 'Last service date' });
      if (!r.valid) { alert(r.error); return; }
    }
    
    try {
      // Filter out empty model numbers
      const filteredModelNumbers = formData.model_numbers.filter(m => m && m.trim());
      
      const updateData: any = { 
        ...formData,
        model_numbers: filteredModelNumbers,
      };
      
      await updateEquipmentItem(selectedEquipment.id, updateData);
      setShowEditModal(false);
      setSelectedEquipment(null);
      setFormData({ 
        name: '', 
        ownership_type: 'sold',
        model: '', 
        model_numbers: [''],
        serial_number: '', 
        manufacturer: '', 
        client_id: '', 
        location: '',
        status: 'operational',
        installation_date: '',
        last_service_date: '',
        rental_start_date: '',
        rental_end_date: '',
        rental_duration_months: 0,
        rental_amount: 0,
        rental_terms: '',
        amc_contract_start: '',
        amc_contract_end: '',
        amc_amount: 0,
        amc_terms: '',
        amc_renewal_status: 'active',
      });
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
      ownership_type: selectedEquipment.ownershipType || 'sold',
      model: selectedEquipment.model || '',
      model_numbers: Array.isArray(selectedEquipment.modelNumbers) && selectedEquipment.modelNumbers.length > 0 
        ? selectedEquipment.modelNumbers 
        : [''],
      serial_number: selectedEquipment.serialNumber || '',
      manufacturer: selectedEquipment.manufacturer || '',
      client_id: selectedEquipment.clientId || '',
      location: selectedEquipment.location || '',
      status: selectedEquipment.status || 'operational',
      installation_date: installationDate,
      last_service_date: lastServiceDate,
      rental_start_date: selectedEquipment.rentalStartDate ? new Date(selectedEquipment.rentalStartDate).toISOString().split('T')[0] : '',
      rental_end_date: selectedEquipment.rentalEndDate ? new Date(selectedEquipment.rentalEndDate).toISOString().split('T')[0] : '',
      rental_duration_months: selectedEquipment.rentalDurationMonths || 0,
      rental_amount: selectedEquipment.rentalAmount || 0,
      rental_terms: selectedEquipment.rentalTerms || '',
      amc_contract_start: selectedEquipment.amcContractStart ? new Date(selectedEquipment.amcContractStart).toISOString().split('T')[0] : '',
      amc_contract_end: selectedEquipment.amcContractEnd ? new Date(selectedEquipment.amcContractEnd).toISOString().split('T')[0] : '',
      amc_amount: selectedEquipment.amcAmount || 0,
      amc_terms: selectedEquipment.amcTerms || '',
      amc_renewal_status: selectedEquipment.amcRenewalStatus || 'active',
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

  const handleToggleActive = async (eq: Equipment, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleEquipmentActive(eq.id, !eq.isActive);
    } catch (error) {
      console.error('Failed to toggle equipment status:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedEquipment) return;
    if (!confirm(`Are you sure you want to delete ${selectedEquipment.name}?`)) return;
    try {
      await deleteEquipment(selectedEquipment.id);
      setSelectedEquipment(null);
    } catch (error) {
      console.error('Failed to delete equipment:', error);
    }
  };

  const handleDeleteFromTable = async (eq: Equipment) => {
    if (!confirm(`Are you sure you want to delete ${eq.name}?`)) return;
    try {
      await deleteEquipment(eq.id);
      await fetchEquipment();
    } catch (error) {
      console.error('Failed to delete equipment:', error);
    }
  };

  const filteredEquipment = equipment.filter((e) => filter === 'all' ? true : e.ownershipType === filter);

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
    
    // Auto-calculate next service date: last service + 3 months (if equipment is active/operational)
    if (lastServiceDate && eq.status === 'operational' && robotsOnly) {
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
    { 
      key: 'name', 
      header: 'Equipment', 
      sortable: true, 
      searchable: true, 
      render: (eq) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${eq.ownershipType === 'rental' ? 'bg-primary-100 text-primary-600' : 'bg-success-100 text-success-600'}`}>
            {eq.ownershipType === 'rental' ? <Calendar className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          </div>
          <div>
            <p className="font-medium text-neutral-900">{eq.name}</p>
            <p className="text-xs text-neutral-500">{eq.model}</p>
          </div>
        </div>
      )
    },
    { 
      key: 'ownershipType', 
      header: 'Ownership', 
      sortable: true,
      render: (eq) => (
        <span className={`badge ${eq.ownershipType === 'rental' ? 'badge-primary' : 'badge-success'}`}>
          {eq.ownershipType === 'rental' ? 'Rental' : 'Sold'}
        </span>
      )
    },
    { 
      key: 'modelNumbers', 
      header: 'Models', 
      render: (eq) => {
        const models = Array.isArray(eq.modelNumbers) ? eq.modelNumbers : [];
        if (models.length === 0) return <span className="text-neutral-400">-</span>;
        if (models.length === 1) return <span className="font-mono text-sm">{models[0]}</span>;
        return (
          <div className="flex items-center gap-1" title={models.join(', ')}>
            <span className="badge badge-neutral text-xs">{models.length} models</span>
          </div>
        );
      }
    },
    { 
      key: 'clientId', 
      header: 'Client', 
      searchable: true, 
      render: (eq) => { 
        const client = clients.find((c) => c.id === eq.clientId); 
        return client?.companyName || '-'; 
      } 
    },
    {
      key: 'contractStatus',
      header: 'Contract Status',
      render: (eq) => {
        if (eq.ownershipType === 'rental' && eq.rentalEndDate) {
          const endDate = new Date(eq.rentalEndDate);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry < 0) {
            return <span className="badge badge-danger">Expired</span>;
          } else if (daysUntilExpiry <= 30) {
            return (
              <div>
                <span className="badge badge-warning">Expiring Soon</span>
                <p className="text-xs text-neutral-500 mt-1">{daysUntilExpiry} days left</p>
              </div>
            );
          } else {
            return (
              <div>
                <span className="badge badge-success">Active</span>
                <p className="text-xs text-neutral-500 mt-1">Until {format(endDate, 'MMM d, yyyy')}</p>
              </div>
            );
          }
        } else if (eq.ownershipType === 'sold') {
          if (eq.amcContractEnd) {
            const endDate = new Date(eq.amcContractEnd);
            const now = new Date();
            const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
              return <span className="badge badge-danger">AMC Expired</span>;
            } else if (daysUntilExpiry <= 30) {
              return (
                <div>
                  <span className="badge badge-warning">AMC Expiring</span>
                  <p className="text-xs text-neutral-500 mt-1">{daysUntilExpiry} days</p>
                </div>
              );
            } else {
              return (
                <div>
                  <span className="badge badge-success">AMC {eq.amcRenewalStatus || 'Active'}</span>
                  <p className="text-xs text-neutral-500 mt-1">Until {format(endDate, 'MMM d, yyyy')}</p>
                </div>
              );
            }
          } else {
            return <span className="text-neutral-400 text-sm">No AMC</span>;
          }
        }
        return <span className="text-neutral-400">-</span>;
      }
    },
    { key: 'location', header: 'Location', sortable: true, searchable: true, render: (eq) => {
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
    {
      key: 'isActive',
      header: 'Active',
      render: (eq) => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={eq.isActive}
            onChange={(e) => handleToggleActive(eq, e as any)}
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
      render: (eq) => (
        <div className="text-sm">
          <div className="text-neutral-900">{format(new Date(eq.updatedAt), 'MMM d, yyyy')}</div>
          <div className="text-xs text-neutral-500">{format(new Date(eq.updatedAt), 'h:mm a')}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (eq) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedEquipment(eq);
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
              handleDeleteFromTable(eq);
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
            <button onClick={() => setFilter('rental')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'rental' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>Rental ({equipment.filter((e) => e.ownershipType === 'rental').length})</button>
            <button onClick={() => setFilter('sold')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'sold' ? 'bg-success-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>Sold ({equipment.filter((e) => e.ownershipType === 'sold').length})</button>
          </div>
        )}
        <DataTable columns={tableColumns} data={equipmentWithServiceDates} onRowClick={(eq) => setSelectedEquipment(eq)} />
      </div>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-3xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">Add {robotsOnly ? 'Robot' : 'Equipment'}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddEquipment} className="p-6 space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Name <span className="text-danger-500">*</span></label>
                    <input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Equipment name" />
                  </div>
                  <div>
                    <label className="label">Ownership Type <span className="text-danger-500">*</span></label>
                    <select className="input" value={formData.ownership_type} onChange={(e) => setFormData({ ...formData, ownership_type: e.target.value })}>
                      <option value="sold">Sold</option>
                      <option value="rental">Rental</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Model</label>
                    <input type="text" className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="Model name/series" />
                  </div>
                  <div>
                    <label className="label">Client <span className="text-danger-500">*</span></label>
                    <select className="input" required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
                      <option value="">Select client</option>
                      {sortedClients.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Model Numbers Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 border-b pb-2">Model / Serial Numbers</h3>
                {formData.model_numbers.map((modelNum, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label">Model/SN #{index + 1}</label>
                      <input
                        type="text"
                        className="input"
                        value={modelNum}
                        onChange={(e) => {
                          const newModels = [...formData.model_numbers];
                          newModels[index] = e.target.value;
                          setFormData({ ...formData, model_numbers: newModels });
                        }}
                        placeholder={`e.g., AR-2024-${String(index + 1).padStart(3, '0')}`}
                      />
                    </div>
                    {formData.model_numbers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newModels = formData.model_numbers.filter((_, i) => i !== index);
                          setFormData({ ...formData, model_numbers: newModels });
                        }}
                        className="p-2 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200 transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, model_numbers: [...formData.model_numbers, ''] })}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add Another Model/SN
                </button>
              </div>

              {/* Conditional Rental Section */}
              {formData.ownership_type === 'rental' && (
                <div className="space-y-4 bg-primary-50 p-4 rounded-lg border border-primary-200">
                  <h3 className="font-semibold text-neutral-900 border-b border-primary-300 pb-2">Rental Contract Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Rental Start Date <span className="text-danger-500">*</span></label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        required={formData.ownership_type === 'rental'}
                        value={formData.rental_start_date}
                        onChange={(e) => setFormData({ ...formData, rental_start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Rental End Date <span className="text-danger-500">*</span></label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        required={formData.ownership_type === 'rental'}
                        value={formData.rental_end_date}
                        onChange={(e) => setFormData({ ...formData, rental_end_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Duration (months)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        value={formData.rental_duration_months}
                        onChange={(e) => setFormData({ ...formData, rental_duration_months: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="label">Rental Amount (RM)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.01"
                        value={formData.rental_amount}
                        onChange={(e) => setFormData({ ...formData, rental_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Rental Terms</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={formData.rental_terms}
                      onChange={(e) => setFormData({ ...formData, rental_terms: e.target.value })}
                      placeholder="Contract terms and conditions..."
                    />
                  </div>
                </div>
              )}

              {/* Conditional AMC Section */}
              {formData.ownership_type === 'sold' && (
                <div className="space-y-4 bg-success-50 p-4 rounded-lg border border-success-200">
                  <h3 className="font-semibold text-neutral-900 border-b border-success-300 pb-2">AMC Contract (Optional)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">AMC Start Date</label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        value={formData.amc_contract_start}
                        onChange={(e) => setFormData({ ...formData, amc_contract_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">AMC End Date</label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        value={formData.amc_contract_end}
                        onChange={(e) => setFormData({ ...formData, amc_contract_end: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">AMC Amount (RM)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.01"
                        value={formData.amc_amount}
                        onChange={(e) => setFormData({ ...formData, amc_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="label">Renewal Status</label>
                      <select
                        className="input"
                        value={formData.amc_renewal_status}
                        onChange={(e) => setFormData({ ...formData, amc_renewal_status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">AMC Terms</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={formData.amc_terms}
                      onChange={(e) => setFormData({ ...formData, amc_terms: e.target.value })}
                      placeholder="AMC contract terms and conditions..."
                    />
                  </div>
                </div>
              )}

              {/* Other Details Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 border-b pb-2">Other Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Manufacturer</label>
                    {robotsOnly ? (
                      <select 
                        className="input" 
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
                        placeholder="Manufacturer name"
                      />
                    )}
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="operational">Operational</option>
                      <option value="maintenance_required">Maintenance Required</option>
                      <option value="under_maintenance">Under Maintenance</option>
                      <option value="decommissioned">Decommissioned</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Installation Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
                      value={formData.installation_date} 
                      onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Last Service Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
                      value={formData.last_service_date} 
                      onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })} 
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Location</label>
                  <input type="text" className="input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Main Kitchen - Station A" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add {robotsOnly ? 'Robot' : 'Equipment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {showEditModal && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-3xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">Edit {robotsOnly ? 'Robot' : 'Equipment'}</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditEquipment} className="p-6 space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Name <span className="text-danger-500">*</span></label>
                    <input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Ownership Type <span className="text-danger-500">*</span></label>
                    <select className="input" value={formData.ownership_type} onChange={(e) => setFormData({ ...formData, ownership_type: e.target.value })}>
                      <option value="sold">Sold</option>
                      <option value="rental">Rental</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Model</label>
                    <input type="text" className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Client <span className="text-danger-500">*</span></label>
                    <select className="input" required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
                      <option value="">Select client</option>
                      {sortedClients.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Model Numbers Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 border-b pb-2">Model / Serial Numbers</h3>
                {formData.model_numbers.map((modelNum, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label">Model/SN #{index + 1}</label>
                      <input
                        type="text"
                        className="input"
                        value={modelNum}
                        onChange={(e) => {
                          const newModels = [...formData.model_numbers];
                          newModels[index] = e.target.value;
                          setFormData({ ...formData, model_numbers: newModels });
                        }}
                        placeholder={`e.g., AR-2024-${String(index + 1).padStart(3, '0')}`}
                      />
                    </div>
                    {formData.model_numbers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newModels = formData.model_numbers.filter((_, i) => i !== index);
                          setFormData({ ...formData, model_numbers: newModels });
                        }}
                        className="p-2 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200 transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, model_numbers: [...formData.model_numbers, ''] })}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add Another Model/SN
                </button>
              </div>

              {/* Conditional Rental Section */}
              {formData.ownership_type === 'rental' && (
                <div className="space-y-4 bg-primary-50 p-4 rounded-lg border border-primary-200">
                  <h3 className="font-semibold text-neutral-900 border-b border-primary-300 pb-2">Rental Contract Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Rental Start Date <span className="text-danger-500">*</span></label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        required={formData.ownership_type === 'rental'}
                        value={formData.rental_start_date}
                        onChange={(e) => setFormData({ ...formData, rental_start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Rental End Date <span className="text-danger-500">*</span></label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        required={formData.ownership_type === 'rental'}
                        value={formData.rental_end_date}
                        onChange={(e) => setFormData({ ...formData, rental_end_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Duration (months)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        value={formData.rental_duration_months}
                        onChange={(e) => setFormData({ ...formData, rental_duration_months: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="label">Rental Amount (RM)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.01"
                        value={formData.rental_amount}
                        onChange={(e) => setFormData({ ...formData, rental_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Rental Terms</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={formData.rental_terms}
                      onChange={(e) => setFormData({ ...formData, rental_terms: e.target.value })}
                      placeholder="Contract terms and conditions..."
                    />
                  </div>
                </div>
              )}

              {/* Conditional AMC Section */}
              {formData.ownership_type === 'sold' && (
                <div className="space-y-4 bg-success-50 p-4 rounded-lg border border-success-200">
                  <h3 className="font-semibold text-neutral-900 border-b border-success-300 pb-2">AMC Contract (Optional)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">AMC Start Date</label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        value={formData.amc_contract_start}
                        onChange={(e) => setFormData({ ...formData, amc_contract_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">AMC End Date</label>
                      <input
                        type="date"
                        className="input"
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        value={formData.amc_contract_end}
                        onChange={(e) => setFormData({ ...formData, amc_contract_end: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">AMC Amount (RM)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.01"
                        value={formData.amc_amount}
                        onChange={(e) => setFormData({ ...formData, amc_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="label">Renewal Status</label>
                      <select
                        className="input"
                        value={formData.amc_renewal_status}
                        onChange={(e) => setFormData({ ...formData, amc_renewal_status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">AMC Terms</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={formData.amc_terms}
                      onChange={(e) => setFormData({ ...formData, amc_terms: e.target.value })}
                      placeholder="AMC contract terms and conditions..."
                    />
                  </div>
                </div>
              )}

              {/* Other Details Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 border-b pb-2">Other Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Manufacturer</label>
                    {robotsOnly ? (
                      <select 
                        className="input" 
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
                    <label className="label">Status</label>
                    <select className="input" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="operational">Operational</option>
                      <option value="maintenance_required">Maintenance Required</option>
                      <option value="under_maintenance">Under Maintenance</option>
                      <option value="decommissioned">Decommissioned</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Installation Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
                      value={formData.installation_date} 
                      onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="label">Last Service Date</label>
                    <input 
                      type="date" 
                      className="input" 
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
                      value={formData.last_service_date} 
                      onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })} 
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Location</label>
                  <input type="text" className="input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Main Kitchen - Station A" />
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
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedEquipment.ownershipType === 'rental' ? 'bg-primary-100 text-primary-600' : 'bg-success-100 text-success-600'}`}>
                    {selectedEquipment.ownershipType === 'rental' ? <Calendar className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
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
        if (calculatedLastServiceDate && selectedEquipment.status === 'operational' && robotsOnly) {
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
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${selectedEquipment.ownershipType === 'rental' ? 'bg-primary-100 text-primary-600' : 'bg-success-100 text-success-600'}`}>
                    {selectedEquipment.ownershipType === 'rental' ? <Calendar className="w-7 h-7" /> : <Shield className="w-7 h-7" />}
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
                <button onClick={handleDelete} className="btn-secondary text-danger-600 hover:bg-danger-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
