import { useEffect } from 'react';
import { Header } from '../components/layout';
import { StatsCard } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import {
  Ticket,
  Users,
  Bot,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard() {
  const { tickets, clients, equipment, invoices, fetchTickets, fetchClients, fetchEquipment, fetchInvoices } = useAppStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTickets();
    fetchClients();
    fetchEquipment();
    fetchInvoices();
  }, []);

  // Calculate stats
  const openTickets = tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  const criticalTickets = tickets.filter((t) => t.priority === 'critical' && t.status !== 'closed').length;
  const resolvedThisMonth = tickets.filter((t) => 
    t.status === 'resolved' && 
    t.resolvedAt && 
    new Date(t.resolvedAt).getMonth() === new Date().getMonth()
  ).length;

  const totalRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0);

  const pendingInvoices = invoices.filter((i) => ['sent', 'overdue'].includes(i.status));
  const pendingAmount = pendingInvoices.reduce((sum, i) => sum + (i.total - i.paidAmount), 0);

  const robotCount = equipment.length; // Total equipment count
  const maintenanceRequired = equipment.filter((e) => e.status === 'maintenance_required').length;

  // Recent tickets for activity feed
  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-primary-100 text-primary-700',
      assigned: 'bg-purple-100 text-purple-700',
      in_progress: 'bg-warning-100 text-warning-700',
      pending_parts: 'bg-orange-100 text-orange-700',
      resolved: 'bg-success-100 text-success-700',
      closed: 'bg-neutral-100 text-neutral-700',
    };
    return colors[status] || 'bg-neutral-100 text-neutral-700';
  };

  return (
    <div className="min-h-screen">
      <Header
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      />

      <div className="p-6 space-y-6 animate-stagger">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Open Tickets"
            value={openTickets}
            icon={<Ticket className="w-5 h-5" />}
            color="primary"
            trend={{ value: 12, direction: 'up' }}
          />
          <StatsCard
            title="Active Clients"
            value={clients.length}
            icon={<Users className="w-5 h-5" />}
            color="success"
            trend={{ value: 8, direction: 'up' }}
          />
          <StatsCard
            title="Managed Robots"
            value={robotCount}
            icon={<Bot className="w-5 h-5" />}
            color="accent"
          />
          <StatsCard
            title="Monthly Revenue"
            value={`RM ${totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="w-5 h-5" />}
            color="success"
            trend={{ value: 15, direction: 'up' }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Alerts & Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Alerts */}
            {(criticalTickets > 0 || maintenanceRequired > 0) && (
              <div className="card p-5">
                <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-warning-500" />
                  Attention Required
                </h3>
                <div className="space-y-3">
                  {criticalTickets > 0 && (
                    <div className="flex items-center justify-between p-3 bg-danger-50 rounded-lg border border-danger-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-danger-100 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-danger-600" />
                        </div>
                        <div>
                          <p className="font-medium text-danger-900">Critical Tickets</p>
                          <p className="text-sm text-danger-700">{criticalTickets} ticket(s) need immediate attention</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {maintenanceRequired > 0 && (
                    <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg border border-warning-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-warning-600" />
                        </div>
                        <div>
                          <p className="font-medium text-warning-900">Maintenance Required</p>
                          <p className="text-sm text-warning-700">{maintenanceRequired} equipment need servicing</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary-500" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {recentTickets.length === 0 ? (
                  <p className="text-neutral-500 text-center py-4">No recent activity</p>
                ) : (
                  recentTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-5 h-5 text-neutral-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-900 truncate">{ticket.title}</p>
                        <p className="text-sm text-neutral-500">{ticket.ticketNumber}</p>
                      </div>
                      <span className={`badge ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Quick Actions */}
          <div className="space-y-6">
            {/* Performance Overview */}
            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-success-500" />
                Performance
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Resolved This Month</span>
                  <span className="font-semibold text-neutral-900">{resolvedThisMonth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Pending Invoices</span>
                  <span className="font-semibold text-neutral-900">RM {pendingAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Equipment Operational</span>
                  <span className="font-semibold text-success-600">
                    {equipment.filter((e) => e.status === 'operational').length}/{equipment.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Ticket Status Distribution */}
            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-primary-500" />
                Ticket Status
              </h3>
              <div className="space-y-3">
                {[
                  { status: 'new', label: 'New', color: 'bg-primary-500' },
                  { status: 'in_progress', label: 'In Progress', color: 'bg-warning-500' },
                  { status: 'pending_parts', label: 'Pending Parts', color: 'bg-orange-500' },
                  { status: 'resolved', label: 'Resolved', color: 'bg-success-500' },
                ].map(({ status, label, color }) => {
                  const count = tickets.filter((t) => t.status === status).length;
                  const percentage = tickets.length > 0 ? (count / tickets.length) * 100 : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-neutral-600">{label}</span>
                        <span className="font-medium text-neutral-900">{count}</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
