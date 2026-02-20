import { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { DataTable, type Column } from '../components/ui';
import { api } from '../services/api';
import type { Supplier } from '../types';
import { X, Mail, MessageCircle, Link as LinkIcon, Building2, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    whatsapp: '',
    wechat: '',
    lark: '',
    group_link: '',
    qr_code: '',
    notes: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await api.getSuppliers();
      // Transform backend data to frontend format
      const transformed = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        contact: s.contact || '',
        email: s.email || '',
        whatsapp: s.whatsapp || '',
        wechat: s.wechat || '',
        lark: s.lark || '',
        groupLink: s.group_link || '',
        qrCode: s.qr_code || '',
        notes: s.notes || '',
        status: s.status || 'active',
        isActive: s.is_active === 1 || s.is_active === true || s.is_active === undefined || s.is_active === null,
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
        createdBy: s.created_by || '',
        updatedBy: s.updated_by || '',
      }));
      setSuppliers(transformed);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSupplier(formData);
      setShowAddModal(false);
      setFormData({ name: '', contact: '', email: '', whatsapp: '', wechat: '', lark: '', group_link: '', qr_code: '', notes: '' });
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to add supplier:', error);
      alert('Failed to add supplier');
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    try {
      await api.updateSupplier(selectedSupplier.id, formData);
      setShowEditModal(false);
      setSelectedSupplier(null);
      setFormData({ name: '', contact: '', email: '', whatsapp: '', wechat: '', lark: '', group_link: '', qr_code: '', notes: '' });
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to update supplier:', error);
      alert('Failed to update supplier');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await api.deleteSupplier(id);
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      alert('Failed to delete supplier');
    }
  };

  const handleToggleActive = async (supplier: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleSupplierActive(supplier.id, !supplier.isActive);
      await fetchSuppliers();
    } catch (error) {
      console.error('Failed to toggle supplier status:', error);
    }
  };

  const handleDeleteFromTable = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete ${supplier.name}?`)) return;
    try {
      await api.deleteSupplier(supplier.id);
      await fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact: supplier.contact,
      email: supplier.email,
      whatsapp: supplier.whatsapp,
      wechat: supplier.wechat,
      lark: supplier.lark,
      group_link: supplier.groupLink,
      qr_code: supplier.qrCode,
      notes: supplier.notes || '',
    });
    setShowEditModal(true);
  };

  const tableColumns: Column<Supplier>[] = [
    { 
      key: 'name', 
      header: 'Supplier Name', 
      sortable: true, 
      render: (supplier) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{supplier.name}</p>
            {supplier.contact && <p className="text-xs text-neutral-500">{supplier.contact}</p>}
          </div>
        </div>
      )
    },
    { 
      key: 'email', 
      header: 'Email', 
      render: (supplier) => supplier.email ? (
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-neutral-400" />
          <span className="text-sm">{supplier.email}</span>
        </div>
      ) : '-'
    },
    { 
      key: 'whatsapp', 
      header: 'WhatsApp', 
      render: (supplier) => supplier.whatsapp ? (
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm">{supplier.whatsapp}</span>
        </div>
      ) : '-'
    },
    { 
      key: 'wechat', 
      header: 'WeChat', 
      render: (supplier) => supplier.wechat || '-'
    },
    { 
      key: 'lark', 
      header: 'Lark', 
      render: (supplier) => supplier.lark || '-'
    },
    { 
      key: 'groupLink', 
      header: 'Group Link', 
      render: (supplier) => supplier.groupLink ? (
        <a href={supplier.groupLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
          <LinkIcon className="w-4 h-4" />
          <span className="text-sm">Link</span>
        </a>
      ) : '-'
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (supplier) => {
        const colors: Record<string, string> = { 
          active: 'badge-success', 
          inactive: 'badge-neutral' 
        };
        return <span className={`badge ${colors[supplier.status] || 'badge-neutral'}`}>{supplier.status}</span>;
      }
    },
    {
      key: 'isActive',
      header: 'Active',
      render: (supplier) => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={supplier.isActive}
            onChange={(e) => handleToggleActive(supplier, e as any)}
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
      render: (supplier) => (
        <div className="text-sm">
          <div className="text-neutral-900">{format(new Date(supplier.updatedAt), 'MMM d, yyyy')}</div>
          <div className="text-xs text-neutral-500">{format(new Date(supplier.updatedAt), 'h:mm a')}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (supplier) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(supplier);
            }}
            className="p-2 hover:bg-primary-50 rounded-lg text-primary-600"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFromTable(supplier);
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
        title="Suppliers" 
        subtitle={`${suppliers.length} total suppliers`} 
        showAddButton 
        addButtonText="Add Supplier" 
        onAddClick={() => setShowAddModal(true)} 
      />
      <div className="p-6">
        <DataTable columns={tableColumns} data={suppliers} onRowClick={(supplier) => setSelectedSupplier(supplier)} />
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add Supplier</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Supplier Name *</label>
                  <input 
                    type="text" 
                    className="input" 
                    required 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="e.g., RoboServe"
                  />
                </div>
                <div>
                  <label className="label">Contact Person</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.contact} 
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })} 
                    placeholder="Contact person name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input 
                    type="email" 
                    className="input" 
                    value={formData.email} 
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                    placeholder="supplier@example.com"
                  />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.whatsapp} 
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} 
                    placeholder="+60 12-345 6789"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">WeChat</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.wechat} 
                    onChange={(e) => setFormData({ ...formData, wechat: e.target.value })} 
                    placeholder="WeChat ID"
                  />
                </div>
                <div>
                  <label className="label">Lark</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.lark} 
                    onChange={(e) => setFormData({ ...formData, lark: e.target.value })} 
                    placeholder="Lark ID"
                  />
                </div>
              </div>
              <div>
                <label className="label">Group Link</label>
                <input 
                  type="url" 
                  className="input" 
                  value={formData.group_link} 
                  onChange={(e) => setFormData({ ...formData, group_link: e.target.value })} 
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="label">QR Code (Image URL or Base64)</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.qr_code} 
                  onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })} 
                  placeholder="QR code image URL or base64"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea 
                  className="input min-h-[100px]" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {showEditModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Supplier</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Supplier Name *</label>
                  <input 
                    type="text" 
                    className="input" 
                    required 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="label">Contact Person</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.contact} 
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input 
                    type="email" 
                    className="input" 
                    value={formData.email} 
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.whatsapp} 
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">WeChat</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.wechat} 
                    onChange={(e) => setFormData({ ...formData, wechat: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="label">Lark</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.lark} 
                    onChange={(e) => setFormData({ ...formData, lark: e.target.value })} 
                  />
                </div>
              </div>
              <div>
                <label className="label">Group Link</label>
                <input 
                  type="url" 
                  className="input" 
                  value={formData.group_link} 
                  onChange={(e) => setFormData({ ...formData, group_link: e.target.value })} 
                />
              </div>
              <div>
                <label className="label">QR Code (Image URL or Base64)</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.qr_code} 
                  onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })} 
                />
                {formData.qr_code && (
                  <div className="mt-2">
                    {formData.qr_code.startsWith('data:image') || formData.qr_code.startsWith('http') ? (
                      <img src={formData.qr_code} alt="QR Code" className="w-32 h-32 border border-neutral-200 rounded" />
                    ) : null}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea 
                  className="input min-h-[100px]" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => handleDeleteSupplier(selectedSupplier.id)} className="btn-secondary flex-1 bg-danger-50 text-danger-600 hover:bg-danger-100">Delete</button>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
