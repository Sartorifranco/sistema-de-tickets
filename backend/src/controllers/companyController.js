const pool = require('../config/db');
const asyncHandler = require('express-async-handler');

// @desc    Get all companies (for admin)
// @route   GET /api/companies
// @access  Admin
const getAllCompanies = asyncHandler(async (req, res) => {
    const [companies] = await pool.execute(
        'SELECT id, name, created_at FROM companies ORDER BY name ASC'
    );
    res.status(200).json({
        success: true,
        count: companies.length,
        data: companies,
    });
});

// --- FUNCIÓN NUEVA Y CORREGIDA ---
// @desc    Get single company by ID with authorization
// @route   GET /api/companies/:id
// @access  Private (Admin, or Client/Agent for their own company)
const getCompanyById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role, company_id } = req.user;

    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id]);

    if (rows.length === 0) {
        res.status(404);
        throw new Error('Empresa no encontrada');
    }
    const company = rows[0];

    // Un admin puede ver cualquier empresa. Un cliente/agente solo puede ver la suya.
    if (role !== 'admin' && company.id !== company_id) {
        res.status(403);
        throw new Error('No tienes permiso para ver la información de esta empresa.');
    }

    res.status(200).json({ success: true, data: company });
});


// @desc    Create a new company
// @route   POST /api/companies
// @access  Admin
const createCompany = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('El nombre de la empresa es requerido.');
    }

    const [existing] = await pool.execute('SELECT id FROM companies WHERE name = ?', [name]);
    if (existing.length > 0) {
        res.status(409); // Conflict
        throw new Error('Ya existe una empresa con ese nombre.');
    }

    const [result] = await pool.execute('INSERT INTO companies (name) VALUES (?)', [name]);

    res.status(201).json({
        success: true,
        message: 'Empresa creada exitosamente.',
        data: { id: result.insertId, name },
    });
});

// @desc    Update a company
// @route   PUT /api/companies/:id
// @access  Admin
const updateCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('El nombre de la empresa es requerido.');
    }
    const [company] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id]);
    if (company.length === 0) {
        res.status(404);
        throw new Error('Empresa no encontrada.');
    }
    await pool.execute('UPDATE companies SET name = ? WHERE id = ?', [name, id]);
    res.status(200).json({
        success: true,
        message: 'Empresa actualizada exitosamente.',
    });
});

// @desc    Delete a company
// @route   DELETE /api/companies/:id
// @access  Admin
const deleteCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [company] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id]);
    if (company.length === 0) {
        res.status(404);
        throw new Error('Empresa no encontrada.');
    }
    await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
    res.status(200).json({
        success: true,
        message: 'Empresa eliminada exitosamente.',
    });
});

// @desc    Get all companies for public access
// @route   GET /api/public/companies
// @access  Public
const getPublicCompanies = asyncHandler(async (req, res) => {
    const [companies] = await pool.execute('SELECT id, name FROM companies ORDER BY name ASC');
    res.status(200).json({
        success: true,
        count: companies.length,
        data: companies,
    });
});

module.exports = {
    getAllCompanies,
    getCompanyById, // <-- Se añade la nueva función a las exportaciones
    createCompany,
    updateCompany,
    deleteCompany,
    getPublicCompanies,
};

