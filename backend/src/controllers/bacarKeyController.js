// backend/src/controllers/bacarKeyController.js
const pool = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { createActivityLog } = require('../utils/activityLogger');

// @desc    Get all Bacar keys
// @route   GET /api/bacar-keys
// @access  Admin
const getBacarKeys = asyncHandler(async (req, res) => {
    // Selecciona las columnas que realmente tienes en tu tabla bacar_keys
    const [keys] = await pool.execute('SELECT id, device_user, username, password, notes, created_at, updated_at FROM bacar_keys');
    res.status(200).json(keys);
});

// @desc    Get single Bacar key by ID
// @route   GET /api/bacar-keys/:id
// @access  Admin
const getBacarKeyById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [keyRows] = await pool.execute('SELECT id, device_user, username, password, notes, created_at, updated_at FROM bacar_keys WHERE id = ?', [id]);

    if (keyRows.length === 0) {
        res.status(404);
        throw new Error('Clave Bacar no encontrada.');
    }
    res.status(200).json(keyRows[0]);
});

// @desc    Create new Bacar key
// @route   POST /api/bacar-keys
// @access  Admin
const createBacarKey = asyncHandler(async (req, res) => {
    const { device_user, username, password, notes } = req.body;
    const userId = req.user.id;

    if (!device_user || !username || !password) {
        res.status(400);
        throw new Error('Por favor, ingrese el usuario del dispositivo, el usuario y la contraseña.');
    }

    const [result] = await pool.execute(
        'INSERT INTO bacar_keys (device_user, username, password, notes) VALUES (?, ?, ?, ?)',
        [device_user, username, password, notes || null]
    );

    const newKeyId = result.insertId;

    await createActivityLog(
        userId,
        'bacar_key',
        'created',
        `Clave Bacar creada para dispositivo: "${device_user}" (Usuario: ${username})`,
        newKeyId,
        null,
        { device_user, username, password: '********', notes } // No loggear la contraseña real
    );

    res.status(201).json({
        success: true,
        message: 'Clave Bacar creada exitosamente.',
        keyId: newKeyId,
    });
});

// @desc    Update Bacar key
// @route   PUT /api/bacar-keys/:id
// @access  Admin
const updateBacarKey = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { device_user, username, password, notes } = req.body;
    const userId = req.user.id;

    const [existingKeyRows] = await pool.execute('SELECT * FROM bacar_keys WHERE id = ?', [id]);
    if (existingKeyRows.length === 0) {
        res.status(404);
        throw new Error('Clave Bacar no encontrada.');
    }
    const oldKeyData = existingKeyRows[0];

    const updateFields = {};
    const updateParams = [];

    if (device_user !== undefined) { updateFields.device_user = device_user; updateParams.push(device_user); }
    if (username !== undefined) { updateFields.username = username; updateParams.push(username); }
    if (password !== undefined && password !== '') {
        updateFields.password = password; // Asumiendo que no se hashea aquí o ya viene hasheada si es necesario
        updateParams.push(password);
    }
    if (notes !== undefined) { updateFields.notes = notes; updateParams.push(notes || null); }

    if (Object.keys(updateFields).length === 0) {
        res.status(400);
        throw new Error('No se proporcionaron campos para actualizar.');
    }

    const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    updateParams.push(id);

    await pool.execute(`UPDATE bacar_keys SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, updateParams);

    const [updatedKeyRows] = await pool.execute('SELECT * FROM bacar_keys WHERE id = ?', [id]);
    const newKeyData = updatedKeyRows[0];

    await createActivityLog(
        userId,
        'bacar_key',
        'updated',
        `Clave Bacar #${id} actualizada para dispositivo: "${newKeyData.device_user}"`,
        parseInt(id),
        { ...oldKeyData, password: '********' },
        { ...newKeyData, password: '********' }
    );

    res.status(200).json({
        success: true,
        message: 'Clave Bacar actualizada exitosamente.',
        updatedFields: updateFields,
    });
});

// @desc    Delete Bacar key
// @route   DELETE /api/bacar-keys/:id
// @access  Admin
const deleteBacarKey = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const [existingKeyRows] = await pool.execute('SELECT * FROM bacar_keys WHERE id = ?', [id]);
    if (existingKeyRows.length === 0) {
        res.status(404);
        throw new Error('Clave Bacar no encontrada.');
    }
    const deletedKeyData = existingKeyRows[0];

    await pool.execute('DELETE FROM bacar_keys WHERE id = ?', [id]);

    await createActivityLog(
        userId,
        'bacar_key',
        'deleted',
        `Clave Bacar eliminada para dispositivo: "${deletedKeyData.device_user}" (ID: ${id})`,
        parseInt(id),
        { ...deletedKeyData, password: '********' },
        null
    );

    res.status(200).json({
        success: true,
        message: 'Clave Bacar eliminada exitosamente.',
    });
});

module.exports = {
    getBacarKeys,
    getBacarKeyById,
    createBacarKey,
    updateBacarKey,
    deleteBacarKey,
};
