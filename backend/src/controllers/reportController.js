const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// @desc    Obtener todas las métricas para la página de reportes, filtrado por fecha
// @route   GET /api/reports
// @access  Private (Admin)
const getReports = asyncHandler(async (req, res) => {
    // Obtenemos el rango de fechas desde los query params
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error("Las fechas de inicio y fin son requeridas.");
    }
    
    // Formateamos las fechas para que abarquen el día completo
    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    const [
        ticketsByStatusResult,
        ticketsByPriorityResult,
        ticketsByDepartmentResult,
        companyReportResult,
        agentPerformanceResult,
        agentResolutionTimeResult
    ] = await Promise.all([
        // Las consultas ahora usan el rango de fechas en la cláusula WHERE
        pool.execute('SELECT status, COUNT(id) AS count FROM tickets WHERE created_at BETWEEN ? AND ? GROUP BY status', [startOfDay, endOfDay]),
        pool.execute('SELECT priority, COUNT(id) AS count FROM tickets WHERE created_at BETWEEN ? AND ? GROUP BY priority', [startOfDay, endOfDay]),
        pool.execute(`
            SELECT d.name AS departmentName, COUNT(t.id) AS count
            FROM tickets t
            JOIN departments d ON t.department_id = d.id
            WHERE t.created_at BETWEEN ? AND ?
            GROUP BY d.name
        `, [startOfDay, endOfDay]),
        pool.execute(`
            SELECT c.name AS companyName, COUNT(t.id) AS ticketCount
            FROM companies c
            LEFT JOIN users u ON u.company_id = c.id
            LEFT JOIN tickets t ON t.user_id = u.id AND t.created_at BETWEEN ? AND ?
            GROUP BY c.id, c.name
        `, [startOfDay, endOfDay]),
        pool.execute(`
            SELECT u.username, COUNT(t.id) AS assignedTickets,
                   SUM(CASE WHEN t.status IN ('closed', 'resolved') THEN 1 ELSE 0 END) AS closedTickets
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_to_user_id AND t.created_at BETWEEN ? AND ?
            WHERE u.role IN ('agent', 'admin')
            GROUP BY u.id, u.username
        `, [startOfDay, endOfDay]),
        pool.execute(`
            SELECT
                u.username AS agentName,
                COUNT(t.id) AS resolvedTickets,
                AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.closed_at)) AS avgResolutionTimeHours
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_to_user_id
                AND t.status IN ('resolved', 'closed')
                AND t.closed_at IS NOT NULL
                AND t.closed_at BETWEEN ? AND ?
            WHERE u.role IN ('agent', 'admin')
            GROUP BY u.id, u.username
            ORDER BY resolvedTickets DESC;
        `, [startOfDay, endOfDay])
    ]);

    // ✅ CORRECCIÓN: Lógica más robusta para formatear el tiempo de resolución.
    const agentResolutionTimes = agentResolutionTimeResult[0].map(row => {
        // 1. Intenta convertir el valor a un número.
        const avgTime = parseFloat(row.avgResolutionTimeHours);
        
        // 2. Si es un número válido (no NaN), lo formatea. Si no (es NULL), lo deja como null.
        const formattedAvgTime = !isNaN(avgTime) ? parseFloat(avgTime.toFixed(2)) : null;

        return {
            agentName: row.agentName,
            resolvedTickets: row.resolvedTickets || 0,
            avgResolutionTimeHours: formattedAvgTime
        };
    });

    const metrics = {
        ticketsByStatus: ticketsByStatusResult[0] || [],
        ticketsByPriority: ticketsByPriorityResult[0] || [],
        ticketsByDepartment: ticketsByDepartmentResult[0] || [],
        companyReport: companyReportResult[0] || [],
        agentPerformance: agentPerformanceResult[0] || [],
        agentResolutionTimes: agentResolutionTimes, // Usamos la data ya procesada
    };
    
    res.status(200).json({ success: true, data: metrics });
});

module.exports = {
    getReports,
};