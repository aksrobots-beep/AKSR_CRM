import { useEffect, useState } from 'react';
import { Header } from '../components/layout';
import { DataTable, StatsCard, type Column, PhoneInput, NumberInput } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { Users, Calendar, DollarSign, Briefcase, X, Edit, Save, Trash2, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import { validateDate, DATE_INPUT_MIN, DATE_INPUT_MAX } from '../utils/validateDate';
import { validateNumber, validateEmail, validatePhoneNumber } from '../utils/validation';

interface EmployeeData {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  position: string;
  join_date: string;
  salary: number;
  annual_leave_balance: number;
  sick_leave_balance: number;
  is_active: boolean;
  updated_at?: string;
  updatedAt?: Date;
}

const departments = ['Management', 'Service', 'Sales', 'HR', 'Finance', 'Operations', 'Inventory'];

const roles = [
  { value: 'technician', label: 'Technician' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'finance', label: 'Finance' },
  { value: 'inventory_officer', label: 'Inventory Officer' },
  { value: 'admin', label: 'Admin' },
];

export function Employees() {
  const { fetchUsers } = useAppStore();
  const { hasPermission } = useAuthStore();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [error, setError] = useState('');
  const [addData, setAddData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'technician',
    department: 'Service',
    position: '',
    join_date: format(new Date(), 'yyyy-MM-dd'),
    salary: 0,
    annual_leave_balance: 14,
    sick_leave_balance: 14,
  });
  const [editData, setEditData] = useState({
    position: '',
    join_date: '',
    salary: 0,
    annual_leave_balance: 0,
    sick_leave_balance: 0,
  });

  const canViewSalary = hasPermission(['ceo', 'admin', 'hr_manager', 'finance']);
  const canEdit = hasPermission(['ceo', 'admin', 'hr_manager']);

  useEffect(() => {
    loadEmployees();
    fetchUsers();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await api.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
      // Fallback to users data if employees endpoint doesn't exist
      const usersData = await api.getUsers();
      setEmployees(usersData.map((u: any) => ({
        id: u.id,
        user_id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        position: u.role.replace('_', ' '),
        join_date: u.created_at,
        salary: 0,
        annual_leave_balance: 14,
        sick_leave_balance: 14,
        is_active: u.is_active,
        updated_at: u.updated_at || u.created_at,
      })));
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate name
    if (!addData.name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate email
    const emailValidation = validateEmail(addData.email);
    if (!emailValidation.valid) {
      setError(emailValidation.error || 'Invalid email');
      return;
    }

    // Validate password
    if (!addData.password || addData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate phone
    if (addData.phone) {
      const phoneValidation = validatePhoneNumber(addData.phone);
      if (!phoneValidation.valid) {
        setError(phoneValidation.error || 'Invalid phone number');
        return;
      }
      addData.phone = phoneValidation.formatted || addData.phone;
    }

    // Validate join date
    if (addData.join_date) {
      const dateValidation = validateDate(addData.join_date, { required: true, fieldName: 'Join date' });
      if (!dateValidation.valid) {
        setError(dateValidation.error || 'Invalid join date');
        return;
      }
    }

    // Validate salary
    const salaryValidation = validateNumber(String(addData.salary), {
      allowDecimal: true,
      min: 0,
      required: false
    });
    if (!salaryValidation.valid) {
      setError('Salary: ' + salaryValidation.error);
      return;
    }

    // Validate leave balances
    const annualLeaveValidation = validateNumber(String(addData.annual_leave_balance), {
      allowDecimal: false,
      min: 0,
      max: 365,
      required: true
    });
    if (!annualLeaveValidation.valid) {
      setError('Annual Leave: ' + annualLeaveValidation.error);
      return;
    }

    const sickLeaveValidation = validateNumber(String(addData.sick_leave_balance), {
      allowDecimal: false,
      min: 0,
      max: 365,
      required: true
    });
    if (!sickLeaveValidation.valid) {
      setError('Sick Leave: ' + sickLeaveValidation.error);
      return;
    }

    try {
      // Create new user via register endpoint
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = JSON.parse(localStorage.getItem('ak-crm-auth') || '{}').state?.token;

      const response = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: addData.name,
          email: addData.email,
          password: addData.password,
          phone: addData.phone,
          role: addData.role,
          department: addData.department,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add employee');
      }

      const result = await response.json();

      // Now create employee record with additional details
      try {
        await api.createEmployee({
          user_id: result.user.id,
          position: addData.position || addData.role.replace('_', ' '),
          join_date: addData.join_date,
          salary: addData.salary,
          annual_leave_balance: addData.annual_leave_balance,
          sick_leave_balance: addData.sick_leave_balance,
        });
      } catch (empError) {
        console.warn('Employee record creation failed, but user was created:', empError);
      }

      setShowAddModal(false);
      setAddData({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'technician',
        department: 'Service',
        position: '',
        join_date: format(new Date(), 'yyyy-MM-dd'),
        salary: 0,
        annual_leave_balance: 14,
        sick_leave_balance: 14,
      });
      loadEmployees();
    } catch (error: any) {
      setError(error.message || 'Failed to add employee');
      console.error('Failed to add employee:', error);
    }
  };

  const openEditModal = (employee: EmployeeData) => {
    setSelectedEmployee(employee);
    setEditData({
      position: employee.position || employee.role.replace('_', ' '),
      join_date: employee.join_date ? format(new Date(employee.join_date), 'yyyy-MM-dd') : '',
      salary: employee.salary || 0,
      annual_leave_balance: employee.annual_leave_balance || 14,
      sick_leave_balance: employee.sick_leave_balance || 14,
    });
    setShowEditModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    // Validate join date
    if (editData.join_date) {
      const r = validateDate(editData.join_date, { required: false, fieldName: 'Join date' });
      if (!r.valid) { alert(r.error); return; }
    }
    
    // Validate salary
    const salaryValidation = validateNumber(String(editData.salary), { 
      allowDecimal: true, 
      min: 0, 
      required: false 
    });
    if (!salaryValidation.valid) {
      alert('Salary: ' + salaryValidation.error);
      return;
    }
    
    // Validate annual leave balance
    const annualLeaveValidation = validateNumber(String(editData.annual_leave_balance), { 
      allowDecimal: false, 
      min: 0,
      max: 365,
      required: true 
    });
    if (!annualLeaveValidation.valid) {
      alert('Annual Leave Balance: ' + annualLeaveValidation.error);
      return;
    }
    
    // Validate sick leave balance
    const sickLeaveValidation = validateNumber(String(editData.sick_leave_balance), { 
      allowDecimal: false, 
      min: 0,
      max: 365,
      required: true 
    });
    if (!sickLeaveValidation.valid) {
      alert('Sick Leave Balance: ' + sickLeaveValidation.error);
      return;
    }
    
    try {
      await api.updateEmployee(selectedEmployee.id, editData);
      setShowEditModal(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error('Failed to update employee:', error);
    }
  };

  const handleToggleActive = async (employee: EmployeeData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleEmployeeActive(employee.id, !employee.is_active);
      await loadEmployees();
    } catch (error) {
      console.error('Failed to toggle employee status:', error);
    }
  };

  const handleDeleteFromTable = async (employee: EmployeeData) => {
    if (!confirm(`Are you sure you want to deactivate ${employee.name}?`)) return;
    try {
      await api.deleteEmployee(employee.id);
      await loadEmployees();
    } catch (error) {
      console.error('Failed to delete employee:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      ceo: 'bg-purple-100 text-purple-700',
      admin: 'bg-primary-100 text-primary-700',
      service_manager: 'bg-success-100 text-success-700',
      technician: 'bg-warning-100 text-warning-700',
      hr_manager: 'bg-pink-100 text-pink-700',
      finance: 'bg-emerald-100 text-emerald-700',
      inventory_officer: 'bg-cyan-100 text-cyan-700',
      sales_manager: 'bg-orange-100 text-orange-700',
    };
    return roleColors[role] || 'badge-neutral';
  };

  const tableColumns: Column<EmployeeData>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortable: true,
      render: (emp) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
            {emp.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="font-medium text-neutral-900">{emp.name}</p>
            <p className="text-xs text-neutral-500">{emp.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'position',
      header: 'Position',
      sortable: true,
      render: (emp) => (
        <div>
          <p className="font-medium capitalize">{emp.position || emp.role.replace('_', ' ')}</p>
          <span className={`badge text-xs ${getRoleBadge(emp.role)}`}>{emp.role.replace('_', ' ')}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
    },
    {
      key: 'join_date',
      header: 'Join Date',
      sortable: true,
      render: (emp) => {
        try {
          return emp.join_date ? format(new Date(emp.join_date), 'MMM d, yyyy') : '-';
        } catch {
          return '-';
        }
      },
    },
    ...(canViewSalary ? [{
      key: 'salary',
      header: 'Salary',
      sortable: true,
      render: (emp: EmployeeData) => emp.salary ? `RM ${emp.salary.toLocaleString()}` : '-',
    } as Column<EmployeeData>] : []),
    {
      key: 'annual_leave_balance',
      header: 'Annual Leave',
      render: (emp) => (
        <span className={`font-medium ${(emp.annual_leave_balance || 0) < 5 ? 'text-warning-600' : 'text-neutral-700'}`}>
          {emp.annual_leave_balance || 0} days
        </span>
      ),
    },
    {
      key: 'sick_leave_balance',
      header: 'Sick Leave',
      render: (emp) => (
        <span className={`font-medium ${(emp.sick_leave_balance || 0) < 5 ? 'text-warning-600' : 'text-neutral-700'}`}>
          {emp.sick_leave_balance || 0} days
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (emp) => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={emp.is_active}
            onChange={(e) => handleToggleActive(emp, e as any)}
            onClick={(e) => e.stopPropagation()}
            className="sr-only peer"
            disabled={!canEdit}
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-500 peer-disabled:opacity-50"></div>
        </label>
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      sortable: true,
      render: (emp) => {
        // Try to get updated_at from the employee data
        const updatedAt = (emp as any).updated_at || (emp as any).updatedAt;
        if (!updatedAt) return '-';
        try {
          return (
            <div className="text-sm">
              <div className="text-neutral-900">{format(new Date(updatedAt), 'MMM d, yyyy')}</div>
              <div className="text-xs text-neutral-500">{format(new Date(updatedAt), 'h:mm a')}</div>
            </div>
          );
        } catch {
          return '-';
        }
      },
    },
    ...(canEdit ? [{
      key: 'actions',
      header: 'Actions',
      render: (emp: EmployeeData) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(emp); }}
            className="p-1.5 bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFromTable(emp);
            }}
            className="p-1.5 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200 transition-colors"
            title="Deactivate"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    } as Column<EmployeeData>] : []),
  ];

  const activeEmployees = employees.filter(e => e.is_active);
  const totalSalary = canViewSalary ? employees.reduce((sum, e) => sum + (e.salary || 0), 0) : 0;
  const avgLeaveBalance = employees.length > 0 
    ? Math.round(employees.reduce((sum, e) => sum + (e.annual_leave_balance || 0), 0) / employees.length)
    : 0;

  return (
    <div className="min-h-screen">
      <Header
        title="Employee Management"
        subtitle={`${activeEmployees.length} active employees`}
        showAddButton={canEdit}
        addButtonText="Add Employee"
        onAddClick={() => setShowAddModal(true)}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Employees"
            value={employees.length}
            icon={<Users className="w-5 h-5" />}
            color="primary"
          />
          <StatsCard
            title="Active Employees"
            value={activeEmployees.length}
            icon={<Briefcase className="w-5 h-5" />}
            color="success"
          />
          {canViewSalary && (
            <StatsCard
              title="Total Monthly Salary"
              value={`RM ${(totalSalary / 1000).toFixed(0)}K`}
              icon={<DollarSign className="w-5 h-5" />}
              color="accent"
            />
          )}
          <StatsCard
            title="Avg Leave Balance"
            value={`${avgLeaveBalance} days`}
            icon={<Calendar className="w-5 h-5" />}
            color="warning"
          />
        </div>

        {/* Department Distribution */}
        <div className="card p-5">
          <h3 className="font-semibold text-neutral-900 mb-4">Department Distribution</h3>
          <div className="flex flex-wrap gap-3">
            {departments.map(dept => {
              const count = employees.filter(e => e.department === dept).length;
              if (count === 0) return null;
              return (
                <div key={dept} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-lg">
                  <span className="font-medium">{dept}</span>
                  <span className="text-sm text-neutral-500">({count})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employees Table */}
        {loading ? (
          <div className="card p-12 text-center">
            <p className="text-neutral-500">Loading employees...</p>
          </div>
        ) : (
          <DataTable columns={tableColumns} data={employees} />
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-semibold">Add New Employee</h2>
                <p className="text-sm text-neutral-500">Create a new employee account</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setError(''); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Full Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={addData.name}
                    onChange={(e) => setAddData({ ...addData, name: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    Email <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={addData.email}
                    onChange={(e) => setAddData({ ...addData, email: e.target.value })}
                    placeholder="john@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    Password <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={addData.password}
                    onChange={(e) => setAddData({ ...addData, password: e.target.value })}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                  />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <PhoneInput
                    value={addData.phone}
                    onValueChange={(value) => setAddData({ ...addData, phone: value })}
                    placeholder="+60 12-345 6789"
                  />
                </div>

                <div>
                  <label className="label">
                    Role <span className="text-danger-500">*</span>
                  </label>
                  <select
                    className="input"
                    value={addData.role}
                    onChange={(e) => setAddData({ ...addData, role: e.target.value })}
                    required
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">
                    Department <span className="text-danger-500">*</span>
                  </label>
                  <select
                    className="input"
                    value={addData.department}
                    onChange={(e) => setAddData({ ...addData, department: e.target.value })}
                    required
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Position</label>
                  <input
                    type="text"
                    className="input"
                    value={addData.position}
                    onChange={(e) => setAddData({ ...addData, position: e.target.value })}
                    placeholder="e.g., Senior Technician"
                  />
                </div>

                <div>
                  <label className="label">Join Date</label>
                  <input
                    type="date"
                    className="input"
                    min={DATE_INPUT_MIN}
                    max={DATE_INPUT_MAX}
                    value={addData.join_date}
                    onChange={(e) => setAddData({ ...addData, join_date: e.target.value })}
                  />
                </div>

                {canViewSalary && (
                  <div>
                    <label className="label">Monthly Salary (RM)</label>
                    <NumberInput
                      allowDecimal={true}
                      value={String(addData.salary)}
                      onValueChange={(value) => setAddData({ ...addData, salary: parseFloat(value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div>
                  <label className="label">Annual Leave Balance (days)</label>
                  <NumberInput
                    allowDecimal={false}
                    value={String(addData.annual_leave_balance)}
                    onValueChange={(value) => {
                      const num = parseInt(value) || 0;
                      if (num <= 365) {
                        setAddData({ ...addData, annual_leave_balance: num });
                      }
                    }}
                    placeholder="14"
                  />
                </div>

                <div>
                  <label className="label">Sick Leave Balance (days)</label>
                  <NumberInput
                    allowDecimal={false}
                    value={String(addData.sick_leave_balance)}
                    onValueChange={(value) => {
                      const num = parseInt(value) || 0;
                      if (num <= 365) {
                        setAddData({ ...addData, sick_leave_balance: num });
                      }
                    }}
                    placeholder="14"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); setError(''); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Edit Employee</h2>
                <p className="text-sm text-neutral-500">{selectedEmployee.name}</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setSelectedEmployee(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Position</label>
                <input
                  type="text"
                  className="input"
                  value={editData.position}
                  onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                  placeholder="e.g., Senior Technician"
                />
              </div>
              <div>
                <label className="label">Join Date</label>
                <input
                  type="date"
                  className="input"
                  min={DATE_INPUT_MIN}
                  max={DATE_INPUT_MAX}
                  value={editData.join_date}
                  onChange={(e) => setEditData({ ...editData, join_date: e.target.value })}
                />
              </div>
              {canViewSalary && (
                <div>
                  <label className="label">Monthly Salary (RM)</label>
                  <NumberInput
                    allowDecimal={true}
                    value={String(editData.salary)}
                    onValueChange={(value) => setEditData({ ...editData, salary: parseFloat(value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Annual Leave Balance</label>
                  <NumberInput
                    allowDecimal={false}
                    value={String(editData.annual_leave_balance)}
                    onValueChange={(value) => {
                      const num = parseInt(value) || 0;
                      if (num <= 365) {
                        setEditData({ ...editData, annual_leave_balance: num });
                      }
                    }}
                    placeholder="14"
                  />
                </div>
                <div>
                  <label className="label">Sick Leave Balance</label>
                  <NumberInput
                    allowDecimal={false}
                    value={String(editData.sick_leave_balance)}
                    onValueChange={(value) => {
                      const num = parseInt(value) || 0;
                      if (num <= 365) {
                        setEditData({ ...editData, sick_leave_balance: num });
                      }
                    }}
                    placeholder="14"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedEmployee(null); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  <Save className="w-4 h-4 mr-2" />
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
