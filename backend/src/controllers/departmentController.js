const pool = require('../config/db');
const asyncHandler = require('express-async-handler');
const { logActivity } = require('../services/activityLogService');

// ✅ --- CORRECCIÓN APLICADA AQUÍ --- ✅
// Se simplifica la función para que siempre devuelva TODOS los departamentos.
// El frontend se encargará de la lógica de filtrado.
const getAllDepartments = asyncHandler(async (req, res) => {
    const query = 'SELECT d.id, d.name, d.description, d.company_id, c.name as company_name FROM departments d LEFT JOIN companies c ON d.company_id = c.id ORDER BY d.name ASC';
    const [departments] = await pool.execute(query);
    res.status(200).json({ success: true, count: departments.length, data: departments });
});

// @desc    Get single department by ID with authorization logic
const getDepartmentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role, company_id } = req.user;

    const [rows] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id]);
    if (rows.length === 0) {
        res.status(404);
        throw new Error('Departamento no encontrado');
    }
    const department = rows[0];

    if (role !== 'admin' && department.company_id !== company_id) {
        res.status(403);
        throw new Error('No tienes permiso para ver la información de este departamento.');
    }
    
    res.status(200).json({ success: true, data: department });
});

// @desc    Create new department
const createDepartment = asyncHandler(async (req, res) => {
    const { name, description, company_id } = req.body;
    const { id: userId, username, role: userRole } = req.user;
    if (!name || !company_id) {
        res.status(400);
        throw new Error('El nombre y el ID de la empresa son requeridos.');
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO departments (name, description, company_id) VALUES (?, ?, ?)',
            [name, description || null, company_id]
        );
        const newDepartmentId = result.insertId;
        await logActivity(userId, username, userRole, 'department_created', `Departamento "${name}" (ID: ${newDepartmentId}) creado.`, 'department', newDepartmentId, null, { name, description, company_id });
        res.status(201).json({ success: true, message: 'Departamento creado exitosamente', data: { id: newDepartmentId, name, description, company_id } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409);
            throw new Error('Ya existe un departamento con ese nombre en esta empresa.');
        }
        res.status(500);
        throw new Error('Error del servidor al crear el departamento.');
    }
});

// @desc    Update department
const updateDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const [existing] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id]);
    if (existing.length === 0) {
        res.status(404);
        throw new Error('Departamento no encontrado.');
    }
    await pool.execute(
        'UPDATE departments SET name = ?, description = ? WHERE id = ?',
        [name || existing[0].name, description || existing[0].description, id]
    );
    res.status(200).json({ success: true, message: 'Departamento actualizado exitosamente.' });
});

// @desc    Delete department
const deleteDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [existing] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id]);
    if (existing.length === 0) {
        res.status(404);
        throw new Error('Departamento no encontrado.');
    }
    await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Departamento eliminado exitosamente.' });
});

// @desc    Get all departments for a specific company (for admin)
const getDepartmentsByCompany = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    if (!companyId) {
        res.status(400);
        throw new Error('No se proporcionó un ID de empresa.');
    }
    const [departments] = await pool.execute(
        'SELECT * FROM departments WHERE company_id = ? ORDER BY name ASC',
        [companyId]
    );
    res.status(200).json({ success: true, count: departments.length, data: departments });
});

// @desc    Get departments for a company (Public Access)
const getPublicDepartmentsByCompany = asyncHandler(async (req, res) => {
    const { company_id } = req.query;
    if (!company_id) {
        res.status(400);
        throw new Error('No se proporcionó un ID de empresa.');
    }
    const [departments] = await pool.execute(
        'SELECT id, name FROM departments WHERE company_id = ? ORDER BY name ASC',
        [company_id]
    );
    res.status(200).json({ success: true, count: departments.length, data: departments });
});

module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentsByCompany,
    getPublicDepartmentsByCompany,
};