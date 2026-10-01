// En src/controllers/metricsController.js
const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// Función auxiliar para formatear segundos
const formatSeconds = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "N/A";

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    const dDisplay = d > 0 ? d + (d === 1 ? " día, " : " días, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hora, " : " horas, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minuto" : " minutos") : "";

    let result = (dDisplay + hDisplay + mDisplay).trim();
    if (result.endsWith(',')) {
        result = result.slice(0, -1);
    }
    return result || "Menos de un minuto";
};

/**
 * @desc    Obtener métricas de tiempo de resolución
 * @route   GET /api/metrics/resolution-time
 * @access  Private (Admin, Agent)
 */
const getResolutionTimeMetrics = asyncHandler(async (req, res) => {
    const query = `
        SELECT
            COUNT(*) as resolvedTicketsCount,
            AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(resolved_at, closed_at))) as averageResolutionTimeInSeconds
        FROM tickets
        WHERE status IN ('resolved', 'closed')
          AND COALESCE(resolved_at, closed_at) IS NOT NULL;
    `;
    const [rows] = await pool.execute(query);
    const metrics = rows[0];

    res.status(200).json({
        success: true,
        data: {
            resolvedTicketsCount: metrics.resolvedTicketsCount,
            averageResolutionTimeInSeconds: Math.round(metrics.averageResolutionTimeInSeconds),
            averageResolutionTimeFormatted: formatSeconds(metrics.averageResolutionTimeInSeconds)
        }
    });
});

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @desc    Rendimiento personal del agente logueado (o de ?agentId= si es admin)
 * @route   GET /api/metrics/agent
 * @access  Private (Admin, Agent)
 *
 * Nota: en esta base `resolved_at` nunca se carga; la fecha de cierre real es `closed_at`.
 */
const getAgentPerformance = asyncHandler(async (req, res) => {
    let agentId = req.user.id;
    if (req.user.role === 'admin' && req.query.agentId) {
        const requested = Number(req.query.agentId);
        if (Number.isFinite(requested) && requested > 0) agentId = requested;
    }

    // Titular o asignado adicional (misma regla que el dashboard y el listado del agente)
    const mine = `(t.assigned_to_user_id = ? OR EXISTS (SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.user_id = ?))`;
    const mp = [agentId, agentId];
    const closed = `t.status IN ('resolved', 'closed') AND t.closed_at IS NOT NULL`;
    const active = `t.status IN ('open', 'in-progress')`;
    const secs = `TIMESTAMPDIFF(SECOND, t.created_at, t.closed_at)`;

    const [
        [[agentRow]],
        [[totals]],
        [[window30]],
        [[prev30]],
        [[team30]],
        [[hours]],
        [[comments30]],
        [[oldest]],
        [monthlyMine],
        [monthlyTeam],
        [weekday],
        [byPriority],
        [byCategory],
        [recent],
        [ranking],
        [bestMonth],
    ] = await Promise.all([
        pool.execute(
            `SELECT id, CONVERT(username USING utf8mb4) AS username,
                    CONVERT(COALESCE(first_name, '') USING utf8mb4) AS first_name,
                    CONVERT(COALESCE(last_name, '') USING utf8mb4) AS last_name
               FROM users WHERE id = ?`,
            [agentId]
        ),
        pool.execute(
            `SELECT SUM(${closed}) AS resolved_total,
                    SUM(${active}) AS active_now,
                    SUM(${active} AND t.priority IN ('high','urgent')) AS active_urgent,
                    SUM(${closed} AND t.closed_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS closed_this_month,
                    AVG(CASE WHEN ${closed} THEN ${secs} END) AS avg_seconds_all
               FROM tickets t WHERE ${mine}`,
            mp
        ),
        pool.execute(
            `SELECT COUNT(*) AS resolved, AVG(${secs}) AS avg_seconds,
                    SUM(t.priority IN ('high','urgent')) AS urgent_resolved,
                    SUM(${secs} <= 86400) AS within_day
               FROM tickets t WHERE ${mine} AND ${closed} AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            mp
        ),
        pool.execute(
            `SELECT COUNT(*) AS resolved, AVG(${secs}) AS avg_seconds
               FROM tickets t WHERE ${mine} AND ${closed}
                AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND t.closed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            mp
        ),
        pool.execute(
            `SELECT COUNT(*) AS resolved, AVG(${secs}) AS avg_seconds,
                    COUNT(DISTINCT t.assigned_to_user_id) AS agents,
                    SUM(${secs} <= 86400) AS within_day
               FROM tickets t WHERE ${closed} AND t.assigned_to_user_id IS NOT NULL
                AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        ),
        pool.execute(
            `SELECT COALESCE(SUM(t.horas_reales), 0) AS hours_30d,
                    SUM(t.horas_reales IS NOT NULL AND t.horas_reales > 0) AS tickets_with_hours
               FROM tickets t WHERE ${mine} AND ${closed} AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            mp
        ),
        pool.execute(
            `SELECT COUNT(*) AS comments FROM comments c WHERE c.user_id = ? AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [agentId]
        ),
        pool.execute(
            `SELECT MAX(DATEDIFF(NOW(), t.created_at)) AS oldest_days FROM tickets t WHERE ${mine} AND ${active}`,
            mp
        ),
        pool.execute(
            `SELECT DATE_FORMAT(t.closed_at, '%Y-%m') AS month, COUNT(*) AS count
               FROM tickets t WHERE ${mine} AND ${closed}
                AND t.closed_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
              GROUP BY DATE_FORMAT(t.closed_at, '%Y-%m')`,
            mp
        ),
        pool.execute(
            `SELECT DATE_FORMAT(t.closed_at, '%Y-%m') AS month, COUNT(*) AS count,
                    COUNT(DISTINCT t.assigned_to_user_id) AS agents
               FROM tickets t WHERE ${closed} AND t.assigned_to_user_id IS NOT NULL
                AND t.closed_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
              GROUP BY DATE_FORMAT(t.closed_at, '%Y-%m')`
        ),
        pool.execute(
            `SELECT DAYOFWEEK(t.closed_at) AS dow, COUNT(*) AS count
               FROM tickets t WHERE ${mine} AND ${closed} AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
              GROUP BY DAYOFWEEK(t.closed_at)`,
            mp
        ),
        pool.execute(
            `SELECT t.priority, COUNT(*) AS count, AVG(${secs}) AS avg_seconds
               FROM tickets t WHERE ${mine} AND ${closed} AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
              GROUP BY t.priority`,
            mp
        ),
        pool.execute(
            `SELECT COALESCE(CONVERT(c.name USING utf8mb4), 'Sin categoría') AS name, COUNT(*) AS count
               FROM tickets t LEFT JOIN ticket_categories c ON c.id = t.category_id
              WHERE ${mine} AND ${closed} AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
              GROUP BY c.id, c.name ORDER BY count DESC LIMIT 6`,
            mp
        ),
        pool.execute(
            `SELECT t.id, CONVERT(t.title USING utf8mb4) AS title, t.priority, t.closed_at, ${secs} AS seconds,
                    CONVERT(COALESCE(NULLIF(TRIM(CONCAT(CONVERT(COALESCE(u.first_name, '') USING utf8mb4), ' ', CONVERT(COALESCE(u.last_name, '') USING utf8mb4))), ''), CONVERT(u.username USING utf8mb4)) USING utf8mb4) AS client_name,
                    CONVERT(co.name USING utf8mb4) AS company_name
               FROM tickets t
               LEFT JOIN users u ON u.id = t.user_id
               LEFT JOIN companies co ON co.id = u.company_id
              WHERE ${mine} AND ${closed}
              ORDER BY t.closed_at DESC LIMIT 8`,
            mp
        ),
        pool.execute(
            `SELECT t.assigned_to_user_id AS user_id, COUNT(*) AS resolved
               FROM tickets t WHERE ${closed} AND t.assigned_to_user_id IS NOT NULL
                AND t.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              GROUP BY t.assigned_to_user_id ORDER BY resolved DESC`
        ),
        pool.execute(
            `SELECT DATE_FORMAT(t.closed_at, '%Y-%m') AS month, COUNT(*) AS count
               FROM tickets t WHERE ${mine} AND ${closed}
              GROUP BY DATE_FORMAT(t.closed_at, '%Y-%m') ORDER BY count DESC, month DESC LIMIT 1`,
            mp
        ),
    ]);

    if (!agentRow) {
        res.status(404);
        throw new Error('Agente no encontrado.');
    }

    const num = (v) => Number(v) || 0;
    const fullName = `${agentRow.first_name} ${agentRow.last_name}`.trim() || agentRow.username;

    // Serie mensual: últimos 6 meses, con promedio por agente del equipo
    const mineMap = new Map(monthlyMine.map((r) => [r.month, num(r.count)]));
    const teamMap = new Map(monthlyTeam.map((r) => [r.month, { count: num(r.count), agents: num(r.agents) }]));
    const monthly = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = monthKey(d);
        const team = teamMap.get(key);
        monthly.push({
            month: key,
            label: MONTHS_ES[d.getMonth()],
            mine: mineMap.get(key) || 0,
            teamAvg: team && team.agents > 0 ? Math.round((team.count / team.agents) * 10) / 10 : 0,
        });
    }

    // Días de la semana (DAYOFWEEK: 1=domingo ... 7=sábado) → lunes a domingo
    const dowLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dowMap = new Map(weekday.map((r) => [num(r.dow), num(r.count)]));
    const weekdayOrder = [2, 3, 4, 5, 6, 7, 1];
    const byWeekday = weekdayOrder.map((dow) => ({ day: dowLabels[dow - 1], count: dowMap.get(dow) || 0 }));

    const priorities = ['urgent', 'high', 'medium', 'low'];
    const prioMap = new Map(byPriority.map((r) => [r.priority, r]));
    const priorityStats = priorities.map((p) => {
        const row = prioMap.get(p);
        const avg = row && row.avg_seconds != null ? Math.round(Number(row.avg_seconds)) : null;
        return { priority: p, count: row ? num(row.count) : 0, avgSeconds: avg, avgFormatted: avg != null ? formatSeconds(avg) : null };
    });

    const position = ranking.findIndex((r) => Number(r.user_id) === Number(agentId));
    const rank = position >= 0 ? { position: position + 1, total: ranking.length } : { position: null, total: ranking.length };

    const resolved30 = num(window30.resolved);
    const resolvedPrev = num(prev30.resolved);
    const avg30 = window30.avg_seconds != null ? Math.round(Number(window30.avg_seconds)) : null;
    const avgPrev = prev30.avg_seconds != null ? Math.round(Number(prev30.avg_seconds)) : null;
    const teamAvg30 = team30.avg_seconds != null ? Math.round(Number(team30.avg_seconds)) : null;
    const teamPerAgent30 = num(team30.agents) > 0 ? Math.round((num(team30.resolved) / num(team30.agents)) * 10) / 10 : 0;

    const best = bestMonth[0]
        ? { month: bestMonth[0].month, label: MONTHS_ES[Number(String(bestMonth[0].month).slice(5, 7)) - 1], year: String(bestMonth[0].month).slice(0, 4), count: num(bestMonth[0].count) }
        : null;

    res.status(200).json({
        success: true,
        data: {
            agent: { id: agentRow.id, name: fullName, username: agentRow.username },
            summary: {
                resolvedTotal: num(totals.resolved_total),
                activeNow: num(totals.active_now),
                activeUrgent: num(totals.active_urgent),
                closedThisMonth: num(totals.closed_this_month),
                oldestActiveDays: oldest.oldest_days != null ? num(oldest.oldest_days) : null,
                avgSecondsAll: totals.avg_seconds_all != null ? Math.round(Number(totals.avg_seconds_all)) : null,
                avgFormattedAll: formatSeconds(totals.avg_seconds_all),
                resolved30d: resolved30,
                resolvedPrev30d: resolvedPrev,
                avgSeconds30d: avg30,
                avgFormatted30d: avg30 != null ? formatSeconds(avg30) : null,
                avgSecondsPrev30d: avgPrev,
                urgentResolved30d: num(window30.urgent_resolved),
                withinDayRate30d: resolved30 > 0 ? Math.round((num(window30.within_day) / resolved30) * 100) : null,
                hoursLogged30d: Math.round(Number(hours.hours_30d) * 10) / 10,
                ticketsWithHours30d: num(hours.tickets_with_hours),
                comments30d: num(comments30.comments),
                bestMonth: best,
            },
            team: {
                resolved30d: num(team30.resolved),
                agents30d: num(team30.agents),
                perAgent30d: teamPerAgent30,
                avgSeconds30d: teamAvg30,
                avgFormatted30d: teamAvg30 != null ? formatSeconds(teamAvg30) : null,
                withinDayRate30d: num(team30.resolved) > 0 ? Math.round((num(team30.within_day) / num(team30.resolved)) * 100) : null,
                rank,
            },
            monthly,
            byWeekday,
            byPriority: priorityStats,
            byCategory: byCategory.map((r) => ({ name: r.name, count: num(r.count) })),
            recent: recent.map((r) => ({
                id: r.id,
                title: r.title,
                priority: r.priority,
                closed_at: r.closed_at,
                seconds: num(r.seconds),
                durationFormatted: formatSeconds(num(r.seconds)),
                client_name: r.client_name,
                company_name: r.company_name,
            })),
        },
    });
});

module.exports = { getResolutionTimeMetrics, getAgentPerformance };