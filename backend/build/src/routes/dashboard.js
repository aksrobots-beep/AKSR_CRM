import { Router } from 'express';
import { findAll, findOne } from '../db/index.js';

const router = Router();

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [tickets, clients, equipment, invoices, leaveRequests, inventory] = await Promise.all([
      findAll('tickets'),
      findAll('clients'),
      findAll('equipment'),
      findAll('invoices'),
      findAll('leave_requests'),
      findAll('inventory'),
    ]);

    const ticketStats = {
      total: tickets.length,
      open: tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      critical: tickets.filter(t => t.priority === 'critical' && !['resolved', 'closed'].includes(t.status)).length,
    };

    const clientStats = {
      total: clients.filter(c => c.status === 'active').length,
    };

    const equipmentStats = {
      total: equipment.length,
      robots: equipment.filter(e => e.type === 'robot').length,
      maintenance_required: equipment.filter(e => e.status === 'maintenance_required').length,
    };

    const revenueStats = {
      total_revenue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
      pending_amount: invoices.filter(i => ['sent', 'draft'].includes(i.status)).reduce((sum, i) => sum + (i.total - i.paid_amount), 0),
      overdue_count: invoices.filter(i => i.status === 'overdue').length,
    };

    const leaveStats = {
      pending: leaveRequests.filter(l => l.status === 'pending').length,
      approved: leaveRequests.filter(l => l.status === 'approved').length,
    };

    const lowStock = inventory.filter(i => i.quantity <= i.min_quantity).length;

    res.json({
      tickets: ticketStats,
      clients: clientStats,
      equipment: equipmentStats,
      revenue: revenueStats,
      leave: leaveStats,
      inventory: { lowStock },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const [ticketsData, clientsData, auditLogsData, usersData] = await Promise.all([
      findAll('tickets'),
      findAll('clients'),
      findAll('audit_logs'),
      findAll('users'),
    ]);
    const tickets = ticketsData
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 10)
      .map(t => {
        const client = clientsData.find(c => c.id === t.client_id);
        return { id: t.id, ticket_number: t.ticket_number, title: t.title, status: t.status, priority: t.priority, updated_at: t.updated_at, client_name: client?.company_name };
      });
    const auditLogs = auditLogsData
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(al => {
        const user = usersData.find(u => u.id === al.user_id);
        return { ...al, user_name: user?.name };
      });
    res.json({ tickets, auditLogs });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Get ticket distribution by status
router.get('/tickets/distribution', async (req, res) => {
  try {
    const tickets = await findAll('tickets');
    const statusCounts = {};
    tickets.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
    res.json(Object.entries(statusCounts).map(([status, count]) => ({ status, count })));
  } catch (error) {
    console.error('Get ticket distribution error:', error);
    res.status(500).json({ error: 'Failed to get ticket distribution' });
  }
});

export { router as dashboardRoutes };
