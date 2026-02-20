import { useEffect } from 'react';
import { Header } from '../components/layout';
import { StatsCard } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import {
  TrendingUp,
  DollarSign,
  Users,
  Ticket,
  Bot,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Target,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export function CEODashboard() {
  const { tickets, clients, equipment, invoices, inventory, leaveRequests, fetchTickets, fetchClients, fetchEquipment, fetchInvoices, fetchInventory, fetchLeaveRequests } = useAppStore();
  useEffect(() => {
    fetchTickets();
    fetchClients();
    fetchEquipment();
    fetchInvoices();
    fetchInventory();
    fetchLeaveRequests();
  }, []);

  // Calculate KPIs
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  // Revenue KPIs
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
  const monthlyRevenue = invoices
    .filter(i => i.status === 'paid' && isWithinInterval(new Date(i.issueDate), { start: monthStart, end: monthEnd }))
    .reduce((sum, i) => sum + i.total, 0);
  const pendingRevenue = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.total - i.paidAmount), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');

  // Service KPIs
  const openTickets = tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length;
  const criticalTickets = tickets.filter(t => t.priority === 'critical' && !['resolved', 'closed'].includes(t.status)).length;
  const resolvedThisMonth = tickets.filter(t => 
    t.status === 'resolved' && 
    t.resolvedAt && 
    isWithinInterval(new Date(t.resolvedAt), { start: monthStart, end: monthEnd })
  ).length;
  const avgResolutionTime = tickets.filter(t => t.resolvedAt && t.createdAt).length > 0
    ? Math.round(tickets.filter(t => t.resolvedAt).reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime();
        const resolved = new Date(t.resolvedAt!).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60 * 24);
      }, 0) / tickets.filter(t => t.resolvedAt).length)
    : 0;

  // Equipment KPIs
  const totalEquipment = equipment.length;
  const operationalEquipment = equipment.filter(e => e.status === 'operational').length;
  const maintenanceRequired = equipment.filter(e => e.status === 'maintenance_required').length;
  const robots = equipment; // All equipment
  const operationalRobots = robots.filter(e => e.status === 'operational').length;

  // Inventory KPIs
  const lowStockItems = inventory.filter(i => i.quantity <= i.minQuantity).length;
  const totalInventoryValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);

  // HR KPIs
  const pendingLeaveRequests = leaveRequests.filter(l => l.status === 'pending').length;

  // Ticket status distribution
  const ticketsByStatus = {
    new: tickets.filter(t => t.status === 'new').length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    pending_parts: tickets.filter(t => t.status === 'pending_parts').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  // Priority distribution
  const ticketsByPriority = {
    critical: tickets.filter(t => t.priority === 'critical' && !['resolved', 'closed'].includes(t.status)).length,
    high: tickets.filter(t => t.priority === 'high' && !['resolved', 'closed'].includes(t.status)).length,
    medium: tickets.filter(t => t.priority === 'medium' && !['resolved', 'closed'].includes(t.status)).length,
    low: tickets.filter(t => t.priority === 'low' && !['resolved', 'closed'].includes(t.status)).length,
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header
        title="Executive Dashboard"
        subtitle={`KPI Overview • ${format(now, 'MMMM yyyy')}`}
      />

      <div className="p-6 space-y-6">

        {/* Revenue Section */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-success-500" />
            Revenue & Finance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 bg-gradient-to-br from-success-500 to-success-600 text-white">
              <p className="text-success-100 text-sm mb-1">Total Revenue</p>
              <p className="text-3xl font-bold">RM {totalRevenue.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-neutral-500 text-sm">Monthly Revenue</p>
                <TrendingUp className="w-5 h-5 text-success-500" />
              </div>
              <p className="text-2xl font-bold text-neutral-900">RM {monthlyRevenue.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-neutral-500 text-sm">Pending Collection</p>
                <Clock className="w-5 h-5 text-warning-500" />
              </div>
              <p className="text-2xl font-bold text-warning-600">RM {pendingRevenue.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-neutral-500 text-sm">Overdue Invoices</p>
                <AlertTriangle className="w-5 h-5 text-danger-500" />
              </div>
              <p className="text-2xl font-bold text-danger-600">{overdueInvoices.length}</p>
            </div>
          </div>
        </div>

        {/* Service Performance Section */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary-500" />
            Service Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Open Tickets"
              value={openTickets}
              icon={<Ticket className="w-5 h-5" />}
              color="primary"
            />
            <StatsCard
              title="Critical Issues"
              value={criticalTickets}
              icon={<AlertTriangle className="w-5 h-5" />}
              color={criticalTickets > 0 ? 'danger' : 'success'}
            />
            <StatsCard
              title="Resolved This Month"
              value={resolvedThisMonth}
              icon={<CheckCircle className="w-5 h-5" />}
              color="success"
            />
            <StatsCard
              title="Avg Resolution (days)"
              value={avgResolutionTime}
              icon={<Clock className="w-5 h-5" />}
              color="accent"
            />
          </div>

          {/* Ticket Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="card p-5">
              <h4 className="font-medium text-neutral-900 mb-4">Ticket Status Distribution</h4>
              <div className="space-y-3">
                {Object.entries(ticketsByStatus).map(([status, count]) => {
                  const percentage = tickets.length > 0 ? (count / tickets.length) * 100 : 0;
                  const colors: Record<string, string> = {
                    new: 'bg-primary-500',
                    assigned: 'bg-purple-500',
                    in_progress: 'bg-warning-500',
                    pending_parts: 'bg-orange-500',
                    resolved: 'bg-success-500',
                  };
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-neutral-600">{status.replace('_', ' ')}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={`h-full ${colors[status]} rounded-full`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card p-5">
              <h4 className="font-medium text-neutral-900 mb-4">Priority Breakdown (Open)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-danger-50 rounded-xl border border-danger-200">
                  <p className="text-3xl font-bold text-danger-600">{ticketsByPriority.critical}</p>
                  <p className="text-sm text-danger-700">Critical</p>
                </div>
                <div className="p-4 bg-warning-50 rounded-xl border border-warning-200">
                  <p className="text-3xl font-bold text-warning-600">{ticketsByPriority.high}</p>
                  <p className="text-sm text-warning-700">High</p>
                </div>
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-200">
                  <p className="text-3xl font-bold text-primary-600">{ticketsByPriority.medium}</p>
                  <p className="text-sm text-primary-700">Medium</p>
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <p className="text-3xl font-bold text-neutral-600">{ticketsByPriority.low}</p>
                  <p className="text-sm text-neutral-500">Low</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Equipment & Assets Section */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-accent-500" />
            Equipment & Assets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="Total Equipment"
              value={totalEquipment}
              icon={<Wrench className="w-5 h-5" />}
              color="primary"
            />
            <StatsCard
              title="Operational"
              value={`${operationalEquipment}/${totalEquipment}`}
              icon={<CheckCircle className="w-5 h-5" />}
              color="success"
            />
            <StatsCard
              title="Needs Maintenance"
              value={maintenanceRequired}
              icon={<AlertTriangle className="w-5 h-5" />}
              color={maintenanceRequired > 0 ? 'warning' : 'success'}
            />
            <StatsCard
              title="Robots Deployed"
              value={`${operationalRobots}/${robots.length}`}
              icon={<Bot className="w-5 h-5" />}
              color="accent"
            />
            <StatsCard
              title="Inventory Value"
              value={`RM ${(totalInventoryValue / 1000).toFixed(0)}K`}
              icon={<DollarSign className="w-5 h-5" />}
              color="success"
            />
          </div>
        </div>

        {/* Clients & Operations Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5">
            <h4 className="font-medium text-neutral-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-500" />
              Clients Overview
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Total Clients</span>
                <span className="text-2xl font-bold">{clients.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Active Clients</span>
                <span className="text-lg font-semibold text-success-600">{clients.filter(c => c.status === 'active').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">With Equipment</span>
                <span className="text-lg font-semibold">{clients.filter(c => (c.equipmentCount || 0) > 0).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">With Robots</span>
                <span className="text-lg font-semibold text-purple-600">{clients.filter(c => (c.robotCount || 0) > 0).length}</span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h4 className="font-medium text-neutral-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-warning-500" />
              Alerts & Actions
            </h4>
            <div className="space-y-3">
              {criticalTickets > 0 && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="font-medium text-danger-800">{criticalTickets} Critical Ticket(s)</p>
                  <p className="text-sm text-danger-600">Require immediate attention</p>
                </div>
              )}
              {maintenanceRequired > 0 && (
                <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
                  <p className="font-medium text-warning-800">{maintenanceRequired} Equipment Need Service</p>
                  <p className="text-sm text-warning-600">Schedule maintenance</p>
                </div>
              )}
              {lowStockItems > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="font-medium text-orange-800">{lowStockItems} Low Stock Items</p>
                  <p className="text-sm text-orange-600">Reorder needed</p>
                </div>
              )}
              {overdueInvoices.length > 0 && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="font-medium text-danger-800">{overdueInvoices.length} Overdue Invoice(s)</p>
                  <p className="text-sm text-danger-600">Follow up required</p>
                </div>
              )}
              {pendingLeaveRequests > 0 && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="font-medium text-primary-800">{pendingLeaveRequests} Leave Request(s)</p>
                  <p className="text-sm text-primary-600">Pending approval</p>
                </div>
              )}
              {criticalTickets === 0 && maintenanceRequired === 0 && lowStockItems === 0 && overdueInvoices.length === 0 && pendingLeaveRequests === 0 && (
                <div className="p-3 bg-success-50 border border-success-200 rounded-lg">
                  <p className="font-medium text-success-800">All Clear!</p>
                  <p className="text-sm text-success-600">No urgent items require attention</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h4 className="font-medium text-neutral-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-500" />
              Quick Stats
            </h4>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-neutral-500">Equipment Uptime</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-success-500 rounded-full" 
                      style={{ width: `${totalEquipment > 0 ? (operationalEquipment / totalEquipment) * 100 : 0}%` }} 
                    />
                  </div>
                  <span className="font-semibold text-success-600">
                    {totalEquipment > 0 ? Math.round((operationalEquipment / totalEquipment) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Robot Deployment Rate</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full" 
                      style={{ width: `${robots.length > 0 ? (operationalRobots / robots.length) * 100 : 0}%` }} 
                    />
                  </div>
                  <span className="font-semibold text-purple-600">
                    {robots.length > 0 ? Math.round((operationalRobots / robots.length) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Invoice Collection Rate</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-success-500 rounded-full" 
                      style={{ width: `${invoices.length > 0 ? (invoices.filter(i => i.status === 'paid').length / invoices.length) * 100 : 0}%` }} 
                    />
                  </div>
                  <span className="font-semibold text-success-600">
                    {invoices.length > 0 ? Math.round((invoices.filter(i => i.status === 'paid').length / invoices.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
