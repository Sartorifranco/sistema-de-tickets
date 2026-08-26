const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const { sendRouteReportEmail } = require('../config/mailer');
const {
    MAINTENANCE_COMPANION_ROLES,
    resolveAssignableUserIds,
    syncTicketAssignees,
} = require('../utils/ticketAssignees');

const MAINTENANCE_TICKET_CATEGORY = 'Problemas de depositarios (General)';

function formatPersonName(user) {
    if (!user) return '';
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    return user.username || `Usuario #${user.id}`;
}

function buildMaintenanceTicketDescription({
    companyName,
    alias,
    serial,
    address,
    technicianName,
    companionName,
    performedBy,
    date,
    billCounter,
    delta,
    tasks,
    observations,
}) {
    const taskLines = (Array.isArray(tasks) ? tasks : [])
        .map((t) => {
            const mark = t.done ? '[x]' : '[ ]';
            const comment = t.comment ? ` — ${t.comment}` : '';
            return `- ${mark} ${t.name}${comment}`;
        })
        .join('\n');

    const performedLabel = performedBy === 'permaquim' ? 'Permaquim' : 'Bacar';
    const lines = [
        `Registro automático de mantenimiento de depositario.`,
        ``,
        `Empresa: ${companyName || 'N/D'}`,
        `Depositario: ${alias || 'N/D'}`,
        serial ? `Serie: ${serial}` : null,
        address ? `Dirección: ${address}` : null,
        `Fecha: ${date || new Date().toISOString()}`,
        `Realizado por: ${performedLabel}`,
        `Técnico responsable: ${technicianName}`,
        companionName ? `Acompañante: ${companionName}` : `Acompañante: (ninguno)`,
        billCounter ? `Contador cabezal: ${billCounter}` : null,
        delta > 0 ? `Delta vs. último: +${delta}` : null,
        ``,
        `Checklist:`,
        taskLines || '- (sin tareas)',
        ``,
        `Observaciones:`,
        observations && String(observations).trim() ? String(observations).trim() : '(sin observaciones)',
    ].filter((l) => l !== null);

    return lines.join('\n');
}

// @desc    Obtener lista de depositarios
const getDepositarios = asyncHandler(async (req, res) => {
    const { companyId, search } = req.query;
    
    let query = `
        SELECT 
            d.*, 
            c.name as company_name,
            (SELECT MAX(m.maintenance_date) FROM mantenimientos m WHERE m.depositario_id = d.id) as last_maintenance,
            (SELECT COUNT(*) FROM tickets t 
             WHERE t.depositario_id = d.id 
             AND t.status != 'closed'
            ) as open_tickets_count
        FROM depositarios d
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE d.is_active = 1
    `;
    
    const params = [];
    if (companyId) { query += ' AND d.company_id = ?'; params.push(companyId); }
    if (search) {
        query += ' AND (d.alias LIKE ? OR d.serial_number LIKE ? OR d.address LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    query += ' ORDER BY d.alias ASC';

    const [depositarios] = await pool.execute(query, params);
    res.status(200).json({ success: true, data: depositarios });
});

// @desc    Datos para el MAPA
const getMapData = asyncHandler(async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id, d.alias, d.lat, d.lng, d.address, c.name as company_name,
                (SELECT MAX(m.maintenance_date) FROM mantenimientos m WHERE m.depositario_id = d.id) as last_maintenance_date,
                (SELECT COUNT(*) FROM tickets t 
                 WHERE t.depositario_id = d.id 
                 AND t.status != 'closed' 
                ) as open_tickets_count
            FROM depositarios d
            LEFT JOIN companies c ON d.company_id = c.id
            WHERE d.is_active = 1 AND d.lat IS NOT NULL AND d.lng IS NOT NULL
        `;

        const [rows] = await pool.execute(query);
        const mapData = rows.map(depo => {
            let status = 'green'; 
            let daysPassed = 999;
            const tickets = depo.open_tickets_count || 0;
            if (depo.last_maintenance_date) {
                daysPassed = Math.ceil(Math.abs(new Date() - new Date(depo.last_maintenance_date)) / (1000 * 60 * 60 * 24));
            }
            if (tickets > 0) status = 'red'; 
            else if (daysPassed >= 30) status = 'red'; 
            else if (daysPassed >= 20) status = 'yellow'; 
            const urgencyScore = (tickets * 1000) + daysPassed;
            return { ...depo, daysPassed, open_tickets_count: tickets, mapStatus: status, urgencyScore };
        });
        mapData.sort((a, b) => 3 - ['green','yellow','red'].indexOf(a.mapStatus) - (3 - ['green','yellow','red'].indexOf(b.mapStatus)));
        res.json({ success: true, data: mapData });
    } catch (error) { res.status(500); throw new Error('Error mapa'); }
});

// @desc    Reportes Avanzados
const getDepositaryReports = asyncHandler(async (req, res) => {
    const { companyId } = req.query;

    let query = `
        SELECT 
            d.alias, d.serial_number, d.id, c.name as company_name,
            (SELECT bill_counter FROM mantenimientos m WHERE m.depositario_id = d.id ORDER BY m.maintenance_date DESC LIMIT 1) as current_counter,
            (SELECT SUM(usage_delta) FROM mantenimientos m WHERE m.depositario_id = d.id AND m.maintenance_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as monthly_usage,
            (SELECT COUNT(*) FROM tickets t WHERE t.depositario_id = d.id) as total_errors,
            (SELECT COUNT(*) FROM tickets t WHERE t.depositario_id = d.id AND t.status != 'closed') as active_errors,
            (SELECT title FROM tickets t WHERE t.depositario_id = d.id ORDER BY t.created_at DESC LIMIT 1) as recent_error_types
        FROM depositarios d
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE d.is_active = 1
    `;

    const params = [];
    if (companyId) { query += ' AND d.company_id = ?'; params.push(companyId); }
    query += ' ORDER BY active_errors DESC, total_errors DESC';

    try {
        const [reportData] = await pool.execute(query, params);
        res.status(200).json({ success: true, data: reportData });
    } catch (error) { res.status(500).json({ message: 'Error reporte.' }); }
});

// @desc    ANÁLISIS IA (Drill-Down)
const getDepositaryAnalysis = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [dep] = await pool.execute('SELECT * FROM depositarios WHERE id = ?', [id]);
    if (dep.length === 0) { res.status(404); throw new Error("No encontrado"); }
    const depositario = dep[0];

    const [tickets] = await pool.execute(`
        SELECT t.id, t.title, t.description, t.created_at, t.status, u.username as created_by
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.depositario_id = ? 
        ORDER BY t.created_at DESC
        LIMIT 50
    `, [id]);

    let aiSummary = "Esperando nuevos datos reportados para generar diagnóstico.";
    let riskLevel = "Bajo";
    let dominantIssue = null;

    if (tickets.length > 0) {
        const categories = {
            'Mecanismo Billetes': { count: 0, keys: ['atasco', 'traba', 'billete', 'papel', 'rechazo', 'lata'] },
            'Almacenamiento': { count: 0, keys: ['storage', 'abnormal', 'a601', 'a605', 'llena', 'capacidad'] },
            'Conectividad': { count: 0, keys: ['internet', 'red', 'offline', 'comunicacion', 'enlace', 'ip'] },
            'Hardware': { count: 0, keys: ['roto', 'pieza', 'sensor', 'cabezal', 'ruido', 'pitido', 'pantalla', 'fisico'] },
            'Software/Gestión': { count: 0, keys: ['cerro', 'cerró', 'programa', 'error', 'loguearse', 'alta', 'usuario'] }
        };

        tickets.forEach(t => {
            const text = (t.title + ' ' + (t.description || '')).toLowerCase();
            for (const cat in categories) {
                if (categories[cat].keys.some(k => text.includes(k))) {
                    categories[cat].count++;
                }
            }
        });

        let maxCount = 0;
        for (const cat in categories) {
            if (categories[cat].count > maxCount) {
                maxCount = categories[cat].count;
                dominantIssue = cat;
            }
        }

        if (maxCount >= 1) {
            const percentage = Math.round((maxCount / tickets.length) * 100);
            if (dominantIssue === 'Mecanismo Billetes') aiSummary = `⚠️ **Fallas Mecánicas**: El ${percentage}% de los incidentes son por billetes/atascos.`;
            else if (dominantIssue === 'Almacenamiento') aiSummary = `⚠️ **Error Almacenamiento**: Códigos A601/A605 o problemas con la lata.`;
            else if (dominantIssue === 'Conectividad') aiSummary = `📡 **Red Inestable**: El equipo pierde conexión (${maxCount} veces).`;
            else if (dominantIssue === 'Hardware') aiSummary = `🔧 **Fallas Físicas**: Reportes de componentes, ruidos o periféricos.`;
            else if (dominantIssue === 'Software/Gestión') aiSummary = `💻 **Software**: Cierres de programa o errores de sistema.`;
            
            if (maxCount > 3) riskLevel = "Crítico";
            else if (maxCount > 1) riskLevel = "Medio";
        }
    }

    res.json({
        success: true,
        data: {
            depositario: depositario,
            tickets: tickets,
            analysis: { summary: aiSummary, risk_level: riskLevel, total_analyzed: tickets.length, dominant_issue: dominantIssue }
        }
    });
});

// =====================================================================
// 🔥 FUNCIÓN DEFINITIVA: FINALIZAR RUTA
// =====================================================================
const finalizeRoute = asyncHandler(async (req, res) => {
    const { routeId, stopsData, total_km, total_minutes } = req.body;
    
    // Nombre del técnico
    const technicianName = req.user.first_name 
        ? `${req.user.first_name} ${req.user.last_name}` 
        : req.user.username;

    console.log(`🏁 Generando reporte para: ${technicianName}`);

    // --- ENRIQUECIMIENTO INTELIGENTE ---
    const enrichedStops = await Promise.all(stopsData.map(async (stop) => {
        // Inicializar
        stop.tasks_done = []; 
        stop.bill_counter = '-';
        stop.observations = '-';

        if (!stop.id) return stop;

        try {
            // 1. BUSCAMOS EL ÚLTIMO MANTENIMIENTO EN BD (Detective)
            // Trae el último registro de las últimas 24hs
            const [rows] = await pool.execute(`
                SELECT tasks_log, bill_counter, observations 
                FROM mantenimientos 
                WHERE depositario_id = ? 
                AND created_at > (NOW() - INTERVAL 24 HOUR)
                ORDER BY id DESC 
                LIMIT 1
            `, [stop.id]);

            if (rows.length > 0) {
                const dbRecord = rows[0];
                console.log(`   ✅ Datos encontrados en BD para ${stop.alias}`);

                // 2. AUTO-CORRECCIÓN DE ESTADO
                stop.status = 'Hecho'; 

                // 3. INYECTAMOS LOS DATOS DE LA BD
                if (dbRecord.bill_counter) stop.bill_counter = dbRecord.bill_counter;
                if (dbRecord.observations) stop.observations = dbRecord.observations;

                // 4. PARSEO DE TAREAS (Soporta Textos y Objetos)
                if (dbRecord.tasks_log) {
                    let rawTasks = dbRecord.tasks_log;
                    
                    if (typeof rawTasks === 'string') {
                        try { rawTasks = JSON.parse(rawTasks); } catch (e) {}
                    }

                    if (Array.isArray(rawTasks)) {
                        stop.tasks_done = rawTasks.map(t => {
                            if (typeof t === 'string') return t;
                            if (typeof t === 'object') {
                                if (t.done === true) return t.name || t.label; 
                                if (!t.hasOwnProperty('done')) return t.name || t.label; 
                            }
                            return null;
                        }).filter(t => t !== null);
                    }
                }
            } else {
                console.log(`   ⚠️ Sin mantenimiento reciente en BD para ${stop.alias}.`);
            }
        } catch (err) {
            console.error(`Error recuperando datos para equipo ${stop.id}:`, err);
        }
        
        return stop;
    }));

    // 5. GUARDAMOS EL JSON ENRIQUECIDO EN LA TABLA DE HISTORIAL
    if (routeId) {
        try {
            await pool.execute(
                `UPDATE route_sheets 
                 SET stops_json = ?, 
                     total_distance_km = ?, 
                     total_time_minutes = ?,
                     status = 'completed',
                     closed_at = NOW()
                 WHERE id = ?`,
                [JSON.stringify(enrichedStops), total_km || 0, total_minutes || 0, routeId]
            );
            console.log("✅ Historial guardado correctamente.");
        } catch (dbErr) {
            console.error("❌ Error guardando historial:", dbErr);
        }
    }

    // 6. ENVIAR EMAIL
    const reportData = {
        total_km: total_km || 0,
        total_minutes: total_minutes || 0,
        stops: enrichedStops
    };

    try {
        await sendRouteReportEmail(reportData, technicianName);
    } catch (error) {
        console.error("❌ Error enviando email:", error);
    }

    res.status(200).json({ success: true, message: 'Reporte enviado con datos de BD.' });
});

// --- FUNCIONES CRUD STANDARD ---
const saveRoute = asyncHandler(async (req, res) => {
    const { total_distance_km, total_time_minutes, stops } = req.body;
    const user_id = req.user ? req.user.id : null; 
    if (!stops) { res.status(400); throw new Error('No hay paradas'); }
    const [result] = await pool.execute(`INSERT INTO route_sheets (user_id, total_distance_km, total_time_minutes, stops_json) VALUES (?, ?, ?, ?)`, [user_id, total_distance_km, total_time_minutes, JSON.stringify(stops)]);
    res.status(201).json({ success: true, routeId: result.insertId });
});

const getRouteHistory = asyncHandler(async (req, res) => {
    const [routes] = await pool.execute(`SELECT r.*, u.username FROM route_sheets r LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 50`);
    res.status(200).json({ success: true, data: routes });
});

const createDepositario = asyncHandler(async (req, res) => {
    const { alias, company_id, ...rest } = req.body;
    if (!alias || !company_id) { res.status(400); throw new Error('Datos incompletos'); }
    await pool.execute(`INSERT INTO depositarios (alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, lat, lng, maintenance_freq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [alias, company_id, rest.serial_number, rest.location_description, rest.address, rest.km_from_base, rest.duration_trip, rest.lat, rest.lng, rest.maintenance_freq || 30]);
    res.status(201).json({ success: true, message: 'Creado.' });
});

const updateDepositario = asyncHandler(async (req, res) => {
    const { id } = req.params; const body = req.body;
    await pool.execute(`UPDATE depositarios SET alias=?, company_id=?, serial_number=?, location_description=?, address=?, km_from_base=?, duration_trip=?, lat=?, lng=?, maintenance_freq=? WHERE id = ?`, [body.alias, body.company_id, body.serial_number, body.location_description, body.address, body.km_from_base, body.duration_trip, body.lat, body.lng, body.maintenance_freq, id]);
    res.status(200).json({ success: true, message: 'Actualizado.' });
});

const deleteDepositario = asyncHandler(async (req, res) => {
    await pool.execute('UPDATE depositarios SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true, message: 'Eliminado.' });
});

const addMaintenance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        companion_name,
        companion_user_id,
        tasks,
        observations,
        date,
        bill_counter,
        performed_by,
    } = req.body;

    if (!performed_by || !['permaquim', 'bacar'].includes(performed_by)) {
        res.status(400);
        throw new Error('Debe indicar si el mantenimiento fue realizado por Permaquim o Bacar');
    }

    const [depRows] = await pool.execute(
        `SELECT d.*, c.name AS company_name
         FROM depositarios d
         LEFT JOIN companies c ON c.id = d.company_id
         WHERE d.id = ? AND d.is_active = 1`,
        [id]
    );
    if (depRows.length === 0) {
        res.status(404);
        throw new Error('Depositario no encontrado');
    }
    const depositario = depRows[0];

    let companionUserId = null;
    let companionDisplayName = companion_name ? String(companion_name).trim() : '';
    if (companion_user_id !== undefined && companion_user_id !== null && companion_user_id !== '') {
        const cid = parseInt(companion_user_id, 10);
        if (Number.isNaN(cid)) {
            res.status(400);
            throw new Error('Acompañante inválido');
        }
        if (cid === req.user.id) {
            res.status(400);
            throw new Error('El acompañante no puede ser el mismo técnico responsable');
        }
        const validated = await resolveAssignableUserIds([cid], MAINTENANCE_COMPANION_ROLES);
        if (validated.length === 0) {
            res.status(400);
            throw new Error('El acompañante debe ser un agente o administrador del sistema');
        }
        companionUserId = validated[0];
        const [[companionUser]] = await pool.execute(
            'SELECT id, username, first_name, last_name FROM users WHERE id = ?',
            [companionUserId]
        );
        companionDisplayName = formatPersonName(companionUser);
    }

    const current = parseInt(bill_counter, 10) || 0;
    let delta = 0;
    const [last] = await pool.execute(
        'SELECT bill_counter FROM mantenimientos WHERE depositario_id = ? ORDER BY maintenance_date DESC LIMIT 1',
        [id]
    );
    if (last.length > 0 && current > 0) {
        const prev = last[0].bill_counter || 0;
        delta = current >= prev ? current - prev : current;
    }

    const maintenanceDate = date || new Date();
    const tasksLog = Array.isArray(tasks) ? tasks : [];

    const [maintResult] = await pool.execute(
        `INSERT INTO mantenimientos
            (depositario_id, user_id, companion_name, companion_user_id, performed_by, maintenance_date, tasks_log, observations, bill_counter, usage_delta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            req.user.id,
            companionDisplayName || null,
            companionUserId,
            performed_by,
            maintenanceDate,
            JSON.stringify(tasksLog),
            observations || null,
            current,
            delta,
        ]
    );

    // Ticket automático cerrado con el mismo registro de trabajo
    let autoTicketId = null;
    try {
        const [catRows] = await pool.execute(
            `SELECT id FROM ticket_categories
             WHERE TRIM(name) = ?
             ORDER BY id ASC
             LIMIT 1`,
            [MAINTENANCE_TICKET_CATEGORY]
        );
        let categoryId = catRows[0]?.id;
        if (!categoryId) {
            const [insCat] = await pool.execute(
                'INSERT INTO ticket_categories (name, company_id) VALUES (?, NULL)',
                [MAINTENANCE_TICKET_CATEGORY]
            );
            categoryId = insCat.insertId;
        }

        const [depDept] = await pool.execute(
            `SELECT id FROM departments
             WHERE UPPER(TRIM(name)) LIKE '%MANTENIMIENTO%'
             ORDER BY id ASC
             LIMIT 1`
        );
        let departmentId = depDept[0]?.id;
        if (!departmentId) {
            const [anyDept] = await pool.execute('SELECT id FROM departments ORDER BY id ASC LIMIT 1');
            departmentId = anyDept[0]?.id;
        }
        if (!departmentId) {
            throw new Error('No hay departamentos configurados para crear el ticket automático');
        }

        const technicianName = formatPersonName(req.user);
        const companyName = depositario.company_name || 'Empresa N/D';
        const title = `Mantenimiento ${depositario.alias} — ${companyName}`;
        const description = buildMaintenanceTicketDescription({
            companyName,
            alias: depositario.alias,
            serial: depositario.serial_number,
            address: depositario.address || depositario.location_description,
            technicianName,
            companionName: companionDisplayName,
            performedBy: performed_by,
            date: maintenanceDate,
            billCounter: current || null,
            delta,
            tasks: tasksLog,
            observations,
        });

        const [ticketResult] = await pool.execute(
            `INSERT INTO tickets (
                user_id, title, description, priority, category_id, department_id, status,
                depositario_id, assigned_to_user_id, closed_at
            ) VALUES (?, ?, ?, 'medium', ?, ?, 'closed', ?, ?, NOW())`,
            [req.user.id, title, description, categoryId, departmentId, id, req.user.id]
        );
        autoTicketId = ticketResult.insertId;

        const assigneeIds = [req.user.id];
        if (companionUserId) assigneeIds.push(companionUserId);
        await syncTicketAssignees(autoTicketId, assigneeIds);
    } catch (err) {
        console.error('No se pudo crear el ticket automático de mantenimiento:', err.message);
    }

    res.status(201).json({
        success: true,
        message: autoTicketId
            ? `Registrado. Ticket #${autoTicketId} creado y cerrado.`
            : 'Registrado.',
        deltaInfo: delta > 0 ? `+${delta}` : '',
        maintenanceId: maintResult.insertId,
        ticketId: autoTicketId,
    });
});

const getMaintenanceHistory = asyncHandler(async (req, res) => {
    const [history] = await pool.execute(
        `SELECT m.*,
                u.username, u.first_name, u.last_name,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))), ''),
                    cu.username,
                    m.companion_name
                ) AS companion_name,
                m.companion_user_id
         FROM mantenimientos m
         LEFT JOIN users u ON m.user_id = u.id
         LEFT JOIN users cu ON m.companion_user_id = cu.id
         WHERE m.depositario_id = ?
         ORDER BY m.maintenance_date DESC`,
        [req.params.id]
    );
    res.status(200).json({ success: true, data: history });
});

const getDepositarioMetrics = asyncHandler(async (req, res) => {
    const [t] = await pool.execute('SELECT COUNT(*) as c FROM depositarios WHERE is_active = 1');
    const [m] = await pool.execute(`SELECT COUNT(*) as c FROM mantenimientos WHERE MONTH(maintenance_date) = MONTH(NOW()) AND YEAR(maintenance_date) = YEAR(NOW())`);
    const [crit] = await pool.execute(`SELECT d.id, d.alias, c.name as company_name, MAX(m.maintenance_date) as last_maint FROM depositarios d LEFT JOIN companies c ON d.company_id = c.id LEFT JOIN mantenimientos m ON d.id = m.depositario_id WHERE d.is_active = 1 GROUP BY d.id HAVING last_maint IS NULL OR last_maint < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
    res.status(200).json({ success: true, data: { totalDepositarios: t[0].c, maintainedThisMonth: m[0].c, criticalCount: crit.length, criticalList: crit } });
});

// =====================================================================
// EXPORTACIÓN UNIFICADA (AL FINAL DEL ARCHIVO)
// =====================================================================
module.exports = { 
    getDepositarios, 
    createDepositario, 
    updateDepositario, 
    deleteDepositario, 
    addMaintenance, 
    getMaintenanceHistory, 
    getDepositarioMetrics, 
    getMapData, 
    saveRoute, 
    getRouteHistory, 
    getDepositaryReports, 
    getDepositaryAnalysis,
    finalizeRoute 
};