const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// @desc    Obtener lista de empresas para el registro (Acceso Público)
// @route   GET /api/public/companies
const getPublicCompanies = asyncHandler(async (req, res) => {
    try {
        // Intentamos la consulta estándar
        // Asegúrate que tu tabla se llame 'companies' y tenga la columna 'is_active'
        const query = 'SELECT id, name FROM companies WHERE is_active = 1 ORDER BY name ASC';
        
        const [rows] = await pool.execute(query);
        
        res.json({ success: true, data: rows });
    } catch (error) {
        // LOG SENIOR: Imprimimos el error real en la consola del servidor
        console.error('🔥 ERROR CRÍTICO SQL (Companies):', error.message);
        console.error('SQL State:', error.sqlState);
        
        // Devolvemos el error específico al frontend para que lo veas en el navegador
        res.status(500).json({ 
            success: false, 
            message: 'Error de base de datos al cargar empresas',
            debug_error: error.message // <--- ESTO TE DIRÁ QUÉ PASA
        });
    }
});

// @desc    Obtener lista de departamentos para el registro (Acceso Público)
// @route   GET /api/public/departments
const getPublicDepartments = asyncHandler(async (req, res) => {
    try {
        const query = 'SELECT id, name FROM departments ORDER BY name ASC';
        const [rows] = await pool.execute(query);
        
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('🔥 ERROR CRÍTICO SQL (Departments):', error.message);
        
        res.status(500).json({ 
            success: false, 
            message: 'Error de base de datos al cargar departamentos',
            debug_error: error.message
        });
    }
});

module.exports = { getPublicCompanies, getPublicDepartments };