import { useEffect, useState } from 'react';
import { Header } from '../components/layout';
import { DataTable, type Column } from '../components/ui';
import { api } from '../services/api';
import { Users as UsersIcon, Shield, UserCheck, UserX, X, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { validatePhoneNumber } from '../utils/validation';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  is_active: number;
  can_approve?: boolean;
  phone?: string;
  created_at: string;
}

const roles = [
  { value: 'ceo', label: 'CEO' },
  { value: 'admin', label: 'Admin' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'technician', label: 'Technician' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'finance', label: 'Finance' },
  { value: 'inventory_officer', label: 'Inventory Officer' },
];

const departments = ['Management', 'Service', 'Sales', 'Finance', 'Operations', 'Inventory'];

export function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'technician',
    department: 'Service',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department: '',
    phone: '',
    role: '',
    can_approve: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('ak-crm-auth') || '{}').state?.token}`,
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
      
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', role: 'technician', department: 'Service' });
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    
    // Validate phone if provided
    if (editFormData.phone && editFormData.phone.trim() !== '') {
      const phoneValidation = validatePhoneNumber(editFormData.phone);
      if (!phoneValidation.valid) {
        setError(phoneValidation.error || 'Invalid phone number');
        return;
      }
    }
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = JSON.parse(localStorage.getItem('ak-crm-auth') || '{}').state?.token;
      
      // Validate and format phone
      const phoneValidation = validatePhoneNumber(editFormData.phone);
      const formattedPhone = phoneValidation.formatted || editFormData.phone;
      
      // Update basic details
      const detailsResponse = await fetch(`${apiBase}/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editFormData.name,
          email: editFormData.email,
          department: editFormData.department,
          phone: formattedPhone,
        }),
      });
      
      if (!detailsResponse.ok) {
        const data = await detailsResponse.json();
        throw new Error(data.error || 'Failed to update user');
      }
      
      // Update permissions if role or can_approve changed
      if (editFormData.role !== editingUser.role || editFormData.can_approve !== (editingUser.can_approve || false)) {
        const permResponse = await fetch(`${apiBase}/auth/users/${editingUser.id}/permissions`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: editFormData.role,
            can_approve: editFormData.can_approve,
          }),
        });
        
        if (!permResponse.ok) {
          const data = await permResponse.json();
          throw new Error(data.error || 'Failed to update permissions');
        }
      }
      
      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}? They will not be able to login.`)) {
      return;
    }
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = JSON.parse(localStorage.getItem('ak-crm-auth') || '{}').state?.token;
      
      const response = await fetch(`${apiBase}/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      
      alert('User deactivated successfully');
      loadUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      department: user.department,
      phone: user.phone || '',
      role: user.role,
      can_approve: user.can_approve || false,
    });
    setError('');
    setShowEditModal(true);
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      ceo: 'bg-purple-100 text-purple-700',
      admin: 'bg-primary-100 text-primary-700',
      service_manager: 'bg-success-100 text-success-700',
      technician: 'bg-warning-100 text-warning-700',
      finance: 'bg-emerald-100 text-emerald-700',
      inventory_officer: 'bg-cyan-100 text-cyan-700',
      sales_manager: 'bg-orange-100 text-orange-700',
    };
    return roleColors[role] || 'badge-neutral';
  };

  const tableColumns: Column<UserData>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="font-medium text-neutral-900">{user.name}</p>
            <p className="text-xs text-neutral-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user) => (
        <span className={`badge ${getRoleBadge(user.role)}`}>
          {user.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (user) => (
        <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (user) => {
        try {
          return new Date(user.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
          return '-';
        }
      },
    },
    {
      key: 'can_approve',
      header: 'Approval',
      render: (user) => (
        user.can_approve ? (
          <span className="badge badge-success flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Can Approve
          </span>
        ) : (
          <span className="text-xs text-neutral-400">-</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(user)}
            className="p-2 hover:bg-primary-50 text-primary-600 rounded-lg transition-colors"
            title="Edit user"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteUser(user.id, user.name)}
            className="p-2 hover:bg-danger-50 text-danger-600 rounded-lg transition-colors"
            title="Delete user"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const activeUsers = users.filter(u => u.is_active);
  const roleGroups = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen">
      <Header
        title="User Management"
        subtitle={`${users.length} total users`}
        showAddButton
        addButtonText="Add User"
        onAddClick={() => setShowAddModal(true)}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{users.length}</p>
                <p className="text-sm text-neutral-500">Total Users</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{activeUsers.length}</p>
                <p className="text-sm text-neutral-500">Active Users</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{Object.keys(roleGroups).length}</p>
                <p className="text-sm text-neutral-500">Roles</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-danger-100 flex items-center justify-center">
                <UserX className="w-6 h-6 text-danger-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{users.length - activeUsers.length}</p>
                <p className="text-sm text-neutral-500">Inactive Users</p>
              </div>
            </div>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="card p-5">
          <h3 className="font-semibold text-neutral-900 mb-4">Role Distribution</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleGroups).map(([role, count]) => (
              <div key={role} className={`px-3 py-2 rounded-lg ${getRoleBadge(role)}`}>
                <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
                <span className="ml-2 opacity-75">({count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="card p-12 text-center">
            <p className="text-neutral-500">Loading users...</p>
          </div>
        ) : (
          <DataTable columns={tableColumns} data={users} />
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add New User</h2>
              <button onClick={() => { setShowAddModal(false); setError(''); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@aksuccess.com"
                />
              </div>
              <div>
                <label className="label">Password *</label>
                <input
                  type="password"
                  className="input"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role *</label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Department *</label>
                  <select
                    className="input"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); setError(''); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit User</h2>
              <button onClick={() => { setShowEditModal(false); setError(''); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="john@aksuccess.com"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+60 12-345 6789"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role *</label>
                  <select
                    className="input"
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Department *</label>
                  <select
                    className="input"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                    checked={editFormData.can_approve}
                    onChange={(e) => setEditFormData({ ...editFormData, can_approve: e.target.checked })}
                  />
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary-600" />
                    <span className="font-medium text-sm">Can Approve (Leave & Invoices)</span>
                  </div>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setError(''); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
