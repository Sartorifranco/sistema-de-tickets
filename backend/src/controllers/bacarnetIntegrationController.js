const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const {
    BACAR_COMPANY_ID,
    BACAR_TICKET_DEPARTMENT_ID_LIST,
    ALLOWED_PRIORITIES,
    CATALOG_CACHE_TTL_MS,
    BACARNET_INTEGRATION_SOURCE,
} = require('../constants/bacarnetIntegration');
const { findOrCreateBacarnetClient } = require('../services/userCreationService');
const { notifyBacarnetTicketStatusChangeSafe } = require('../services/bacarnetWebhookService');
const {
    getOwnedBacarnetTicket,
    commentAuthorLabel,
    isStaffRole,
    isBacarnetOriginTicket,
} = require('../utils/bacarnetTicketAccess');
const {
    assignBacarnetAgent,
    addBacarnetHours,
    resolveBacarnetTicket,
    closeBacarnetTicketComplete,
    loadUserById,
} = require('../services/bacarnetWorkflowService');

async function ownedTicket(res, ticketId, requesterEmail) {
    try {
        return await getOwnedBacarnetTicket(ticketId, requesterEmail);
    } catch (err) {
        if (err.statusCode) res.status(err.statusCode);
        throw err;
    }
}

async function saveTicketAttachments(ticketId, files) {
    if (!files || files.length === 0) return [];
    const inserted = [];
    for (const file of files) {
        const [result] = await pool.execute(
            'INSERT INTO ticket_attachments (ticket_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)',
            [ticketId, file.path, file.originalname, file.mimetype]
        );
        inserted.push({
            id: result.insertId,
            ticket_id: Number(ticketId),
            file_path: file.path,
            file_name: file.originalname,
            file_type: file.mimetype,
        });
    }
    return inserted;
}

let catalogCache = { expiresAt: 0, data: null };

function isAllowedDepartmentId(value) {
    const id = parseInt(value, 10);
    return BACAR_TICKET_DEPARTMENT_ID_LIST.includes(id);
}

async function loadCatalog() {
    const deptPlaceholders = BACAR_TICKET_DEPARTMENT_ID_LIST.map(() => '?').join(',');

    const [departments] = await pool.execute(
        `SELECT id, name, company_id
         FROM departments
         WHERE company_id = ? AND id IN (${deptPlaceholders})
         ORDER BY id ASC`,
        [BACAR_COMPANY_ID, ...BACAR_TICKET_DEPARTMENT_ID_LIST]
    );

    const [categories] = await pool.execute(
        `SELECT id, name, company_id
         FROM ticket_categories
         WHERE company_id = ? OR company_id IS NULL
         ORDER BY name ASC`,
        [BACAR_COMPANY_ID]
    );

    const [problems] = await pool.execute(
        `SELECT id, title, description, category_id, department_id
         FROM predefined_problems
         WHERE department_id IN (${deptPlaceholders})
         ORDER BY title ASC`,
        [...BACAR_TICKET_DEPARTMENT_ID_LIST]
    );

    const problemsByCategory = new Map();
    for (const problem of problems) {
        const list = problemsByCategory.get(problem.category_id) || [];
        list.push({
            id: problem.id,
            title: problem.title,
            description: problem.description,
            category_id: problem.category_id,
            department_id: problem.department_id,
        });
        problemsByCategory.set(problem.category_id, list);
    }

    const categoriesWithProblems = categories.map((category) => ({
        id: category.id,
        name: category.name,
        company_id: category.company_id,
        predefinedProblems: problemsByCategory.get(category.id) || [],
    }));

    return {
        companyId: BACAR_COMPANY_ID,
        departments,
        categories: categoriesWithProblems,
    };
}

const getCatalogo = asyncHandler(async (req, res) => {
    const now = Date.now();
    const forceRefresh = String(req.query.refresh || '') === '1';
    if (!forceRefresh && catalogCache.data && catalogCache.expiresAt > now) {
        res.set('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ success: true, cached: true, data: catalogCache.data });
    }

    const data = await loadCatalog();
    catalogCache = { data, expiresAt: now + CATALOG_CACHE_TTL_MS };
    res.set('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ success: true, cached: false, data });
});

const createBacarnetTicket = asyncHandler(async (req, res) => {
    const {
        requesterEmail,
        requesterNombre,
        title,
        description,
        priority,
        department_id,
        category_id,
        predefined_problem_id,
    } = req.body || {};

    const emailNorm = String(requesterEmail || '').trim().toLowerCase();
    const nombre = String(requesterNombre || '').trim();
    const ticketTitle = String(title || '').trim();
    const ticketDescription = String(description || '').trim();
    const finalPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : 'medium';
    const departmentId = parseInt(department_id, 10);
    const categoryId = parseInt(category_id, 10);

    if (!emailNorm || !emailNorm.includes('@')) {
        res.status(400);
        throw new Error('requesterEmail es obligatorio y debe ser un email válido.');
    }
    if (!nombre) {
        res.status(400);
        throw new Error('requesterNombre es obligatorio.');
    }
    if (!ticketTitle || !ticketDescription) {
        res.status(400);
        throw new Error('title y description son obligatorios.');
    }
    if (!isAllowedDepartmentId(departmentId)) {
        res.status(400);
        throw new Error('department_id no pertenece a las áreas operativas de Bacar.');
    }
    if (Number.isNaN(categoryId)) {
        res.status(400);
        throw new Error('category_id es obligatorio.');
    }

    const [[deptRow]] = await pool.execute(
        'SELECT id FROM departments WHERE id = ? AND company_id = ?',
        [departmentId, BACAR_COMPANY_ID]
    );
    if (!deptRow) {
        res.status(400);
        throw new Error('department_id inválido para Bacar.');
    }

    const [[catRow]] = await pool.execute(
        'SELECT id FROM ticket_categories WHERE id = ? AND (company_id = ? OR company_id IS NULL)',
        [categoryId, BACAR_COMPANY_ID]
    );
    if (!catRow) {
        res.status(400);
        throw new Error('category_id inválido.');
    }

    if (predefined_problem_id !== undefined && predefined_problem_id !== null && predefined_problem_id !== '') {
        const problemId = parseInt(predefined_problem_id, 10);
        if (Number.isNaN(problemId)) {
            res.status(400);
            throw new Error('predefined_problem_id inválido.');
        }
        const [[problem]] = await pool.execute(
            `SELECT id FROM predefined_problems
             WHERE id = ? AND category_id = ? AND department_id = ?`,
            [problemId, categoryId, departmentId]
        );
        if (!problem) {
            res.status(400);
            throw new Error('predefined_problem_id no corresponde a la categoría y departamento indicados.');
        }
    }

    const { user } = await findOrCreateBacarnetClient({
        email: emailNorm,
        requesterNombre: nombre,
        companyId: BACAR_COMPANY_ID,
        departmentId,
    });

    const [result] = await pool.execute(
        `INSERT INTO tickets (
            user_id, title, description, priority, category_id, department_id, status, integration_source
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
        [user.id, ticketTitle, ticketDescription, finalPriority, categoryId, departmentId, BACARNET_INTEGRATION_SOURCE]
    );

    const stTicketId = result.insertId;
    const attachments = await saveTicketAttachments(stTicketId, req.files);

    if (req.io && typeof req.io.to === 'function') {
        req.io.to('admin').to('agent').emit('dashboard_update', {
            message: `Nuevo ticket creado #${stTicketId} (Bacarnet)`,
        });
    }

    return res.status(201).json({
        stTicketId,
        status: 'open',
        attachments,
    });
});

const getBacarnetTicketById = asyncHandler(async (req, res) => {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
        res.status(400);
        throw new Error('id de ticket inválido.');
    }

    const [rows] = await pool.execute(
        `SELECT t.id, t.title, t.description, t.status, t.priority,
                t.user_id, t.category_id, t.department_id, t.assigned_to_user_id,
                t.created_at, t.updated_at, t.resolved_at, t.closed_at, t.closure_reason,
                u.email AS requesterEmail,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) AS requesterNombre,
                d.name AS department_name,
                c.name AS category_name
         FROM tickets t
         LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN departments d ON t.department_id = d.id
         LEFT JOIN ticket_categories c ON t.category_id = c.id
         WHERE t.id = ?`,
        [ticketId]
    );

    if (rows.length === 0) {
        res.status(404);
        throw new Error('Ticket no encontrado.');
    }

    const ticket = rows[0];
    return res.status(200).json({
        success: true,
        data: {
            ...ticket,
            stTicketId: ticket.id,
        },
    });
});

const addBacarnetComment = asyncHandler(async (req, res) => {
    const texto = String((req.body || {}).texto || '').trim();
    if (!texto) {
        res.status(400);
        throw new Error('texto es obligatorio.');
    }

    const { ticket, user } = await ownedTicket(res, req.params.id, (req.body || {}).requesterEmail);

    const [result] = await pool.execute(
        'INSERT INTO comments (ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, ?)',
        [ticket.id, user.id, texto, 0]
    );

    const [[created]] = await pool.execute(
        `SELECT c.id, c.ticket_id, c.user_id, c.comment_text, c.is_internal, c.created_at,
                u.first_name, u.last_name, u.username, u.role
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.id = ?`,
        [result.insertId]
    );

    if (req.io && typeof req.io.to === 'function') {
        req.io.to('admin').to('agent').emit('dashboard_update', {
            message: `Nuevo comentario en ticket #${ticket.id} (Bacarnet)`,
        });
    }

    return res.status(201).json({
        success: true,
        data: {
            id: created.id,
            ticket_id: created.ticket_id,
            texto: created.comment_text,
            is_internal: false,
            created_at: created.created_at,
            authorLabel: 'Vos',
            isRequester: true,
            authorRole: created.role || 'client',
        },
    });
});

const getBacarnetComments = asyncHandler(async (req, res) => {
    const { ticket, user } = await ownedTicket(res, req.params.id, req.query.requesterEmail);

    const [rows] = await pool.execute(
        `SELECT c.id, c.ticket_id, c.user_id, c.comment_text, c.is_internal, c.created_at,
                u.first_name, u.last_name, u.username, u.role
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.ticket_id = ? AND c.is_internal = 0
         ORDER BY c.created_at ASC, c.id ASC`,
        [ticket.id]
    );

    return res.status(200).json({
        success: true,
        data: rows.map((row) => {
            const isRequester = row.user_id != null && Number(row.user_id) === Number(user.id);
            return {
                id: row.id,
                ticket_id: row.ticket_id,
                texto: row.comment_text,
                created_at: row.created_at,
                authorLabel: commentAuthorLabel(row, user.id),
                isRequester,
                authorRole: row.role || (row.user_id == null ? 'system' : null),
                isStaff: isStaffRole(row.role),
            };
        }),
    });
});

const addBacarnetAttachments = asyncHandler(async (req, res) => {
    const { ticket } = await ownedTicket(res, req.params.id, (req.body || {}).requesterEmail);

    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('Debés adjuntar al menos un archivo en el campo attachments.');
    }

    const attachments = await saveTicketAttachments(ticket.id, req.files);
    return res.status(201).json({ success: true, data: attachments });
});

function rethrowWorkflow(res, err) {
    if (err.statusCode) res.status(err.statusCode);
    throw err;
}

function emitDashboard(req, message) {
    if (req.io && typeof req.io.to === 'function') {
        req.io.to('admin').to('agent').emit('dashboard_update', { message });
    }
}

const assignBacarnetTicket = asyncHandler(async (req, res) => {
    let data;
    try {
        data = await assignBacarnetAgent(req.params.id, req.body || {});
    } catch (err) {
        rethrowWorkflow(res, err);
    }
    emitDashboard(req, `Ticket #${data.stTicketId} asignado (Bacarnet)`);
    return res.status(200).json({ success: true, data });
});

const addBacarnetTicketHours = asyncHandler(async (req, res) => {
    let data;
    try {
        data = await addBacarnetHours(req.params.id, req.body || {});
    } catch (err) {
        rethrowWorkflow(res, err);
    }
    emitDashboard(req, `Horas cargadas en ticket #${data.stTicketId} (Bacarnet)`);
    return res.status(201).json({ success: true, data });
});

const closeBacarnetTicketFully = asyncHandler(async (req, res) => {
    let data;
    try {
        data = await closeBacarnetTicketComplete(req.params.id, req.body || {});
    } catch (err) {
        rethrowWorkflow(res, err);
    }
    emitDashboard(req, `Ticket #${data.stTicketId} cerrado por la integración Bacarnet`);
    notifyBacarnetTicketStatusChangeSafe({
        stTicketId: data.stTicketId,
        status: data.status,
        previousStatus: data.previousStatus,
        requesterEmail: data.requesterEmail,
        title: data.title,
        assignedToUserId: data.assigned_to_user_id,
        changedAt: new Date().toISOString(),
        source: 'bacarnet',
    });
    return res.status(200).json({
        success: true,
        data: {
            stTicketId: data.stTicketId,
            status: data.status,
            previousStatus: data.previousStatus,
            accion: data.accion,
            assigned_to_user_id: data.assigned_to_user_id,
            agentEmail: data.agentEmail,
            minutos: data.minutos,
            horas_reales: data.horas_reales,
        },
    });
});

const updateBacarnetTicketEstado = asyncHandler(async (req, res) => {
    const accion = String((req.body || {}).accion || '').trim().toLowerCase();
    if (accion !== 'reabrir' && accion !== 'cerrar' && accion !== 'resolver') {
        res.status(400);
        throw new Error("accion debe ser 'reabrir', 'cerrar' o 'resolver'.");
    }

    const { ticket, email } = await ownedTicket(res, req.params.id, (req.body || {}).requesterEmail);
    const current = ticket.status;

    if (accion === 'resolver') {
        if (!isBacarnetOriginTicket(ticket)) {
            res.status(403);
            throw new Error('La integración solo puede operar tickets creados por Bacarnet.');
        }
        let data;
        try {
            const actor = ticket.assigned_to_user_id
                ? await loadUserById(ticket.assigned_to_user_id)
                : null;
            data = await resolveBacarnetTicket(ticket, actor);
        } catch (err) {
            rethrowWorkflow(res, err);
        }
        emitDashboard(req, `Estado del ticket #${ticket.id} actualizado (Bacarnet)`);
        notifyBacarnetTicketStatusChangeSafe({
            stTicketId: ticket.id,
            status: data.status,
            previousStatus: data.previousStatus,
            requesterEmail: email,
            title: ticket.title,
            assignedToUserId: ticket.assigned_to_user_id,
            changedAt: new Date().toISOString(),
            source: 'bacarnet',
        });
        return res.status(200).json({ success: true, data });
    }

    const canReopen = current === 'resolved' && accion === 'reabrir';
    const canClose = current === 'resolved' && accion === 'cerrar';
    if (!canReopen && !canClose) {
        res.status(400);
        throw new Error(
            `No se puede ${accion} un ticket en estado '${current}'. ` +
                "Reabrir solo es válido si el estado actual es 'resolved' (pasa a 'open'). " +
                "Cerrar solo es válido si el estado actual es 'resolved' (pasa a 'closed')."
        );
    }

    const newStatus = accion === 'reabrir' ? 'open' : 'closed';
    if (newStatus === 'closed') {
        await pool.execute('UPDATE tickets SET status = ?, closed_at = NOW() WHERE id = ?', [newStatus, ticket.id]);
    } else {
        await pool.execute('UPDATE tickets SET status = ? WHERE id = ?', [newStatus, ticket.id]);
    }

    if (req.io && typeof req.io.to === 'function') {
        req.io.to('admin').to('agent').emit('dashboard_update', {
            message: `Estado del ticket #${ticket.id} actualizado (Bacarnet)`,
        });
    }

    notifyBacarnetTicketStatusChangeSafe({
        stTicketId: ticket.id,
        status: newStatus,
        previousStatus: current,
        requesterEmail: email,
        title: ticket.title,
        assignedToUserId: ticket.assigned_to_user_id,
        changedAt: new Date().toISOString(),
        source: 'client',
    });

    return res.status(200).json({
        success: true,
        data: {
            stTicketId: ticket.id,
            status: newStatus,
            previousStatus: current,
            accion,
        },
    });
});

module.exports = {
    getCatalogo,
    createBacarnetTicket,
    getBacarnetTicketById,
    addBacarnetComment,
    getBacarnetComments,
    addBacarnetAttachments,
    updateBacarnetTicketEstado,
    assignBacarnetTicket,
    addBacarnetTicketHours,
    closeBacarnetTicketFully,
};
