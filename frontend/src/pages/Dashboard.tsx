import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/layout';
import { StatsCard } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { normalizeUserRole } from '../utils/userRole';
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

type DashStats = {
  tickets: { total: number; open: number; resolved: number; critical: number };
  clients: { total: number };
  equipment: {
    total: number;
    robots: number;
    maintenance_required: number;
    operational: number;
  };
  revenue: { total_revenue: number; pending_amount: number; overdue_count: number };
  resolvedThisMonth?: number;
  trends?: {
    openTickets: { value: number; direction: 'up' | 'down' | 'stable' };
    activeClients: { value: number; direction: 'up' | 'down' | 'stable' };
    monthlyRevenue: { value: number; direction: 'up' | 'down' | 'stable' };
  };
  period?: { revenueThisMonth?: number; revenuePrevMonth?: number };
};

type UserSummary = {
  tasks: {
    totalAssigned: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    completedToday: number;
  };
  tickets: {
    totalAssigned: number;
    open: number;
    inProgress: number;
    resolved: number;
  };
};

export function Dashboard() {
  const { user } = useAuthStore();
  const role = normalizeUserRole(user?.role);
  const isTechnician = role === 'technician';
  const [stats, setStats] = useState<DashStats | null>(null);
  const [activity, setActivity] = useState<{ tickets: any[] } | null>(null);
  const [distribution, setDistribution] = useState<Array<{ status: string; count: number }>>([]);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [act, dist, usr, s] = await Promise.all([
          api.getDashboardActivity(),
          api.getDashboardTicketDistribution(),
          api.getDashboardUserSummary(),
          isTechnician ? Promise.resolve(null) : api.getDashboardStats(),
        ]);
        if (!cancelled) {
          setStats((s as DashStats) || null);
          setActivity(act);
          setDistribution(Array.isArray(dist) ? dist : []);
          setUserSummary(usr as UserSummary);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTechnician]);

  const distTotal = useMemo(
    () => distribution.reduce((sum, x) => sum + (Number(x.count) || 0), 0),
    [distribution]
  );

  const countForStatus = (status: string) =>
    distribution.find((x) => x.status === status)?.count ?? 0;

  const recentTickets = useMemo(() => {
    const rows = activity?.tickets;
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 5);
  }, [activity]);

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

  const openTrend = stats?.trends?.openTickets;
  const clientsTrend = stats?.trends?.activeClients;
  const revenueTrend = stats?.trends?.monthlyRevenue;

  const monthlyRevenueDisplay = stats?.period?.revenueThisMonth ?? stats?.revenue?.total_revenue ?? 0;

  return (
    <div className="min-h-screen">
      <Header
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      />

      <div className="p-6 space-y-6 animate-stagger">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {!isTechnician && (
            <>
              <StatsCard
                title="Open Tickets"
                value={stats?.tickets?.open ?? '—'}
                icon={<Ticket className="w-5 h-5" />}
                color="primary"
                trend={openTrend ? { value: openTrend.value, direction: openTrend.direction } : undefined}
              />
              <StatsCard
                title="Active Clients"
                value={stats?.clients?.total ?? '—'}
                icon={<Users className="w-5 h-5" />}
                color="success"
                trend={clientsTrend ? { value: clientsTrend.value, direction: clientsTrend.direction } : undefined}
              />
              <StatsCard
                title="Managed Robots"
                value={stats?.equipment?.robots ?? '—'}
                icon={<Bot className="w-5 h-5" />}
                color="accent"
              />
              <StatsCard
                title="Monthly Revenue"
                value={
                  stats ? `RM ${Number(monthlyRevenueDisplay).toLocaleString()}` : '—'
                }
                icon={<DollarSign className="w-5 h-5" />}
                color="success"
                trend={revenueTrend ? { value: revenueTrend.value, direction: revenueTrend.direction } : undefined}
              />
            </>
          )}
          <StatsCard
            title="My Open Tasks"
            value={userSummary?.tasks?.inProgress != null ? userSummary.tasks.inProgress + userSummary.tasks.pending : '—'}
            icon={<Clock className="w-5 h-5" />}
            color="warning"
          />
          <StatsCard
            title="My Open Tickets"
            value={userSummary?.tickets?.open ?? '—'}
            icon={<Ticket className="w-5 h-5" />}
            color="accent"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!isTechnician && ((stats?.tickets?.critical ?? 0) > 0 || (stats?.equipment?.maintenance_required ?? 0) > 0) ? (
              <div className="card p-5">
                <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-warning-500" />
                  Attention Required
                </h3>
                <div className="space-y-3">
                  {(stats?.tickets?.critical ?? 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-danger-50 rounded-lg border border-danger-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-danger-100 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-danger-600" />
                        </div>
                        <div>
                          <p className="font-medium text-danger-900">Critical Tickets</p>
                          <p className="text-sm text-danger-700">
                            {stats?.tickets?.critical} ticket(s) need immediate attention
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {(stats?.equipment?.maintenance_required ?? 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg border border-warning-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-warning-600" />
                        </div>
                        <div>
                          <p className="font-medium text-warning-900">Maintenance Required</p>
                          <p className="text-sm text-warning-700">
                            {stats?.equipment?.maintenance_required} equipment need servicing
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary-500" />
                {isTechnician ? 'My Ticket Activity' : 'Recent Activity'}
              </h3>
              <div className="space-y-3">
                {recentTickets.length === 0 ? (
                  <p className="text-neutral-500 text-center py-4">No recent activity</p>
                ) : (
                  recentTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-5 h-5 text-neutral-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-900 truncate">{ticket.title}</p>
                        <p className="text-sm text-neutral-500">{ticket.ticket_number}</p>
                      </div>
                      <span className={`badge ${getStatusColor(ticket.status)}`}>
                        {String(ticket.status || '').replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {!isTechnician && (
              <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-success-500" />
                Performance
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Resolved This Month</span>
                  <span className="font-semibold text-neutral-900">{stats?.resolvedThisMonth ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Pending Invoices</span>
                  <span className="font-semibold text-neutral-900">
                    RM {(stats?.revenue?.pending_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Equipment Operational</span>
                  <span className="font-semibold text-success-600">
                    {stats?.equipment?.total
                      ? `${stats.equipment.operational}/${stats.equipment.total}`
                      : '—'}
                  </span>
                </div>
              </div>
              </div>
            )}

            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-primary-500" />
                My Workload
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Tasks pending / in progress</span>
                  <span className="font-semibold text-neutral-900">
                    {userSummary ? `${userSummary.tasks.pending} / ${userSummary.tasks.inProgress}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Tasks overdue</span>
                  <span className="font-semibold text-danger-600">{userSummary?.tasks?.overdue ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Tasks completed today</span>
                  <span className="font-semibold text-success-600">{userSummary?.tasks?.completedToday ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Tickets open / resolved</span>
                  <span className="font-semibold text-neutral-900">
                    {userSummary ? `${userSummary.tickets.open} / ${userSummary.tickets.resolved}` : '—'}
                  </span>
                </div>
              </div>
            </div>

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
                  const count = countForStatus(status);
                  const percentage = distTotal > 0 ? (count / distTotal) * 100 : 0;
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
