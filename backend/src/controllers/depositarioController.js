const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// @desc    Obtener lista de depositarios con filtros
const getDepositarios = asyncHandler(async (req, res) => {
    const { companyId, search } = req.query;
    
    let query = `
        SELECT d.*, c.name as company_name,
        (SELECT MAX(m.maintenance_date) FROM mantenimientos m WHERE m.depositario_id = d.id) as last_maintenance
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

// @desc    Crear un nuevo depositario
const createDepositario = asyncHandler(async (req, res) => {
    const { alias, company_id, serial_number, location_description, address, km_from_base, duration_trip } = req.body;

    if (!alias || !company_id) {
        res.status(400);
        throw new Error('El Alias y la Empresa son obligatorios.');
    }

    await pool.execute(
        'INSERT INTO depositarios (alias, company_id, serial_number, location_description, address, km_from_base, duration_trip) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [alias, company_id, serial_number, location_description, address, km_from_base, duration_trip]
    );

    res.status(201).json({ success: true, message: 'Depositario creado exitosamente.' });
});

// @desc    Actualizar depositario
const updateDepositario = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { alias, company_id, serial_number, location_description, address, km_from_base, duration_trip } = req.body;

    await pool.execute(
        `UPDATE depositarios SET 
        alias=?, company_id=?, serial_number=?, location_description=?, address=?, km_from_base=?, duration_trip=?
        WHERE id = ?`,
        [alias, company_id, serial_number, location_description, address, km_from_base, duration_trip, id]
    );

    res.status(200).json({ success: true, message: 'Depositario actualizado.' });
});

// @desc    Eliminar (Soft Delete) depositario
const deleteDepositario = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('UPDATE depositarios SET is_active = 0 WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Depositario eliminado.' });
});

// @desc    Registrar un mantenimiento
const addMaintenance = asyncHandler(async (req, res) => {
    const { id } = req.params; 
    const { companion_name, tasks, observations, date } = req.body;
    const userId = req.user.id;

    const tasksJson = JSON.stringify(tasks || []);
    const maintenanceDate = date || new Date();

    await pool.execute(
        'INSERT INTO mantenimientos (depositario_id, user_id, companion_name, maintenance_date, tasks_log, observations) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, companion_name, maintenanceDate, tasksJson, observations]
    );

    res.status(201).json({ success: true, message: 'Mantenimiento registrado exitosamente.' });
});

// @desc    Obtener historial de mantenimientos de un equipo
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

// @desc    Métricas AVANZADAS para el dashboard
const getDepositarioMetrics = asyncHandler(async (req, res) => {
    // 1. Total Equipos
    const [total] = await pool.execute('SELECT COUNT(*) as count FROM depositarios WHERE is_active = 1');
    
    // 2. Mantenimientos este mes
    const [maintainedThisMonth] = await pool.execute(`
        SELECT COUNT(*) as count 
        FROM mantenimientos 
        WHERE MONTH(maintenance_date) = MONTH(CURRENT_DATE()) 
        AND YEAR(maintenance_date) = YEAR(CURRENT_DATE())
    `);

    // 3. Equipos "Críticos" (Sin mantenimiento hace +30 días o nunca)
    // Buscamos equipos cuya última fecha sea NULL o mayor a 30 días
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
            criticalList: critical // Enviamos la lista para mostrarla en el modal
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
    getDepositarioMetrics
};