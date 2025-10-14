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
        agentWorkloadResult
    ] = await Promise.all([
        pool.execute('SELECT COUNT(*) as count FROM tickets'),
        pool.execute("SELECT COUNT(*) as count FROM tickets WHERE status IN ('open', 'in-progress')"),
        pool.execute('SELECT COUNT(*) as count FROM users'),
        pool.execute(
            `SELECT al.id, u.username, al.action_type, al.description, al.created_at 
             FROM activity_logs al 
             LEFT JOIN users u ON al.user_id = u.id 
             ORDER BY al.created_at DESC LIMIT 5`
        ),
        pool.execute(`
            SELECT d.name AS departmentName, COUNT(t.id) AS ticketCount
            FROM tickets t
            JOIN departments d ON t.department_id = d.id
            WHERE t.status IN ('open', 'in-progress')
              AND UPPER(d.name) IN ('SOPORTE - IT', 'IMPLEMENTACIONES', 'MANTENIMIENTO')
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
        `)
    ]);

    const departmentCounts = departmentCountsResult[0].reduce((acc, row) => {
        if (row.departmentName.toUpperCase().includes('SOPORTE - IT')) acc['Soporte - IT'] = row.ticketCount;
        else if (row.departmentName.toUpperCase().includes('IMPLEMENTACIONES')) acc['Implementaciones'] = row.ticketCount;
        else if (row.departmentName.toUpperCase().includes('MANTENIMIENTO')) acc['Mantenimiento'] = row.ticketCount;
        return acc;
    }, {});

    const metrics = {
        totalTickets: totalTicketsResult[0][0].count,
        activeTickets: activeTicketsResult[0][0].count,
        totalUsers: totalUsersResult[0][0].count,
        recentActivity: recentActivityResult[0],
        departmentCounts: departmentCounts,
        agentWorkload: agentWorkloadResult[0]
    };
    
    res.status(200).json({ success: true, data: metrics });
});


// @desc     Obtener métricas para el dashboard de AGENTE
// @route    GET /api/dashboard/agent
// @access   Private (Agent)
const getAgentDashboardMetrics = asyncHandler(async (req, res) => {
    const agentId = req.user.id;

    // ✅ CORRECCIÓN: Ajuste en la consulta de resolvedByAgentResult
    // Ahora cuenta los tickets que están en 'resolved' O 'closed'.
    const [
        assignedTicketsResult,
        unassignedTicketsResult,
        resolvedByAgentResult
    ] = await Promise.all([
        pool.execute("SELECT COUNT(*) as count FROM tickets WHERE assigned_to_user_id = ? AND status IN ('open', 'in-progress')", [agentId]),
        pool.execute("SELECT COUNT(*) as count FROM tickets WHERE assigned_to_user_id IS NULL AND status = 'open'"),
        pool.execute("SELECT COUNT(*) as count FROM tickets WHERE assigned_to_user_id = ? AND status IN ('resolved', 'closed')", [agentId]), // ✅ CAMBIO AQUÍ
    ]);

    const metrics = {
        assignedTickets: assignedTicketsResult[0][0].count,
        unassignedTickets: unassignedTicketsResult[0][0].count,
        resolvedByMe: resolvedByAgentResult[0][0].count,
    };

    res.status(200).json({ success: true, data: metrics });
});


// @desc     Obtener métricas para el dashboard de CLIENTE
const getClientDashboardMetrics = asyncHandler(async (req, res) => {
    const clientId = req.user.id;

    const [ticketCounts] = await pool.execute(
        `SELECT status, COUNT(*) as count FROM tickets WHERE user_id = ? GROUP BY status`,
        [clientId]
    );

    const metrics = {
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
    };

    ticketCounts.forEach(row => {
        if (row.status === 'in-progress') {
            metrics.inProgress = row.count;
        } else if (metrics.hasOwnProperty(row.status)) {
            metrics[row.status] = row.count;
        }
    });

    res.status(200).json({ success: true, data: metrics });
});


module.exports = {
    getAdminDashboardMetrics,
    getAgentDashboardMetrics,
    getClientDashboardMetrics,
};