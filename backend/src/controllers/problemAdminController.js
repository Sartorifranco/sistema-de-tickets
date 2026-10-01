const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// ==========================================
// 1. GESTIÓN DE PROBLEMÁTICAS
// ==========================================

const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

/**
 * Detecta si las columnas de personalización (migración
 * add_problems_customization.sql) existen. Se cachea unos minutos para no
 * consultar information_schema en cada request; si la migración se corre con
 * el backend levantado, a los 5 minutos (o al reiniciar) se activa sola.
 */
let schemaCache = null;
let schemaCacheAt = 0;
const SCHEMA_TTL_MS = 5 * 60 * 1000;

async function getSchemaFeatures(force = false) {
    const now = Date.now();
    if (!force && schemaCache && now - schemaCacheAt < SCHEMA_TTL_MS) return schemaCache;

    const [rows] = await pool.execute(
        `SELECT TABLE_NAME, COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ('predefined_problems', 'ticket_categories')
           AND COLUMN_NAME IN ('is_active', 'sort_order', 'default_priority')`
    );
    const has = new Set(rows.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
    const problems =
        has.has('predefined_problems.is_active') &&
        has.has('predefined_problems.sort_order') &&
        has.has('predefined_problems.default_priority');
    const categories = has.has('ticket_categories.is_active') && has.has('ticket_categories.sort_order');

    schemaCache = { problems, categories, customization: problems && categories };
    schemaCacheAt = now;
    return schemaCache;
}

function invalidateSchemaCache() {
    schemaCache = null;
    schemaCacheAt = 0;
}

function toNullableInt(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toBool(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const s = String(value).toLowerCase();
    return s === '1' || s === 'true';
}

function normalizePriority(value) {
    if (value === undefined || value === null || value === '') return null;
    const s = String(value).toLowerCase();
    return PRIORITIES.has(s) ? s : null;
}

// @desc    Obtener todas las categorías y problemas con datos de contexto (Admin)
// @route   GET /api/admin/problems-all
const getAllProblemsAdmin = asyncHandler(async (req, res) => {
    const features = await getSchemaFeatures();

    const catExtra = features.categories
        ? 'c.is_active, c.sort_order,'
        : '1 AS is_active, 0 AS sort_order,';
    const catOrder = features.categories ? 'c.sort_order ASC, c.name ASC' : 'c.name ASC';

    const probExtra = features.problems
        ? 'p.is_active, p.sort_order, p.default_priority,'
        : '1 AS is_active, 0 AS sort_order, NULL AS default_priority,';
    const probOrder = features.problems ? 'p.sort_order ASC, p.title ASC' : 'p.title ASC';

    const [[categories], [problems], [departments], [companies]] = await Promise.all([
        pool.query(`
            SELECT c.id, c.name, c.company_id, ${catExtra}
                   co.name AS company_name,
                   (SELECT COUNT(*) FROM predefined_problems p WHERE p.category_id = c.id) AS problem_count,
                   (SELECT COUNT(*) FROM tickets t WHERE t.category_id = c.id) AS ticket_count
            FROM ticket_categories c
            LEFT JOIN companies co ON co.id = c.company_id
            ORDER BY ${catOrder}
        `),
        pool.query(`
            SELECT p.id, p.title, p.description, p.category_id, p.department_id, ${probExtra}
                   c.name AS category_name,
                   d.name AS department_name,
                   dco.name AS department_company_name,
                   (SELECT COUNT(*) FROM tickets t
                     WHERE t.category_id = p.category_id
                       AND CONVERT(t.title USING utf8mb4) = CONVERT(p.title USING utf8mb4)) AS ticket_count
            FROM predefined_problems p
            LEFT JOIN ticket_categories c ON p.category_id = c.id
            LEFT JOIN departments d ON d.id = p.department_id
            LEFT JOIN companies dco ON dco.id = d.company_id
            ORDER BY ${probOrder}
        `),
        pool.query(`
            SELECT d.id, d.name, d.company_id, co.name AS company_name
            FROM departments d
            LEFT JOIN companies co ON co.id = d.company_id
            ORDER BY co.name ASC, d.name ASC
        `),
        pool.query('SELECT id, name FROM companies ORDER BY name ASC'),
    ]);

    const categoryIds = new Set(categories.map((c) => c.id));
    const orphanedProblems = problems.filter((p) => !categoryIds.has(p.category_id));

    res.json({
        success: true,
        data: {
            categories,
            problems,
            departments,
            companies,
            features: { customization: features.customization },
            stats: {
                totalProblems: problems.length,
                totalCategories: categories.length,
                orphanedCount: orphanedProblems.length,
            },
        },
    });
});

// --- CRUD CATEGORÍAS ---

async function assertCategoryNameAvailable(name, companyId, excludeId = null) {
    const params = [name, companyId];
    let sql = 'SELECT id FROM ticket_categories WHERE name = ? AND company_id <=> ?';
    if (excludeId != null) {
        sql += ' AND id <> ?';
        params.push(excludeId);
    }
    const [rows] = await pool.execute(sql, params);
    return rows.length === 0;
}

const createCategory = asyncHandler(async (req, res) => {
    const { name, company_id, is_active } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
        res.status(400);
        throw new Error('El nombre de la categoría es requerido.');
    }
    const companyId = toNullableInt(company_id);
    if (!(await assertCategoryNameAvailable(trimmed, companyId))) {
        res.status(409);
        throw new Error('Ya existe una categoría con ese nombre para ese alcance.');
    }

    const features = await getSchemaFeatures();
    let result;
    if (features.categories) {
        const [[{ next }]] = await pool.query(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ticket_categories'
        );
        [result] = await pool.execute(
            'INSERT INTO ticket_categories (name, company_id, is_active, sort_order) VALUES (?, ?, ?, ?)',
            [trimmed, companyId, toBool(is_active) ? 1 : 0, next]
        );
    } else {
        [result] = await pool.execute('INSERT INTO ticket_categories (name, company_id) VALUES (?, ?)', [
            trimmed,
            companyId,
        ]);
    }
    res.status(201).json({ success: true, message: 'Categoría creada', data: { id: result.insertId } });
});

const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, company_id, is_active } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
        res.status(400);
        throw new Error('El nombre de la categoría es requerido.');
    }
    const companyId = toNullableInt(company_id);
    if (!(await assertCategoryNameAvailable(trimmed, companyId, Number(id)))) {
        res.status(409);
        throw new Error('Ya existe otra categoría con ese nombre para ese alcance.');
    }

    const features = await getSchemaFeatures();
    if (features.categories) {
        await pool.execute(
            'UPDATE ticket_categories SET name = ?, company_id = ?, is_active = COALESCE(?, is_active) WHERE id = ?',
            [trimmed, companyId, is_active === undefined ? null : toBool(is_active) ? 1 : 0, id]
        );
    } else {
        await pool.execute('UPDATE ticket_categories SET name = ?, company_id = ? WHERE id = ?', [
            trimmed,
            companyId,
            id,
        ]);
    }
    res.json({ success: true, message: 'Categoría actualizada' });
});

const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('DELETE FROM predefined_problems WHERE category_id = ?', [id]);
    await pool.execute('DELETE FROM ticket_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Categoría eliminada' });
});

// @desc    Duplicar una categoría (con todos sus problemas) hacia otro alcance/nombre
// @route   POST /api/admin/categories/:id/duplicate
const duplicateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, company_id } = req.body;

    const [[source]] = await pool.execute('SELECT * FROM ticket_categories WHERE id = ?', [id]);
    if (!source) {
        res.status(404);
        throw new Error('Categoría no encontrada.');
    }

    const trimmed = String(name || source.name).trim();
    const companyId = company_id === undefined ? source.company_id : toNullableInt(company_id);
    if (!(await assertCategoryNameAvailable(trimmed, companyId))) {
        res.status(409);
        throw new Error('Ya existe una categoría con ese nombre para ese alcance.');
    }

    const features = await getSchemaFeatures();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let newId;
        if (features.categories) {
            const [[{ next }]] = await conn.query(
                'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ticket_categories'
            );
            const [r] = await conn.execute(
                'INSERT INTO ticket_categories (name, company_id, is_active, sort_order) VALUES (?, ?, ?, ?)',
                [trimmed, companyId, source.is_active ?? 1, next]
            );
            newId = r.insertId;
            await conn.execute(
                `INSERT INTO predefined_problems (title, description, category_id, department_id, is_active, sort_order, default_priority)
                 SELECT title, description, ?, department_id, is_active, sort_order, default_priority
                 FROM predefined_problems WHERE category_id = ?`,
                [newId, id]
            );
        } else {
            const [r] = await conn.execute('INSERT INTO ticket_categories (name, company_id) VALUES (?, ?)', [
                trimmed,
                companyId,
            ]);
            newId = r.insertId;
            await conn.execute(
                `INSERT INTO predefined_problems (title, description, category_id, department_id)
                 SELECT title, description, ?, department_id
                 FROM predefined_problems WHERE category_id = ?`,
                [newId, id]
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, message: 'Categoría duplicada', data: { id: newId } });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

// @desc    Reordenar categorías
// @route   PUT /api/admin/categories/reorder   body: { ordered_ids: number[] }
const reorderCategories = asyncHandler(async (req, res) => {
    const features = await getSchemaFeatures();
    if (!features.categories) {
        res.status(409);
        throw new Error('Para ordenar categorías hay que aplicar la migración de personalización.');
    }
    const ids = Array.isArray(req.body.ordered_ids) ? req.body.ordered_ids.map(Number).filter(Number.isFinite) : [];
    if (ids.length === 0) {
        res.status(400);
        throw new Error('ordered_ids es requerido.');
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i += 1) {
            await conn.execute('UPDATE ticket_categories SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    res.json({ success: true, message: 'Orden actualizado' });
});

// --- CRUD PROBLEMAS ---

const createProblem = asyncHandler(async (req, res) => {
    const { title, description, category_id, department_id, is_active, default_priority } = req.body;
    const trimmed = String(title || '').trim();
    const categoryId = toNullableInt(category_id);
    const departmentId = toNullableInt(department_id);
    if (!trimmed || categoryId == null || departmentId == null) {
        res.status(400);
        throw new Error('Título, categoría y departamento son requeridos.');
    }

    const features = await getSchemaFeatures();
    let result;
    if (features.problems) {
        const [[{ next }]] = await pool.execute(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM predefined_problems WHERE category_id = ?',
            [categoryId]
        );
        [result] = await pool.execute(
            `INSERT INTO predefined_problems
                (title, description, category_id, department_id, is_active, sort_order, default_priority)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [trimmed, description ?? '', categoryId, departmentId, toBool(is_active) ? 1 : 0, next, normalizePriority(default_priority)]
        );
    } else {
        [result] = await pool.execute(
            'INSERT INTO predefined_problems (title, description, category_id, department_id) VALUES (?, ?, ?, ?)',
            [trimmed, description ?? '', categoryId, departmentId]
        );
    }
    res.status(201).json({ success: true, message: 'Problema creado', data: { id: result.insertId } });
});

const updateProblem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, category_id, department_id, is_active, default_priority } = req.body;

    const trimmed = String(title || '').trim();
    const departmentId = toNullableInt(department_id);
    if (!trimmed || departmentId == null) {
        res.status(400);
        throw new Error('Título y departamento son requeridos.');
    }

    const [existing] = await pool.execute('SELECT id, category_id FROM predefined_problems WHERE id = ?', [id]);
    if (existing.length === 0) {
        res.status(404);
        throw new Error('Problema no encontrado.');
    }

    // El front a veces no envía category_id; conservar el actual para no romper el UPDATE
    const nextCategoryId = toNullableInt(category_id) ?? existing[0].category_id;

    const features = await getSchemaFeatures();
    if (features.problems) {
        await pool.execute(
            `UPDATE predefined_problems
             SET title = ?, description = ?, category_id = ?, department_id = ?,
                 is_active = COALESCE(?, is_active),
                 default_priority = ?
             WHERE id = ?`,
            [
                trimmed,
                description ?? '',
                nextCategoryId,
                departmentId,
                is_active === undefined ? null : toBool(is_active) ? 1 : 0,
                normalizePriority(default_priority),
                id,
            ]
        );
    } else {
        await pool.execute(
            'UPDATE predefined_problems SET title = ?, description = ?, category_id = ?, department_id = ? WHERE id = ?',
            [trimmed, description ?? '', nextCategoryId, departmentId, id]
        );
    }
    res.json({ success: true, message: 'Problema actualizado' });
});

const deleteProblem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('DELETE FROM predefined_problems WHERE id=?', [id]);
    res.json({ success: true, message: 'Problema eliminado' });
});

// @desc    Acciones masivas sobre problemas
// @route   PATCH /api/admin/problems/bulk
//          body: { ids: number[], action: 'move'|'department'|'activate'|'deactivate'|'delete', category_id?, department_id? }
const bulkUpdateProblems = asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    const { action } = req.body;
    if (ids.length === 0) {
        res.status(400);
        throw new Error('Seleccioná al menos un problema.');
    }
    const placeholders = ids.map(() => '?').join(',');

    switch (action) {
        case 'move': {
            const categoryId = toNullableInt(req.body.category_id);
            if (categoryId == null) {
                res.status(400);
                throw new Error('Indicá la categoría destino.');
            }
            const [[cat]] = await pool.execute('SELECT id FROM ticket_categories WHERE id = ?', [categoryId]);
            if (!cat) {
                res.status(404);
                throw new Error('Categoría destino no encontrada.');
            }
            await pool.query(`UPDATE predefined_problems SET category_id = ? WHERE id IN (${placeholders})`, [
                categoryId,
                ...ids,
            ]);
            break;
        }
        case 'department': {
            const departmentId = toNullableInt(req.body.department_id);
            if (departmentId == null) {
                res.status(400);
                throw new Error('Indicá el departamento.');
            }
            await pool.query(`UPDATE predefined_problems SET department_id = ? WHERE id IN (${placeholders})`, [
                departmentId,
                ...ids,
            ]);
            break;
        }
        case 'activate':
        case 'deactivate': {
            const features = await getSchemaFeatures();
            if (!features.problems) {
                res.status(409);
                throw new Error('Para activar/desactivar hay que aplicar la migración de personalización.');
            }
            await pool.query(`UPDATE predefined_problems SET is_active = ? WHERE id IN (${placeholders})`, [
                action === 'activate' ? 1 : 0,
                ...ids,
            ]);
            break;
        }
        case 'delete': {
            await pool.query(`DELETE FROM predefined_problems WHERE id IN (${placeholders})`, ids);
            break;
        }
        default:
            res.status(400);
            throw new Error('Acción no válida.');
    }

    res.json({ success: true, message: 'Cambios aplicados', data: { affected: ids.length } });
});

// @desc    Reordenar problemas dentro de una categoría
// @route   PUT /api/admin/problems/reorder   body: { ordered_ids: number[] }
const reorderProblems = asyncHandler(async (req, res) => {
    const features = await getSchemaFeatures();
    if (!features.problems) {
        res.status(409);
        throw new Error('Para ordenar problemas hay que aplicar la migración de personalización.');
    }
    const ids = Array.isArray(req.body.ordered_ids) ? req.body.ordered_ids.map(Number).filter(Number.isFinite) : [];
    if (ids.length === 0) {
        res.status(400);
        throw new Error('ordered_ids es requerido.');
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i += 1) {
            await conn.execute('UPDATE predefined_problems SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    res.json({ success: true, message: 'Orden actualizado' });
});


// ==========================================
// 2. GESTIÓN DE UBICACIONES
// ==========================================

// @desc    Obtener todas las ubicaciones (Admin)
// @route   GET /api/admin/locations
const getAllLocationsAdmin = asyncHandler(async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM locations ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error leyendo locations (probablemente tabla no existe):", error.message);
        res.json({ success: true, data: [] });
    }
});

const createLocation = asyncHandler(async (req, res) => {
    const { name, address } = req.body;
    await pool.execute('INSERT INTO locations (name, address) VALUES (?, ?)', [name, address]);
    res.json({ success: true, message: 'Ubicación creada' });
});

const updateLocation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address } = req.body;
    await pool.execute('UPDATE locations SET name=?, address=? WHERE id=?', [name, address, id]);
    res.json({ success: true, message: 'Ubicación actualizada' });
});

const deleteLocation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('DELETE FROM locations WHERE id=?', [id]);
    res.json({ success: true, message: 'Ubicación eliminada' });
});

module.exports = {
    getAllProblemsAdmin,
    createCategory,
    updateCategory,
    deleteCategory,
    duplicateCategory,
    reorderCategories,
    createProblem,
    updateProblem,
    deleteProblem,
    bulkUpdateProblems,
    reorderProblems,
    getSchemaFeatures,
    invalidateSchemaCache,
    getAllLocationsAdmin,
    createLocation,
    updateLocation,
    deleteLocation
};
