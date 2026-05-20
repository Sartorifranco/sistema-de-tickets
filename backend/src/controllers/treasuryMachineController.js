const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

const MACHINE_TYPES = ['Contadora', 'Clasificadora', 'Ensachetadora', 'Selladora', 'Otra'];
const MACHINE_STATUSES = ['operativa', 'reparacion', 'baja'];
const MAINTENANCE_TYPES = ['preventivo', 'correctivo'];

function normalizeStatus(value) {
    const s = String(value || '').trim().toLowerCase();
    if (MACHINE_STATUSES.includes(s)) return s;
    return null;
}

function normalizeMaintenanceType(value) {
    const t = String(value || '').trim().toLowerCase();
    if (MAINTENANCE_TYPES.includes(t)) return t;
    return null;
}

async function fetchDashboardStats() {
    const [statusRows] = await pool.execute(
        `SELECT status, COUNT(*) AS count FROM treasury_machines GROUP BY status`
    );
    const [typeRows] = await pool.execute(
        `SELECT type, COUNT(*) AS count FROM treasury_machines GROUP BY type ORDER BY count DESC, type ASC`
    );

    const stats = { operativa: 0, reparacion: 0, baja: 0, byType: typeRows };
    for (const row of statusRows) {
        if (row.status in stats) stats[row.status] = row.count;
    }
    return stats;
}

// @route GET /api/treasury-machines
const listTreasuryMachines = asyncHandler(async (req, res) => {
    const [machines] = await pool.execute(
        `SELECT id, type, brand, model, serial_number, location, counted_bills, status, created_at, updated_at
         FROM treasury_machines
         ORDER BY type ASC, serial_number ASC`
    );
    const stats = await fetchDashboardStats();
    res.status(200).json({ success: true, data: machines, stats });
});

// @route GET /api/treasury-machines/:id
const getTreasuryMachineById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const [[machine]] = await pool.execute(
        `SELECT id, type, brand, model, serial_number, location, counted_bills, status, created_at, updated_at
         FROM treasury_machines WHERE id = ?`,
        [id]
    );
    if (!machine) {
        res.status(404);
        throw new Error('Máquina no encontrada.');
    }
    res.status(200).json({ success: true, data: machine });
});

// @route POST /api/treasury-machines
const createTreasuryMachine = asyncHandler(async (req, res) => {
    const {
        type,
        brand = 'Glory',
        model,
        serial_number,
        location,
        counted_bills,
        status = 'operativa',
    } = req.body;

    if (!type || !model || !serial_number || !location) {
        res.status(400);
        throw new Error('Tipo, modelo, número de serie y ubicación son obligatorios.');
    }
    if (!MACHINE_TYPES.includes(type)) {
        res.status(400);
        throw new Error('Tipo de máquina inválido.');
    }
    const finalStatus = normalizeStatus(status) || 'operativa';

    let countedBillsVal = null;
    if (counted_bills !== undefined && counted_bills !== null && counted_bills !== '') {
        const n = parseInt(String(counted_bills), 10);
        if (!Number.isNaN(n) && n >= 0) countedBillsVal = n;
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO treasury_machines (type, brand, model, serial_number, location, counted_bills, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                type,
                String(brand || 'Glory').trim() || 'Glory',
                String(model).trim(),
                String(serial_number).trim(),
                String(location).trim(),
                countedBillsVal,
                finalStatus,
            ]
        );
        const [[created]] = await pool.execute('SELECT * FROM treasury_machines WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409);
            throw new Error('Ya existe una máquina con ese número de serie.');
        }
        throw err;
    }
});

// @route PUT /api/treasury-machines/:id
const updateTreasuryMachine = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const [[existing]] = await pool.execute('SELECT id FROM treasury_machines WHERE id = ?', [id]);
    if (!existing) {
        res.status(404);
        throw new Error('Máquina no encontrada.');
    }

    const {
        type,
        brand,
        model,
        serial_number,
        location,
        counted_bills,
        status,
    } = req.body;

    const fields = [];
    const params = [];

    if (type !== undefined) {
        if (!MACHINE_TYPES.includes(type)) {
            res.status(400);
            throw new Error('Tipo de máquina inválido.');
        }
        fields.push('type = ?');
        params.push(type);
    }
    if (brand !== undefined) {
        fields.push('brand = ?');
        params.push(String(brand).trim() || 'Glory');
    }
    if (model !== undefined) {
        fields.push('model = ?');
        params.push(String(model).trim());
    }
    if (serial_number !== undefined) {
        fields.push('serial_number = ?');
        params.push(String(serial_number).trim());
    }
    if (location !== undefined) {
        fields.push('location = ?');
        params.push(String(location).trim());
    }
    if (counted_bills !== undefined) {
        if (counted_bills === null || counted_bills === '') {
            fields.push('counted_bills = ?');
            params.push(null);
        } else {
            const n = parseInt(String(counted_bills), 10);
            fields.push('counted_bills = ?');
            params.push(Number.isNaN(n) ? null : n);
        }
    }
    if (status !== undefined) {
        const st = normalizeStatus(status);
        if (!st) {
            res.status(400);
            throw new Error('Estado inválido.');
        }
        fields.push('status = ?');
        params.push(st);
    }

    if (fields.length === 0) {
        res.status(400);
        throw new Error('No hay campos para actualizar.');
    }

    params.push(id);
    try {
        await pool.execute(`UPDATE treasury_machines SET ${fields.join(', ')} WHERE id = ?`, params);
        const [[updated]] = await pool.execute('SELECT * FROM treasury_machines WHERE id = ?', [id]);
        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409);
            throw new Error('Ya existe una máquina con ese número de serie.');
        }
        throw err;
    }
});

// @route DELETE /api/treasury-machines/:id
const deleteTreasuryMachine = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const [result] = await pool.execute('DELETE FROM treasury_machines WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
        res.status(404);
        throw new Error('Máquina no encontrada.');
    }
    res.status(200).json({ success: true, message: 'Máquina eliminada.' });
});

// @route GET /api/treasury-machines/:id/maintenances
const listMachineMaintenances = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const [[machine]] = await pool.execute('SELECT id, serial_number, model FROM treasury_machines WHERE id = ?', [id]);
    if (!machine) {
        res.status(404);
        throw new Error('Máquina no encontrada.');
    }

    const [rows] = await pool.execute(
        `SELECT m.id, m.machine_id, m.maintenance_type, m.user_id, m.observations,
                m.previous_status, m.new_status, m.created_at,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) AS user_name
         FROM machine_maintenances m
         LEFT JOIN users u ON m.user_id = u.id
         WHERE m.machine_id = ?
         ORDER BY m.created_at DESC`,
        [id]
    );
    res.status(200).json({ success: true, data: rows, machine });
});

// @route POST /api/treasury-machines/:id/maintenances
const createMachineMaintenance = asyncHandler(async (req, res) => {
    const machineId = parseInt(req.params.id, 10);
    const { maintenance_type, observations, new_status } = req.body;
    const userId = req.user?.id ?? null;

    const mType = normalizeMaintenanceType(maintenance_type);
    const nStatus = normalizeStatus(new_status);
    const obs = observations != null ? String(observations).trim() : '';

    if (!mType) {
        res.status(400);
        throw new Error('Tipo de mantenimiento inválido (preventivo o correctivo).');
    }
    if (!nStatus) {
        res.status(400);
        throw new Error('Estado resultante inválido.');
    }
    if (!obs) {
        res.status(400);
        throw new Error('Las observaciones son obligatorias.');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[machine]] = await conn.execute(
            'SELECT id, status FROM treasury_machines WHERE id = ? FOR UPDATE',
            [machineId]
        );
        if (!machine) {
            res.status(404);
            throw new Error('Máquina no encontrada.');
        }

        const previousStatus = machine.status;

        const [insertResult] = await conn.execute(
            `INSERT INTO machine_maintenances
             (machine_id, maintenance_type, user_id, observations, previous_status, new_status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [machineId, mType, userId, obs, previousStatus, nStatus]
        );

        await conn.execute('UPDATE treasury_machines SET status = ? WHERE id = ?', [nStatus, machineId]);

        await conn.commit();

        const [[record]] = await pool.execute(
            `SELECT m.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) AS user_name
             FROM machine_maintenances m
             LEFT JOIN users u ON m.user_id = u.id
             WHERE m.id = ?`,
            [insertResult.insertId]
        );
        const [[updatedMachine]] = await pool.execute('SELECT * FROM treasury_machines WHERE id = ?', [machineId]);

        res.status(201).json({
            success: true,
            data: record,
            machine: updatedMachine,
            message: 'Mantenimiento registrado y estado de máquina actualizado.',
        });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

module.exports = {
    MACHINE_TYPES,
    MACHINE_STATUSES,
    MAINTENANCE_TYPES,
    listTreasuryMachines,
    getTreasuryMachineById,
    createTreasuryMachine,
    updateTreasuryMachine,
    deleteTreasuryMachine,
    listMachineMaintenances,
    createMachineMaintenance,
};
