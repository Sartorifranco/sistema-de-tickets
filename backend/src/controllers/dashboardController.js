const pool = require('../config/db');
const asyncHandler = require('express-async-handler');

// @desc     Obtener métricas para el dashboard de ADMIN
const getAdminDashboardMetrics = asyncHandler(async (req, res) => {
    // Las consultas se ejecutan en paralelo para máxima eficiencia
    const [
        totalTicketsResult,
        activeTicketsResult,
        totalUsersResult,
        recentActivityResult,
        departmentCountsResult,
        agentWorkloadResult,
        healthResult,
        trendCreatedResult,
        trendResolvedResult,
        activePriorityResult,
    ] = await Promise.all([
        pool.execute('SELECT COUNT(*) as count FROM tickets'),
        pool.execute("SELECT COUNT(*) as count FROM tickets WHERE status IN ('open', 'in-progress')"),
        pool.execute('SELECT COUNT(*) as count FROM users'),
        // Actividad reciente unificada: eventos del log (sin ruido de notificaciones) + hitos de tickets
        pool.execute(
            `SELECT * FROM (
                SELECT CONCAT('log-', al.id) AS id,
                       CONVERT(u.username USING utf8mb4) AS username,
                       CONVERT(al.action_type USING utf8mb4) AS action_type,
                       CONVERT(al.description USING utf8mb4) AS description,
                       al.created_at,
                       NULL AS ticket_id
                  FROM activity_logs al
                  LEFT JOIN users u ON al.user_id = u.id
                 WHERE al.action_type NOT LIKE 'notification_%'
                   AND al.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION ALL
                SELECT CONCAT('ticket-created-', t.id) AS id,
                       CONVERT(COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) USING utf8mb4) AS username,
                       'ticket_created' AS action_type,
                       CONCAT('creó el ticket #', t.id, ': ', CONVERT(t.title USING utf8mb4)) AS description,
                       t.created_at,
                       t.id AS ticket_id
                  FROM tickets t
                  LEFT JOIN users u ON t.user_id = u.id
                 WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION ALL
                SELECT CONCAT('ticket-closed-', t.id) AS id,
                       CONVERT(COALESCE(CONCAT(a.first_name, ' ', a.last_name), a.username, 'Sistema') USING utf8mb4) AS username,
                       CASE WHEN t.status = 'closed' THEN 'ticket_closed' ELSE 'ticket_resolved' END AS action_type,
                       CONCAT(CASE WHEN t.status = 'closed' THEN 'cerró' ELSE 'resolvió' END, ' el ticket #', t.id, ': ', CONVERT(t.title USING utf8mb4)) AS description,
                       t.closed_at AS created_at,
                       t.id AS ticket_id
                  FROM tickets t
                  LEFT JOIN users a ON t.assigned_to_user_id = a.id
                 WHERE t.status IN ('resolved', 'closed') AND t.closed_at IS NOT NULL
                   AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION ALL
                SELECT CONCAT('comment-', c.id) AS id,
                       CONVERT(COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) USING utf8mb4) AS username,
                       'comment_added' AS action_type,
                       CONCAT('comentó en el ticket #', c.ticket_id, ': ', CONVERT(COALESCE(t.title, '') USING utf8mb4)) AS description,
                       c.created_at,
                       c.ticket_id
                  FROM comments c
                  LEFT JOIN users u ON c.user_id = u.id
                  LEFT JOIN tickets t ON t.id = c.ticket_id
                 WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ) AS feed
             ORDER BY created_at DESC
             LIMIT 20`
        ),
        pool.execute(`
            SELECT d.name AS departmentName, COUNT(t.id) AS ticketCount
            FROM tickets t
            JOIN departments d ON t.department_id = d.id
            WHERE t.status IN ('open', 'in-progress')
              AND UPPER(d.name) IN ('SOPORTE - IT', 'IMPLEMENTACIONES', 'MANTENIMIENTO', 'DESARROLLO')
            GROUP BY d.name;
        `),
        pool.execute(`
            SELECT u.id as agentId, u.username AS agentName, COUNT(t.id) AS assignedTickets
            FROM tickets t
            JOIN users u ON t.assigned_to_user_id = u.id
            WHERE t.status IN ('open', 'in-progress')
              AND u.role IN ('agent', 'admin')
            GROUP BY u.id, u.username
            ORDER BY assignedTickets DESC;
        `),
        // Salud del servicio: indicadores operativos de los últimos 30 días y del backlog activo
        pool.execute(`
            SELECT
                (SELECT COUNT(*) FROM tickets
                  WHERE status IN ('open', 'in-progress')
                    AND assigned_to_user_id IS NULL) AS unassignedActive,
                (SELECT COUNT(*) FROM tickets
                  WHERE status IN ('open', 'in-progress')
                    AND priority IN ('high', 'urgent')) AS highPriorityActive,
                (SELECT COUNT(*) FROM tickets
                  WHERE status IN ('open', 'in-progress')
                    AND updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)) AS staleActive,
                (SELECT COUNT(*) FROM tickets
                  WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS createdLast30d,
                (SELECT COUNT(*) FROM tickets
                  WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                    AND created_at <  DATE_SUB(NOW(), INTERVAL 30 DAY)) AS createdPrev30d,
                (SELECT COUNT(*) FROM tickets
                  WHERE status IN ('resolved', 'closed')
                    AND closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS resolvedLast30d,
                (SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, closed_at)) FROM tickets
                  WHERE status IN ('resolved', 'closed')
                    AND closed_at IS NOT NULL
                    AND closed_at >= created_at
                    AND closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS avgResolutionMinutes30d,
                (SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, closed_at)) FROM tickets
                  WHERE status IN ('resolved', 'closed')
                    AND closed_at IS NOT NULL
                    AND closed_at >= created_at
                    AND closed_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                    AND closed_at <  DATE_SUB(NOW(), INTERVAL 30 DAY)) AS avgResolutionMinutesPrev30d,
                (SELECT COUNT(*) FROM tickets
                  WHERE DATE(created_at) = CURDATE()) AS createdToday,
                (SELECT COUNT(*) FROM tickets
                  WHERE status IN ('resolved', 'closed')
                    AND DATE(closed_at) = CURDATE()) AS resolvedToday
        `),
        // Tendencia diaria (últimos 14 días): tickets creados
        pool.execute(`
            SELECT DATE(created_at) AS day, COUNT(*) AS count
            FROM tickets
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
            GROUP BY DATE(created_at)
        `),
        // Tendencia diaria (últimos 14 días): tickets resueltos/cerrados
        pool.execute(`
            SELECT DATE(closed_at) AS day, COUNT(*) AS count
            FROM tickets
            WHERE status IN ('resolved', 'closed')
              AND closed_at IS NOT NULL
              AND closed_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
            GROUP BY DATE(closed_at)
        `),
        // Distribución de prioridad del backlog activo
        pool.execute(`
            SELECT priority, COUNT(*) AS count
            FROM tickets
            WHERE status IN ('open', 'in-progress')
            GROUP BY priority
        `),
    ]);

    const health = healthResult[0][0] || {};
    const toNum = (v) => (v === null || v === undefined ? 0 : Number(v));
    const avgMinutes = health.avgResolutionMinutes30d;
    const avgMinutesPrev = health.avgResolutionMinutesPrev30d;
    const createdLast30d = toNum(health.createdLast30d);
    const resolvedLast30d = toNum(health.resolvedLast30d);

    // Serie diaria completa (rellena días sin tickets con 0)
    const toDayKey = (d) => {
        const dt = d instanceof Date ? d : new Date(d);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };
    const createdMap = new Map(trendCreatedResult[0].map((r) => [toDayKey(r.day), toNum(r.count)]));
    const resolvedMap = new Map(trendResolvedResult[0].map((r) => [toDayKey(r.day), toNum(r.count)]));
    const dailyTrend = [];
    for (let i = 13; i >= 0; i -= 1) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = toDayKey(d);
        dailyTrend.push({
            date: key,
            created: createdMap.get(key) || 0,
            resolved: resolvedMap.get(key) || 0,
        });
    }

    const activeByPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    activePriorityResult[0].forEach((row) => {
        if (row.priority in activeByPriority) activeByPriority[row.priority] = toNum(row.count);
    });

    const serviceHealth = {
        unassignedActive: toNum(health.unassignedActive),
        highPriorityActive: toNum(health.highPriorityActive),
        staleActive: toNum(health.staleActive),
        createdLast30d,
        createdPrev30d: toNum(health.createdPrev30d),
        resolvedLast30d,
        resolutionRate30d: createdLast30d > 0 ? Math.round((resolvedLast30d / createdLast30d) * 100) : null,
        avgResolutionHours30d: avgMinutes === null || avgMinutes === undefined ? null : Math.round((Number(avgMinutes) / 60) * 10) / 10,
        avgResolutionHoursPrev30d: avgMinutesPrev === null || avgMinutesPrev === undefined ? null : Math.round((Number(avgMinutesPrev) / 60) * 10) / 10,
        createdToday: toNum(health.createdToday),
        resolvedToday: toNum(health.resolvedToday),
        activeByPriority,
        dailyTrend,
    };

    const departmentCounts = departmentCountsResult[0].reduce((acc, row) => {
        if (row.departmentName.toUpperCase().includes('SOPORTE - IT')) acc['Soporte - IT'] = row.ticketCount;
        else if (row.departmentName.toUpperCase().includes('IMPLEMENTACIONES')) acc['Implementaciones'] = row.ticketCount;
        else if (row.departmentName.toUpperCase().includes('MANTENIMIENTO')) acc['Mantenimiento'] = row.ticketCount;
        else if (row.departmentName.toUpperCase().includes('DESARROLLO')) acc['Desarrollo'] = row.ticketCount;
        return acc;
    }, {});

    const metrics = {
        totalTickets: totalTicketsResult[0][0].count,
        activeTickets: activeTicketsResult[0][0].count,
        totalUsers: totalUsersResult[0][0].count,
        recentActivity: recentActivityResult[0],
        departmentCounts: departmentCounts,
        agentWorkload: agentWorkloadResult[0],
        serviceHealth,
    };
    
    res.status(200).json({ success: true, data: metrics });
});


// @desc     Obtener métricas para el dashboard de AGENTE
// @route    GET /api/dashboard/agent
// @access   Private (Agent)
const getAgentDashboardMetrics = asyncHandler(async (req, res) => {
    const agentId = req.user.id;
    // Titular o asignado adicional (misma regla que el listado de tickets del agente)
    const mine = `(t.assigned_to_user_id = ? OR EXISTS (SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.user_id = ?))`;
    const mineParams = [agentId, agentId];
    const active = `t.status IN ('open', 'in-progress')`;

    const [assignedRes, unassignedRes, resolved30Res, closedTodayRes, highRes, staleRes, priorityRes, recentRes, weekRes] = await Promise.all([
        pool.execute(`SELECT COUNT(*) AS count FROM tickets t WHERE ${mine} AND ${active}`, mineParams),
        pool.execute(`SELECT COUNT(*) AS count FROM tickets t WHERE t.assigned_to_user_id IS NULL AND t.status = 'open' AND NOT EXISTS (SELECT 1 FROM ticket_assignees ta0 WHERE ta0.ticket_id = t.id)`),
        pool.execute(`SELECT COUNT(*) AS count FROM tickets t WHERE ${mine} AND t.status IN ('resolved', 'closed') AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, mineParams),
        pool.execute(`SELECT COUNT(*) AS count FROM tickets t WHERE ${mine} AND t.status IN ('resolved', 'closed') AND t.closed_at >= CURDATE()`, mineParams),
        pool.execute(`SELECT COUNT(*) AS count FROM tickets t WHERE ${mine} AND ${active} AND t.priority IN ('high', 'urgent')`, mineParams),
        pool.execute(`SELECT COUNT(*) AS count FROM tickets t WHERE ${mine} AND ${active} AND t.updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`, mineParams),
        pool.execute(`SELECT t.priority, COUNT(*) AS count FROM tickets t WHERE ${mine} AND ${active} GROUP BY t.priority`, mineParams),
        pool.execute(
            `SELECT t.id,
                    CONVERT(t.title USING utf8mb4) AS title,
                    CONVERT(COALESCE(NULLIF(TRIM(CONCAT(CONVERT(COALESCE(u.first_name, '') USING utf8mb4), ' ', CONVERT(COALESCE(u.last_name, '') USING utf8mb4))), ''), CONVERT(u.username USING utf8mb4)) USING utf8mb4) AS client_name,
                    t.priority, t.status, t.updated_at
               FROM tickets t
               LEFT JOIN users u ON t.user_id = u.id
              WHERE ${mine} AND ${active}
              ORDER BY t.updated_at ASC
              LIMIT 40`,
            mineParams
        ),
        pool.execute(
            `SELECT DATE_FORMAT(t.closed_at, '%Y-%m-%d') AS day, COUNT(*) AS count
               FROM tickets t
              WHERE ${mine} AND t.status IN ('resolved', 'closed')
                AND t.closed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
              GROUP BY DATE_FORMAT(t.closed_at, '%Y-%m-%d')`,
            mineParams
        ),
    ]);

    const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const row of priorityRes[0]) {
        if (Object.prototype.hasOwnProperty.call(byPriority, row.priority)) byPriority[row.priority] = Number(row.count) || 0;
    }

    const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
    const recent = recentRes[0]
        .slice()
        .sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || new Date(a.updated_at) - new Date(b.updated_at))
        .slice(0, 6);

    const weekMap = new Map(weekRes[0].map((row) => [String(row.day).slice(0, 10), Number(row.count) || 0]));
    const week = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        week.push({ date: key, closed: weekMap.get(key) || 0 });
    }

    res.status(200).json({
        success: true,
        data: {
            assignedTickets: Number(assignedRes[0][0].count) || 0,
            unassignedTickets: Number(unassignedRes[0][0].count) || 0,
            resolvedByMe: Number(resolved30Res[0][0].count) || 0,
            closedToday: Number(closedTodayRes[0][0].count) || 0,
            highPriorityActive: Number(highRes[0][0].count) || 0,
            staleActive: Number(staleRes[0][0].count) || 0,
            byPriority,
            recent,
            week,
        },
    });
});


// @desc     Obtener métricas para el dashboard de CLIENTE
const getClientDashboardMetrics = asyncHandler(async (req, res) => {
    const clientId = req.user.id;

    const [countsRes, resolved30Res, oldestRes, recentRes] = await Promise.all([
        pool.execute(`SELECT status, COUNT(*) AS count FROM tickets WHERE user_id = ? GROUP BY status`, [clientId]),
        pool.execute(
            `SELECT COUNT(*) AS count FROM tickets WHERE user_id = ? AND status IN ('resolved', 'closed') AND closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [clientId]
        ),
        pool.execute(
            `SELECT MIN(created_at) AS oldest FROM tickets WHERE user_id = ? AND status IN ('open', 'in-progress')`,
            [clientId]
        ),
        pool.execute(
            `SELECT t.id,
                    CONVERT(t.title USING utf8mb4) AS title,
                    t.status, t.priority, t.updated_at, t.created_at,
                    CONVERT(COALESCE(NULLIF(TRIM(CONCAT(CONVERT(COALESCE(a.first_name, '') USING utf8mb4), ' ', CONVERT(COALESCE(a.last_name, '') USING utf8mb4))), ''), CONVERT(a.username USING utf8mb4)) USING utf8mb4) AS agent_name
               FROM tickets t
               LEFT JOIN users a ON t.assigned_to_user_id = a.id
              WHERE t.user_id = ? AND t.status IN ('open', 'in-progress')
              ORDER BY t.updated_at ASC
              LIMIT 20`,
            [clientId]
        ),
    ]);

    const metrics = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    for (const row of countsRes[0]) {
        if (row.status === 'in-progress') metrics.inProgress = Number(row.count) || 0;
        else if (Object.prototype.hasOwnProperty.call(metrics, row.status)) metrics[row.status] = Number(row.count) || 0;
    }

    let oldestWaitingDays = null;
    if (oldestRes[0][0]?.oldest) {
        oldestWaitingDays = Math.max(0, Math.floor((Date.now() - new Date(oldestRes[0][0].oldest).getTime()) / 86400000));
    }

    const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
    const recent = recentRes[0]
        .slice()
        .sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || new Date(a.updated_at) - new Date(b.updated_at))
        .slice(0, 5);

    res.status(200).json({
        success: true,
        data: {
            ...metrics,
            resolved30d: Number(resolved30Res[0][0].count) || 0,
            oldestWaitingDays,
            recent,
        },
    });
});


module.exports = {
    getAdminDashboardMetrics,
    getAgentDashboardMetrics,
    getClientDashboardMetrics,
};