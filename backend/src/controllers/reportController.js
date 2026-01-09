const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// @desc    Obtener todas las métricas para la página de reportes, filtrado
// @route   GET /api/reports
// @access  Private (Admin)
const getReports = asyncHandler(async (req, res) => {
    // Obtenemos TODOS los filtros del query string
    const { 
        startDate, 
        endDate, 
        agentId, 
        companyId, 
        departmentId, 
        categoryId, 
        clientId 
    } = req.query;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error("Las fechas de inicio y fin son requeridas.");
    }
    
    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    // --- Preparamos los filtros dinámicos ---
    
    // Filtros base de fechas
    const whereClauses = ['t.created_at BETWEEN ? AND ?'];
    const params = [startOfDay, endOfDay];

    // Filtros específicos para las consultas de agentes (users)
    const agentUserFilter = ['u.role IN (\'agent\', \'admin\')']; 
    const agentUserParams = [];

    // Añadir filtros dinámicamente si existen
    if (agentId) {
        whereClauses.push('t.assigned_to_user_id = ?');
        params.push(agentId);
        
        agentUserFilter.push('u.id = ?');
        agentUserParams.push(agentId);
    }
    if (companyId) {
        whereClauses.push('u.company_id = ?'); // 'u' aquí es el cliente del ticket
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

    // FROM base para las consultas generales (1, 2, 3, 6, 7, 8)
    const baseFrom = `
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN ticket_categories c ON t.category_id = c.id
    `;
    const fullWhereClause = `WHERE ${whereClauses.join(' AND ')}`;
    
    // Params para las subconsultas de agentes 
    // (quitamos las 2 primeras fechas porque las pondremos manual en la subquery)
    const subQueryParams = params.slice(2); 

    // --- Ejecución de Consultas en Paralelo ---
    
    const [
        ticketsByStatusResult,
        ticketsByPriorityResult,
        ticketsByDepartmentResult,
        agentPerformanceResult,
        agentResolutionTimeResult,
        ticketsByCategoryResult, // Nueva métrica
        topClientsResult,        // Nueva métrica
        ticketsByHourResult      // Nueva métrica
    ] = await Promise.all([
        // 1. Tickets por Estado
        pool.execute(
            `SELECT t.status, COUNT(t.id) AS count 
             ${baseFrom} 
             ${fullWhereClause} 
             GROUP BY t.status`, 
            params
        ),
        
        // 2. Tickets por Prioridad
        pool.execute(
            `SELECT t.priority, COUNT(t.id) AS count 
             ${baseFrom} 
             ${fullWhereClause} 
             GROUP BY t.priority`, 
            params
        ),

        // 3. Tickets por Departamento
        pool.execute(`
            SELECT d.name AS departmentName, d.id AS departmentId, COUNT(t.id) AS count
            ${baseFrom}
            ${fullWhereClause}
            GROUP BY d.id, d.name
            HAVING departmentName IS NOT NULL
        `, params),

        // 4. Rendimiento de Agente (con subconsulta filtrada)
        pool.execute(`
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
                  ${agentId ? 'AND t.assigned_to_user_id = ?' : ''}
                  ${companyId ? 'AND u_client.company_id = ?' : ''}
                  ${departmentId ? 'AND t.department_id = ?' : ''}
                  ${categoryId ? 'AND t.category_id = ?' : ''}
                  ${clientId ? 'AND t.user_id = ?' : ''}
            ) t_filtered ON u.id = t_filtered.assigned_to_user_id
            WHERE ${agentUserFilter.join(' AND ')}
            GROUP BY u.id, u.username, u.first_name, u.last_name
            ORDER BY assignedTickets DESC
        `, [startOfDay, endOfDay, ...subQueryParams, ...agentUserParams]),

        // 5. Tiempo de Resolución de Agente (con subconsulta filtrada)
        pool.execute(`
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
                  ${agentId ? 'AND t.assigned_to_user_id = ?' : ''}
                  ${companyId ? 'AND u_client.company_id = ?' : ''}
                  ${departmentId ? 'AND t.department_id = ?' : ''}
                  ${categoryId ? 'AND t.category_id = ?' : ''}
                  ${clientId ? 'AND t.user_id = ?' : ''}
            ) t_filtered ON u.id = t_filtered.assigned_to_user_id
            WHERE ${agentUserFilter.join(' AND ')}
            GROUP BY u.id, u.username, u.first_name, u.last_name
            ORDER BY resolvedTickets DESC;
        `, [startOfDay, endOfDay, ...subQueryParams, ...agentUserParams]),
        
        // 6. Tickets por Problemática (Categoría)
        pool.execute(`
            SELECT c.name AS categoryName, c.id AS categoryId, COUNT(t.id) AS count
            ${baseFrom}
            ${fullWhereClause}
            GROUP BY c.id, c.name
            HAVING categoryName IS NOT NULL
            ORDER BY count DESC
            LIMIT 10
        `, params),

        // 7. Top 10 Clientes
        pool.execute(`
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
        `, params),

        // 8. Tickets por Hora del Día
        pool.execute(`
            SELECT HOUR(t.created_at) as hour, COUNT(t.id) as count
            ${baseFrom}
            ${fullWhereClause}
            GROUP BY HOUR(t.created_at)
            ORDER BY hour ASC
        `, params)
    ]);

    // Procesamiento de los resultados
    const agentResolutionTimes = agentResolutionTimeResult[0].map(row => {
        const avgTime = parseFloat(row.avgResolutionTimeHours);
        const formattedAvgTime = !isNaN(avgTime) ? parseFloat(avgTime.toFixed(2)) : null;
        return {
            agentName: row.agentName,
            resolvedTickets: row.resolvedTickets || 0,
            avgResolutionTimeHours: formattedAvgTime,
            agentId: row.agentId 
        };
    });
    
    const agentPerformance = agentPerformanceResult[0].map(row => ({
        agentName: row.agentName,
        assignedTickets: row.assignedTickets || 0,
        closedTickets: row.closedTickets || 0,
        agentId: row.agentId 
    }));

    // Estructura final de respuesta
    const metrics = {
        ticketsByStatus: ticketsByStatusResult[0] || [],
        ticketsByPriority: ticketsByPriorityResult[0] || [],
        ticketsByDepartment: ticketsByDepartmentResult[0] || [],
        agentPerformance: agentPerformance,
        agentResolutionTimes: agentResolutionTimes,
        ticketsByCategory: ticketsByCategoryResult[0] || [],
        topClients: topClientsResult[0] || [],
        ticketsByHour: ticketsByHourResult[0] || [],
        // 'companyReport' lo quitamos para simplificar
    };
    
    res.status(200).json({ success: true, data: metrics });
});

module.exports = {
    getReports,
};