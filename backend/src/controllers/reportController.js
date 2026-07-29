const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

const TOP_TITLES_LIMIT = 3;

/**
 * Agrupa filas { agentId, title, count } en top N títulos + resto por agente.
 * @returns {Map<number, { items: { title: string, count: number }[], othersCount: number, label: string | null }>}
 */
function buildTitleBreakdownByAgent(rows) {
    const byAgent = new Map();
    for (const row of rows) {
        const agentId = row.agentId;
        if (!byAgent.has(agentId)) byAgent.set(agentId, []);
        byAgent.get(agentId).push({
            title: String(row.title || 'Sin título').trim() || 'Sin título',
            count: Number(row.count) || 0,
        });
    }

    const result = new Map();
    for (const [agentId, titles] of byAgent.entries()) {
        titles.sort(
            (a, b) =>
                b.count - a.count ||
                a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
        );
        const top = titles.slice(0, TOP_TITLES_LIMIT);
        const othersCount = titles.slice(TOP_TITLES_LIMIT).reduce((sum, t) => sum + t.count, 0);
        // Solo mostrar desglose si hay más de un tipo de título (evita repetir el total)
        const label =
            titles.length > 1
                ? [
                      ...top.map((t) => `${t.title} ${t.count}`),
                      ...(othersCount > 0 ? [`Resto de títulos ${othersCount}`] : []),
                  ].join(' · ')
                : null;
        result.set(agentId, { items: top, othersCount, label });
    }
    return result;
}

function agentTicketFilters({ agentId, companyId, departmentId, categoryId, clientId }) {
    return `
        ${agentId ? 'AND t.assigned_to_user_id = ?' : ''}
        ${companyId ? 'AND u_client.company_id = ?' : ''}
        ${departmentId ? 'AND t.department_id = ?' : ''}
        ${categoryId ? 'AND t.category_id = ?' : ''}
        ${clientId ? 'AND t.user_id = ?' : ''}
    `;
}

// @desc    Obtener todas las métricas para la página de reportes, filtrado
// @route   GET /api/reports
// @access  Private (Admin)
const getReports = asyncHandler(async (req, res) => {
    const {
        startDate,
        endDate,
        agentId,
        companyId,
        departmentId,
        categoryId,
        clientId,
    } = req.query;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Las fechas de inicio y fin son requeridas.');
    }

    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    const whereClauses = ['t.created_at BETWEEN ? AND ?'];
    const params = [startOfDay, endOfDay];

    const agentUserFilter = ["u.role IN ('agent', 'admin')"];
    const agentUserParams = [];

    if (agentId) {
        whereClauses.push('t.assigned_to_user_id = ?');
        params.push(agentId);
        agentUserFilter.push('u.id = ?');
        agentUserParams.push(agentId);
    }
    if (companyId) {
        whereClauses.push('u.company_id = ?');
        params.push(companyId);
    }
    if (departmentId) {
        whereClauses.push('t.department_id = ?');
        params.push(departmentId);
    }
    if (categoryId) {
        whereClauses.push('t.category_id = ?');
        params.push(categoryId);
    }
    if (clientId) {
        whereClauses.push('t.user_id = ?');
        params.push(clientId);
    }

    const baseFrom = `
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN ticket_categories c ON t.category_id = c.id
    `;
    const fullWhereClause = `WHERE ${whereClauses.join(' AND ')}`;
    const subQueryParams = params.slice(2);
    const ticketFiltersSql = agentTicketFilters({
        agentId,
        companyId,
        departmentId,
        categoryId,
        clientId,
    });

    const [
        ticketsByStatusResult,
        ticketsByPriorityResult,
        ticketsByDepartmentResult,
        agentPerformanceResult,
        agentResolutionTimeResult,
        closedTitlesByAgentResult,
        resolvedTitlesByAgentResult,
        ticketsByCategoryResult,
        topClientsResult,
        ticketsByHourResult,
    ] = await Promise.all([
        pool.execute(
            `SELECT t.status, COUNT(t.id) AS count
             ${baseFrom}
             ${fullWhereClause}
             GROUP BY t.status`,
            params
        ),

        pool.execute(
            `SELECT t.priority, COUNT(t.id) AS count
             ${baseFrom}
             ${fullWhereClause}
             GROUP BY t.priority`,
            params
        ),

        pool.execute(
            `
            SELECT d.name AS departmentName, d.id AS departmentId, COUNT(t.id) AS count
            ${baseFrom}
            ${fullWhereClause}
            GROUP BY d.id, d.name
            HAVING departmentName IS NOT NULL
        `,
            params
        ),

        // 4. Rendimiento de Agente
        pool.execute(
            `
            SELECT
                u.id as agentId,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) AS agentName,
                COUNT(t_filtered.id) AS assignedTickets,
                SUM(CASE WHEN t_filtered.status IN ('closed', 'resolved') THEN 1 ELSE 0 END) AS closedTickets
            FROM users u
            LEFT JOIN (
                SELECT t.id, t.status, t.assigned_to_user_id
                FROM tickets t
                LEFT JOIN users u_client ON t.user_id = u_client.id
                WHERE t.created_at BETWEEN ? AND ?
                  ${ticketFiltersSql}
            ) t_filtered ON u.id = t_filtered.assigned_to_user_id
            WHERE ${agentUserFilter.join(' AND ')}
            GROUP BY u.id, u.username, u.first_name, u.last_name
            ORDER BY assignedTickets DESC
        `,
            [startOfDay, endOfDay, ...subQueryParams, ...agentUserParams]
        ),

        // 5. Tiempo de Resolución de Agente
        pool.execute(
            `
            SELECT
                u.id as agentId,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) AS agentName,
                COUNT(t_filtered.id) AS resolvedTickets,
                AVG(TIMESTAMPDIFF(HOUR, t_filtered.created_at, t_filtered.closed_at)) AS avgResolutionTimeHours
            FROM users u
            LEFT JOIN (
                SELECT t.id, t.created_at, t.closed_at, t.assigned_to_user_id
                FROM tickets t
                LEFT JOIN users u_client ON t.user_id = u_client.id
                WHERE t.status IN ('resolved', 'closed')
                  AND t.closed_at IS NOT NULL
                  AND t.closed_at BETWEEN ? AND ?
                  ${ticketFiltersSql}
            ) t_filtered ON u.id = t_filtered.assigned_to_user_id
            WHERE ${agentUserFilter.join(' AND ')}
            GROUP BY u.id, u.username, u.first_name, u.last_name
            ORDER BY resolvedTickets DESC
        `,
            [startOfDay, endOfDay, ...subQueryParams, ...agentUserParams]
        ),

        // 4b. Títulos de cerrados (misma ventana que rendimiento: created_at)
        pool.execute(
            `
            SELECT t.assigned_to_user_id AS agentId,
                   TRIM(t.title) AS title,
                   COUNT(*) AS count
            FROM tickets t
            LEFT JOIN users u_client ON t.user_id = u_client.id
            WHERE t.created_at BETWEEN ? AND ?
              AND t.status IN ('resolved', 'closed')
              AND t.assigned_to_user_id IS NOT NULL
              ${ticketFiltersSql}
            GROUP BY t.assigned_to_user_id, TRIM(t.title)
        `,
            [startOfDay, endOfDay, ...subQueryParams]
        ),

        // 5b. Títulos de resueltos (misma ventana que resolución: closed_at)
        pool.execute(
            `
            SELECT t.assigned_to_user_id AS agentId,
                   TRIM(t.title) AS title,
                   COUNT(*) AS count
            FROM tickets t
            LEFT JOIN users u_client ON t.user_id = u_client.id
            WHERE t.status IN ('resolved', 'closed')
              AND t.closed_at IS NOT NULL
              AND t.closed_at BETWEEN ? AND ?
              AND t.assigned_to_user_id IS NOT NULL
              ${ticketFiltersSql}
            GROUP BY t.assigned_to_user_id, TRIM(t.title)
        `,
            [startOfDay, endOfDay, ...subQueryParams]
        ),

        pool.execute(
            `
            SELECT c.name AS categoryName, c.id AS categoryId, COUNT(t.id) AS count
            ${baseFrom}
            ${fullWhereClause}
            GROUP BY c.id, c.name
            HAVING categoryName IS NOT NULL
            ORDER BY count DESC
            LIMIT 10
        `,
            params
        ),

        pool.execute(
            `
            SELECT
                u.id as clientId,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) as clientName,
                COUNT(t.id) as count
            ${baseFrom}
            ${fullWhereClause}
            AND u.role = 'client'
            GROUP BY t.user_id, u.first_name, u.last_name, u.username
            ORDER BY count DESC
            LIMIT 10
        `,
            params
        ),

        pool.execute(
            `
            SELECT HOUR(t.created_at) as hour, COUNT(t.id) as count
            ${baseFrom}
            ${fullWhereClause}
            GROUP BY HOUR(t.created_at)
            ORDER BY hour ASC
        `,
            params
        ),
    ]);

    const closedBreakdownByAgent = buildTitleBreakdownByAgent(closedTitlesByAgentResult[0] || []);
    const resolvedBreakdownByAgent = buildTitleBreakdownByAgent(resolvedTitlesByAgentResult[0] || []);

    const agentResolutionTimes = agentResolutionTimeResult[0].map((row) => {
        const avgTime = parseFloat(row.avgResolutionTimeHours);
        const formattedAvgTime = !isNaN(avgTime) ? parseFloat(avgTime.toFixed(2)) : null;
        const breakdown = resolvedBreakdownByAgent.get(row.agentId);
        return {
            agentName: row.agentName,
            resolvedTickets: Number(row.resolvedTickets) || 0,
            avgResolutionTimeHours: formattedAvgTime,
            agentId: row.agentId,
            titleBreakdown: breakdown
                ? {
                      items: breakdown.items,
                      othersCount: breakdown.othersCount,
                      label: breakdown.label,
                  }
                : null,
        };
    });

    const agentPerformance = agentPerformanceResult[0].map((row) => {
        const breakdown = closedBreakdownByAgent.get(row.agentId);
        return {
            agentName: row.agentName,
            assignedTickets: Number(row.assignedTickets) || 0,
            closedTickets: Number(row.closedTickets) || 0,
            agentId: row.agentId,
            titleBreakdown: breakdown
                ? {
                      items: breakdown.items,
                      othersCount: breakdown.othersCount,
                      label: breakdown.label,
                  }
                : null,
        };
    });

    res.status(200).json({
        success: true,
        data: {
            ticketsByStatus: ticketsByStatusResult[0] || [],
            ticketsByPriority: ticketsByPriorityResult[0] || [],
            ticketsByDepartment: ticketsByDepartmentResult[0] || [],
            agentPerformance,
            agentResolutionTimes,
            ticketsByCategory: ticketsByCategoryResult[0] || [],
            topClients: topClientsResult[0] || [],
            ticketsByHour: ticketsByHourResult[0] || [],
        },
    });
});

module.exports = {
    getReports,
};
