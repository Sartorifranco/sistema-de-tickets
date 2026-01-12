const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// @desc    Obtener lista de depositarios con filtros y métricas
const getDepositarios = asyncHandler(async (req, res) => {
    const { companyId, search } = req.query;
    
    let query = `
        SELECT 
            d.*, 
            c.name as company_name,
            (SELECT MAX(m.maintenance_date) FROM mantenimientos m WHERE m.depositario_id = d.id) as last_maintenance,
            (SELECT COUNT(*) FROM tickets t WHERE t.location_id = d.id AND t.status != 'closed') as open_tickets_count
        FROM depositarios d
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE d.is_active = 1
    `;
    
    const params = [];

    if (companyId) {
        query += ' AND d.company_id = ?';
        params.push(companyId);
    }

    if (search) {
        query += ' AND (d.alias LIKE ? OR d.serial_number LIKE ? OR d.address LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY d.alias ASC';

    const [depositarios] = await pool.execute(query, params);
    res.status(200).json({ success: true, data: depositarios });
});

// @desc    Datos para el MAPA INTELIGENTE
const getMapData = asyncHandler(async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id, d.alias, d.lat, d.lng, d.address,
                c.name as company_name,
                (SELECT MAX(m.maintenance_date) FROM mantenimientos m WHERE m.depositario_id = d.id) as last_maintenance_date,
                (SELECT COUNT(*) FROM tickets t WHERE t.location_id = d.id AND t.status != 'closed') as open_tickets_count
            FROM depositarios d
            LEFT JOIN companies c ON d.company_id = c.id
            WHERE d.is_active = 1 
            AND d.lat IS NOT NULL 
            AND d.lng IS NOT NULL
        `;

        const [rows] = await pool.execute(query);

        const mapData = rows.map(depo => {
            let status = 'green'; 
            let daysPassed = 0;
            const tickets = depo.open_tickets_count || 0;

            if (depo.last_maintenance_date) {
                const lastDate = new Date(depo.last_maintenance_date);
                const diffTime = Math.abs(new Date() - lastDate);
                daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            } else {
                daysPassed = 999; 
            }

            if (tickets > 0) status = 'red'; 
            else if (daysPassed >= 30) status = 'red'; 
            else if (daysPassed >= 15) status = 'yellow'; 
            else status = 'green'; 

            const urgencyScore = (tickets * 1000) + daysPassed;

            return { ...depo, daysPassed, open_tickets_count: tickets, mapStatus: status, urgencyScore };
        });

        mapData.sort((a, b) => {
            const priority = { red: 3, yellow: 2, green: 1 };
            return priority[b.mapStatus] - priority[a.mapStatus];
        });

        res.json({ success: true, data: mapData });
    } catch (error) {
        console.error(error);
        res.status(500);
        throw new Error('Error al generar datos del mapa');
    }
});

// @desc    Guardar Hoja de Ruta Generada
const saveRoute = asyncHandler(async (req, res) => {
    const { total_distance_km, total_time_minutes, stops } = req.body;
    const user_id = req.user ? req.user.id : null; 

    if (!stops) {
        res.status(400);
        throw new Error('No hay paradas para guardar');
    }

    const [result] = await pool.execute(
        `INSERT INTO route_sheets (user_id, total_distance_km, total_time_minutes, stops_json) VALUES (?, ?, ?, ?)`,
        [user_id, total_distance_km, total_time_minutes, JSON.stringify(stops)]
    );

    res.status(201).json({ success: true, routeId: result.insertId });
});

// @desc    Obtener Historial de Hojas de Ruta
const getRouteHistory = asyncHandler(async (req, res) => {
    const [routes] = await pool.execute(`
        SELECT r.*, u.username, u.first_name, u.last_name 
        FROM route_sheets r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 50
    `);
    res.status(200).json({ success: true, data: routes });
});

// @desc    Crear un nuevo depositario
const createDepositario = asyncHandler(async (req, res) => {
    const { alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, lat, lng, maintenance_freq } = req.body;

    if (!alias || !company_id) {
        res.status(400);
        throw new Error('El Alias y la Empresa son obligatorios.');
    }

    await pool.execute(
        `INSERT INTO depositarios (alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, lat, lng, maintenance_freq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, lat || null, lng || null, maintenance_freq || 30]
    );

    res.status(201).json({ success: true, message: 'Depositario creado exitosamente.' });
});

// @desc    Actualizar depositario
const updateDepositario = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, lat, lng, maintenance_freq } = req.body;

    await pool.execute(
        `UPDATE depositarios SET alias=?, company_id=?, serial_number=?, location_description=?, address=?, km_from_base=?, duration_trip=?, lat=?, lng=?, maintenance_freq=? WHERE id = ?`,
        [alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, lat || null, lng || null, maintenance_freq || 30, id]
    );

    res.status(200).json({ success: true, message: 'Depositario actualizado.' });
});

// @desc    Eliminar depositario
const deleteDepositario = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('UPDATE depositarios SET is_active = 0 WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Depositario eliminado.' });
});

// @desc    Registrar mantenimiento
const addMaintenance = asyncHandler(async (req, res) => {
    const { id } = req.params; 
    const { companion_name, tasks, observations, date } = req.body;
    const userId = req.user.id;

    await pool.execute(
        'INSERT INTO mantenimientos (depositario_id, user_id, companion_name, maintenance_date, tasks_log, observations) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, companion_name, date || new Date(), JSON.stringify(tasks || []), observations]
    );

    res.status(201).json({ success: true, message: 'Mantenimiento registrado exitosamente.' });
});

// @desc    Historial de mantenimientos
const getMaintenanceHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [history] = await pool.execute(`
        SELECT m.*, u.username, u.first_name, u.last_name
        FROM mantenimientos m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.depositario_id = ?
        ORDER BY m.maintenance_date DESC
    `, [id]);
    res.status(200).json({ success: true, data: history });
});

// @desc    Métricas Dashboard
const getDepositarioMetrics = asyncHandler(async (req, res) => {
    const [total] = await pool.execute('SELECT COUNT(*) as count FROM depositarios WHERE is_active = 1');
    const [maintainedThisMonth] = await pool.execute(`SELECT COUNT(*) as count FROM mantenimientos WHERE MONTH(maintenance_date) = MONTH(CURRENT_DATE()) AND YEAR(maintenance_date) = YEAR(CURRENT_DATE())`);
    const [critical] = await pool.execute(`
        SELECT d.id, d.alias, c.name as company_name, MAX(m.maintenance_date) as last_maint
        FROM depositarios d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN mantenimientos m ON d.id = m.depositario_id
        WHERE d.is_active = 1
        GROUP BY d.id
        HAVING last_maint IS NULL OR last_maint < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    res.status(200).json({
        success: true,
        data: {
            totalDepositarios: total[0].count,
            maintainedThisMonth: maintainedThisMonth[0].count,
            criticalCount: critical.length,
            criticalList: critical
        }
    });
});

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
    getRouteHistory // <--- NUEVA EXPORTACIÓN
};