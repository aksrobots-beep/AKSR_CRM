import { Router } from 'express';
import { query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { normalizeUserRole } from '../utils/userRole.js';

const router = Router();

async function safeQuery(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      console.warn('[dashboard] optional table missing:', msg.slice(0, 120));
      return fallback;
    }
    throw err;
  }
}

function pctTrend(nowVal, prevVal) {
  const n = Number(nowVal) || 0;
  const p = Number(prevVal) || 0;
  if (p === 0) {
    return { changePercent: n > 0 ? 100 : 0, direction: n > 0 ? 'up' : 'stable' };
  }
  const raw = Math.round(((n - p) / p) * 100);
  const direction = raw > 0 ? 'up' : raw < 0 ? 'down' : 'stable';
  return { changePercent: Math.abs(raw), direction };
}

// Get dashboard stats (aggregates — no full-table loads)
router.get('/stats', async (req, res) => {
  try {
    const [
      ticketOpen,
      ticketResolved,
      ticketCritical,
      ticketTotal,
      clientActive,
      equipmentTotal,
      equipmentRobots,
      equipmentMaint,
      revenuePaid,
      pendingAmount,
      overdueCount,
      leavePending,
      leaveApproved,
      lowStock,
      clientsThisMonth,
      clientsPrevMonth,
      ticketsCreatedThisMonth,
      ticketsCreatedPrevMonth,
      revenueThisMonth,
      revenuePrevMonth,
      resolvedThisMonthCount,
      equipmentOperationalCount,
    ] = await Promise.all([
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1
             AND t.status NOT IN ('resolved', 'closed')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(`SELECT COUNT(*) AS c FROM tickets t WHERE COALESCE(t.is_active,1) = 1 AND t.status = 'resolved'`).then(
            (r) => Number(r[0]?.c || 0)
          ),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1
             AND t.priority = 'critical'
             AND t.status NOT IN ('resolved', 'closed')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(`SELECT COUNT(*) AS c FROM tickets t WHERE COALESCE(t.is_active,1) = 1`).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM clients c WHERE COALESCE(c.is_active,1) = 1 AND c.status = 'active'`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(`SELECT COUNT(*) AS c FROM equipment e WHERE COALESCE(e.is_active,1) = 1`).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM equipment e WHERE COALESCE(e.is_active,1) = 1 AND e.type = 'robot'`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM equipment e WHERE COALESCE(e.is_active,1) = 1 AND e.status = 'maintenance_required'`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COALESCE(SUM(CAST(i.total AS DECIMAL(14,2))), 0) AS s
             FROM invoices i WHERE COALESCE(i.is_active,1) = 1 AND i.status = 'paid'`
          ).then((r) => Number(r[0]?.s || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COALESCE(SUM(GREATEST(CAST(i.total AS DECIMAL(14,2)) - CAST(i.paid_amount AS DECIMAL(14,2)), 0)), 0) AS s
             FROM invoices i
             WHERE COALESCE(i.is_active,1) = 1 AND i.status IN ('sent', 'draft')`
          ).then((r) => Number(r[0]?.s || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM invoices i WHERE COALESCE(i.is_active,1) = 1 AND i.status = 'overdue'`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(`SELECT COUNT(*) AS c FROM leave_requests lr WHERE lr.status = 'pending'`).then((r) =>
            Number(r[0]?.c || 0)
          ),
        0
      ),
      safeQuery(
        () =>
          query(`SELECT COUNT(*) AS c FROM leave_requests lr WHERE lr.status = 'approved'`).then((r) =>
            Number(r[0]?.c || 0)
          ),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM inventory inv
             WHERE COALESCE(inv.is_active,1) = 1 AND inv.quantity <= inv.min_quantity`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM clients c
             WHERE COALESCE(c.is_active,1) = 1
             AND c.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM clients c
             WHERE COALESCE(c.is_active,1) = 1
             AND c.created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
             AND c.created_at < DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1
             AND t.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1
             AND t.created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
             AND t.created_at < DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COALESCE(SUM(CAST(i.total AS DECIMAL(14,2))), 0) AS s
             FROM invoices i
             WHERE COALESCE(i.is_active,1) = 1 AND i.status = 'paid'
             AND i.updated_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.s || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COALESCE(SUM(CAST(i.total AS DECIMAL(14,2))), 0) AS s
             FROM invoices i
             WHERE COALESCE(i.is_active,1) = 1 AND i.status = 'paid'
             AND i.updated_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
             AND i.updated_at < DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.s || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1 AND t.status = 'resolved'
             AND t.resolved_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
      safeQuery(
        () =>
          query(
            `SELECT COUNT(*) AS c FROM equipment e WHERE COALESCE(e.is_active,1)=1 AND e.status = 'operational'`
          ).then((r) => Number(r[0]?.c || 0)),
        0
      ),
    ]);

    const openTrend = pctTrend(ticketsCreatedThisMonth, ticketsCreatedPrevMonth);
    const clientsTrend = pctTrend(clientsThisMonth, clientsPrevMonth);
    const revenueTrend = pctTrend(revenueThisMonth, revenuePrevMonth);

    res.json({
      tickets: {
        total: ticketTotal,
        open: ticketOpen,
        resolved: ticketResolved,
        critical: ticketCritical,
      },
      clients: { total: clientActive },
      equipment: {
        total: equipmentTotal,
        robots: equipmentRobots,
        maintenance_required: equipmentMaint,
        operational: equipmentOperationalCount,
      },
      revenue: {
        total_revenue: revenuePaid,
        pending_amount: pendingAmount,
        overdue_count: overdueCount,
      },
      resolvedThisMonth: resolvedThisMonthCount,
      leave: { pending: leavePending, approved: leaveApproved },
      inventory: { lowStock },
      trends: {
        openTickets: { value: openTrend.changePercent, direction: openTrend.direction },
        activeClients: { value: clientsTrend.changePercent, direction: clientsTrend.direction },
        monthlyRevenue: { value: revenueTrend.changePercent, direction: revenueTrend.direction },
      },
      period: {
        clientsAddedThisMonth: clientsThisMonth,
        clientsAddedPrevMonth: clientsPrevMonth,
        ticketsCreatedThisMonth,
        ticketsCreatedPrevMonth,
        revenueThisMonth,
        revenuePrevMonth,
      },
    });
  } catch (error) {
    send500(res, 'Failed to get dashboard stats', error);
  }
});

router.get('/activity', async (req, res) => {
  try {
    const role = normalizeUserRole(req.user?.role);
    const userId = req.user?.id;
    const techOnly = role === 'technician' && userId;
    let ticketRows = [];
    try {
      if (techOnly) {
        ticketRows = await query(
          `SELECT t.id, t.ticket_number, t.title, t.status, t.priority, t.updated_at,
                  c.company_name AS client_name
           FROM tickets t
           LEFT JOIN clients c ON c.id = t.client_id
           WHERE COALESCE(t.is_active,1) = 1
             AND (t.assigned_to = ? OR t.created_by = ?)
           ORDER BY t.updated_at DESC
           LIMIT 10`,
          [userId, userId]
        );
      } else {
        ticketRows = await query(
          `SELECT t.id, t.ticket_number, t.title, t.status, t.priority, t.updated_at,
                  c.company_name AS client_name
           FROM tickets t
           LEFT JOIN clients c ON c.id = t.client_id
           WHERE COALESCE(t.is_active,1) = 1
           ORDER BY t.updated_at DESC
           LIMIT 10`
        );
      }
    } catch (err) {
      const msg = err?.message || '';
      if (!msg.includes("doesn't exist") && !msg.includes('Unknown table')) throw err;
    }

    let auditRows = [];
    try {
      auditRows = await query(
        `SELECT al.id, al.entity_type, al.entity_id, al.action, al.previous_value, al.new_value,
                al.user_id, al.\`timestamp\` AS timestamp, al.ip_address, u.name AS user_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.\`timestamp\` DESC
         LIMIT 10`
      );
    } catch (err) {
      const msg = err?.message || '';
      if (!msg.includes("doesn't exist") && !msg.includes('Unknown table')) throw err;
    }

    const tickets = (Array.isArray(ticketRows) ? ticketRows : []).map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      title: t.title,
      status: t.status,
      priority: t.priority,
      updated_at: t.updated_at,
      client_name: t.client_name,
    }));

    const auditLogs = (Array.isArray(auditRows) ? auditRows : []).map((al) => ({
      ...al,
      user_name: al.user_name,
    }));

    res.json({ tickets, auditLogs });
  } catch (error) {
    console.error('Get activity error:', error);
    send500(res, 'Failed to get activity', error);
  }
});

router.get('/tickets/distribution', async (req, res) => {
  try {
    const role = normalizeUserRole(req.user?.role);
    const userId = req.user?.id;
    const rows =
      role === 'technician' && userId
        ? await query(
            `SELECT t.status AS status, COUNT(*) AS cnt
             FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1
               AND (t.assigned_to = ? OR t.created_by = ?)
             GROUP BY t.status`,
            [userId, userId]
          )
        : await query(
            `SELECT t.status AS status, COUNT(*) AS cnt
             FROM tickets t
             WHERE COALESCE(t.is_active,1) = 1
             GROUP BY t.status`
          );
    const list = Array.isArray(rows) ? rows : [];
    res.json(list.map((r) => ({ status: r.status, count: Number(r.cnt || 0) })));
  } catch (error) {
    console.error('Get ticket distribution error:', error);
    send500(res, 'Failed to get ticket distribution', error);
  }
});

// Personal dashboard summary (task + ticket workload for logged-in user).
router.get('/user-summary', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [taskAgg, ticketAgg] = await Promise.all([
      safeQuery(
        () =>
          query(
            `SELECT
               COUNT(*) AS total_assigned,
               SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
               SUM(CASE WHEN t.status != 'completed' AND ((t.due_at IS NOT NULL AND t.due_at < NOW()) OR (t.due_at IS NULL AND t.due_date < CURRENT_DATE)) THEN 1 ELSE 0 END) AS overdue,
               SUM(CASE WHEN t.status = 'completed' AND t.completed_at >= CURRENT_DATE THEN 1 ELSE 0 END) AS completed_today
             FROM tasks t
             WHERE COALESCE(t.is_active,1) = 1 AND t.assigned_to = ?`,
            [userId]
          ).then((r) => r?.[0] || {}),
        {}
      ),
      safeQuery(
        () =>
          query(
            `SELECT
               COUNT(*) AS total_assigned,
               SUM(CASE WHEN tk.status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved,
               SUM(CASE WHEN tk.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
               SUM(CASE WHEN tk.status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS open
             FROM tickets tk
             WHERE COALESCE(tk.is_active,1) = 1 AND tk.assigned_to = ?`,
            [userId]
          ).then((r) => r?.[0] || {}),
        {}
      ),
    ]);

    res.json({
      tasks: {
        totalAssigned: Number(taskAgg.total_assigned) || 0,
        pending: Number(taskAgg.pending) || 0,
        inProgress: Number(taskAgg.in_progress) || 0,
        completed: Number(taskAgg.completed) || 0,
        overdue: Number(taskAgg.overdue) || 0,
        completedToday: Number(taskAgg.completed_today) || 0,
      },
      tickets: {
        totalAssigned: Number(ticketAgg.total_assigned) || 0,
        open: Number(ticketAgg.open) || 0,
        inProgress: Number(ticketAgg.in_progress) || 0,
        resolved: Number(ticketAgg.resolved) || 0,
      },
    });
  } catch (error) {
    send500(res, 'Failed to get user dashboard summary', error);
  }
});

export { router as dashboardRoutes };
