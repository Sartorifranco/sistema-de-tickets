const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const { sendPushToUsers } = require('../services/pushNotificationService');
const { sendWebPushToUsers } = require('../services/webPushService');

function parseOptionalDecimal(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function parseCreateBool(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    const s = String(value).toLowerCase();
    return s === 'true' || s === '1' || value === 1;
}

function normalizeDeptLabel(name) {
    if (!name) return '';
    return String(name)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isDesarrolloDepartmentName(name) {
    const n = normalizeDeptLabel(name);
    if (!n) return false;
    return n === 'desarrollo' || n.includes('desarrollo');
}

/** horas reales obligatorias al pasar a resolved/closed: > 0 */
function realHoursMeaningful(value) {
    if (value === undefined || value === null || value === '') return false;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) && n > 0;
}

/** Teléfono opcional: vacío → null, máx. 64 caracteres */
function parseOptionalPhone(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    return s.length > 64 ? s.slice(0, 64) : s;
}

function parseOptionalGithubRepo(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    return s.length > 255 ? s.slice(0, 255) : s;
}

// @desc    Crear un nuevo ticket y notificar a los admins/agentes
// @route   POST /api/tickets
// @access  Private
// @desc    Crear un nuevo ticket y notificar
const createTicket = asyncHandler(async (req, res) => {
    // 1. Agregamos depositario_id a la desestructuración
    const {
        title,
        description,
        priority,
        category_id,
        department_id,
        user_id: clientUserId,
        location_id,
        depositario_id,
        subcategoria,
        es_tarea_interna,
        horas_estimadas,
        horas_reales,
        telefono_contacto,
        github_repo,
        assigned_to_user_id: assignedToBody,
    } = req.body;
    const loggedInUser = req.user;

    let finalUserId;
    if ((loggedInUser.role === 'admin' || loggedInUser.role === 'agent') && clientUserId) {
        finalUserId = clientUserId;
    } else {
        finalUserId = loggedInUser.id;
    }

    if (!title || !description || !priority || !category_id || !department_id) {
        res.status(400);
        throw new Error('Por favor, completa todos los campos requeridos.');
    }

    let finalCategoryId = parseInt(String(category_id), 10);
    if (Number.isNaN(finalCategoryId)) {
        res.status(400);
        throw new Error('Categoría inválida.');
    }

    const [[deptRow]] = await pool.execute('SELECT name FROM departments WHERE id = ?', [department_id]);
    if (deptRow && isDesarrolloDepartmentName(deptRow.name)) {
        const [[clientCo]] = await pool.execute('SELECT company_id FROM users WHERE id = ?', [finalUserId]);
        const co = clientCo?.company_id;
        const hasCompanyCo = co !== undefined && co !== null && co !== '';
        let hasCompanyCats = false;
        if (hasCompanyCo) {
            const [cntRows] = await pool.execute(
                'SELECT COUNT(*) AS c FROM ticket_categories WHERE company_id = ?',
                [co]
            );
            hasCompanyCats = cntRows[0].c > 0;
        }
        let devCatRows;
        if (hasCompanyCo && hasCompanyCats) {
            [devCatRows] = await pool.execute(
                `SELECT id FROM ticket_categories
                 WHERE company_id = ? AND UPPER(TRIM(name)) = 'DESARROLLO'
                 LIMIT 1`,
                [co]
            );
        } else {
            [devCatRows] = await pool.execute(
                `SELECT id FROM ticket_categories
                 WHERE company_id IS NULL AND UPPER(TRIM(name)) = 'DESARROLLO'
                 LIMIT 1`
            );
        }
        if (devCatRows.length > 0) {
            finalCategoryId = devCatRows[0].id;
        }
    }

    const creatorName = (loggedInUser.first_name && loggedInUser.last_name) 
        ? `${loggedInUser.first_name} ${loggedInUser.last_name}` 
        : loggedInUser.username;

    // 2. Modificamos el INSERT para incluir depositario_id
    // Nota: Convertimos a null si viene vacío o undefined
    const finalDepositarioId = depositario_id ? parseInt(depositario_id) : null;
    const finalLocationId = location_id ? parseInt(location_id) : null;
    const finalSubcategoria = subcategoria != null && String(subcategoria).trim() !== '' ? String(subcategoria).trim() : null;
    const finalEsTareaInterna = parseCreateBool(es_tarea_interna, false) ? 1 : 0;
    const finalHorasEstimadas = parseOptionalDecimal(horas_estimadas);
    const finalHorasReales = parseOptionalDecimal(horas_reales);
    const finalTelefonoContacto = parseOptionalPhone(telefono_contacto);
    const finalGithubRepo = parseOptionalGithubRepo(github_repo);

    let finalAssignedTo = null;
    if (assignedToBody !== undefined && assignedToBody !== null && assignedToBody !== '') {
        const aid = parseInt(assignedToBody, 10);
        if (!Number.isNaN(aid)) {
            const [assignRows] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [aid]);
            if (
                assignRows.length > 0 &&
                ['agent', 'admin', 'boss', 'purchasing'].includes(assignRows[0].role)
            ) {
                finalAssignedTo = aid;
            }
        }
    }

    const initialStatus = finalAssignedTo ? 'in-progress' : 'open';

    const [result] = await pool.execute(
        `INSERT INTO tickets (
            user_id, title, description, priority, category_id, department_id, status,
            location_id, depositario_id,
            subcategoria, es_tarea_interna, horas_estimadas, horas_reales,
            telefono_contacto,
            github_repo,
            assigned_to_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            finalUserId,
            title,
            description,
            priority,
            finalCategoryId,
            department_id,
            initialStatus,
            finalLocationId,
            finalDepositarioId,
            finalSubcategoria,
            finalEsTareaInterna,
            finalHorasEstimadas,
            finalHorasReales,
            finalTelefonoContacto,
            finalGithubRepo,
            finalAssignedTo,
        ]
    );
    
    const newTicketId = result.insertId;

    // ... (El resto de la lógica de adjuntos y notificaciones se mantiene IGUAL) ...
    if (req.files && req.files.length > 0) {
        const attachmentPromises = req.files.map(file => {
            const query = 'INSERT INTO ticket_attachments (ticket_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)';
            return pool.execute(query, [newTicketId, file.path, file.originalname, file.mimetype]);
        });
        await Promise.all(attachmentPromises);
    }

    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Nuevo ticket creado #${newTicketId}` });

    const message = `Nuevo ticket #${newTicketId} creado por ${creatorName}: "${title}"`;
    const [adminsAndAgents] = await pool.execute("SELECT id FROM users WHERE role IN ('admin', 'agent') AND is_active != 0");

    const adminAgentIds = adminsAndAgents.map(u => u.id).filter(id => id !== loggedInUser.id);
    if (adminAgentIds.length > 0) {
        sendPushToUsers(adminAgentIds, 'Nuevo Ticket Creado', `Nuevo Ticket Creado: ${title}`, { ticketId: String(newTicketId) }).catch(() => {});
        sendWebPushToUsers(adminAgentIds, 'Nuevo Ticket Creado', `Nuevo Ticket Creado: ${title}`, { ticketId: String(newTicketId) }).catch(() => {});
    }

    for (const user of adminsAndAgents) {
        if (user.id === loggedInUser.id) continue;
        const [notificationResult] = await pool.execute(
            'INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
            [user.id, message, 'ticket_created', newTicketId, 'ticket']
        );
        const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notificationResult.insertId]);
        if (newNotification) {
            req.io.to(`user-${user.id}`).emit('new_notification', newNotification);
        }
    }

    const [[createdTicket]] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [newTicketId]);
    res.status(201).json({
        success: true,
        message: 'Ticket creado exitosamente.',
        data: { id: newTicketId, ...createdTicket },
    });
});

// @desc    Obtener tickets
// @route   GET /api/tickets
// @access  Private
const getTickets = asyncHandler(async (req, res) => {
    const { role, id: currentUserId } = req.user;
    
    // ✅ CORRECCIÓN 1 Y 2: Añadimos departmentId y clientId a la desestructuración.
    const { 
        view, 
        companyId, 
        agentId, 
        status, 
        startDate, 
        endDate, 
        departmentName, 
        unassigned, 
        priority,
        categoryId,
        departmentId, // <-- CORRECCIÓN 2
        clientId      // <-- CORRECCIÓN 1
    } = req.query;

    let query = `
        SELECT t.*, u.company_id,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username, 'Usuario Eliminado') as client_name,
                c.name as category_name,
                d.name as department_name,
                COALESCE(CONCAT(a.first_name, ' ', a.last_name), a.username, 'No asignado') as agent_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN ticket_categories c ON t.category_id = c.id
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
    `;
    const params = [];
    const whereClauses = [];

    // --- Lógica de permisos por rol y filtros de Cliente/Agente ---
    if (['client', 'boss', 'purchasing'].includes(role)) {
        // Cliente, Jefe y Compras solo ven sus propios tickets
        whereClauses.push('t.user_id = ?');
        params.push(currentUserId);
    } 
    else { // Admin o Agente
        // ✅ CORRECCIÓN 1: Si el filtro de reporte envía el ID de un cliente
        if (clientId) {
            whereClauses.push('t.user_id = ?');
            params.push(clientId);
        } else if (role === 'agent') {
            // Lógica de vista por defecto para el agente (si no hay filtros de reporte)
            if (view === 'unassigned') {
                whereClauses.push('t.assigned_to_user_id IS NULL');
            } else if (view === 'resolved') {
                whereClauses.push('t.assigned_to_user_id = ?');
                params.push(currentUserId);
                whereClauses.push("t.status IN ('resolved', 'closed')");
            } else if (view !== 'all') {
                whereClauses.push('t.assigned_to_user_id = ?');
                params.push(currentUserId);
            }
        }
    }
    
    // --- Filtros Adicionales (Reportes) ---
    if (companyId) { whereClauses.push('u.company_id = ?'); params.push(companyId); }

    if (unassigned === 'true') {
        whereClauses.push('t.assigned_to_user_id IS NULL');
    } else if (agentId) { 
        whereClauses.push('t.assigned_to_user_id = ?');
        params.push(agentId);
    }

    // ✅ FILTRO DE DEPARTAMENTO: Acepta nombre o ID (t.department_id)
    if (departmentName) { 
        whereClauses.push('d.name = ?'); 
        params.push(departmentName); 
    } else if (departmentId) {
        whereClauses.push('t.department_id = ?'); 
        params.push(departmentId); 
    }
    
    // FILTRO DE PRIORIDAD
    if (priority) {
        whereClauses.push('t.priority = ?');
        params.push(priority);
    }
    
    // FILTRO DE CATEGORÍA
    if (categoryId) {
        whereClauses.push('t.category_id = ?');
        params.push(categoryId);
    }

    if (startDate && endDate) { whereClauses.push('DATE(t.created_at) BETWEEN ? AND ?'); params.push(startDate, endDate); }

    if (status) {
        if (Array.isArray(status)) {
            const placeholders = status.map(() => '?').join(',');
            whereClauses.push(`t.status IN (${placeholders})`);
            params.push(...status);
        } else {
            const viewImpliesStatus = (role === 'agent' && (view === 'resolved'));
            if (!viewImpliesStatus) {
                whereClauses.push('t.status = ?');
                params.push(status);
            }
        }
    }

    if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    query += ' ORDER BY t.created_at DESC';

    const [tickets] = await pool.execute(query, params);
    res.status(200).json({ success: true, count: tickets.length, data: tickets });
});

// @desc    Obtener un ticket por ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { role, id: userId } = req.user;

    const ticketQuery = `
        SELECT t.*, t.closure_reason,
                COALESCE(CONCAT(u_client.first_name, ' ', u_client.last_name), u_client.username, 'Usuario Eliminado') AS client_name,
                COALESCE(CONCAT(u_agent.first_name, ' ', u_agent.last_name), u_agent.username, 'No asignado') AS agent_name,
                c.name as ticket_category_name,
                d.name as ticket_department_name
        FROM tickets t
        LEFT JOIN users u_client ON t.user_id = u_client.id
        LEFT JOIN users u_agent ON t.assigned_to_user_id = u_agent.id
        LEFT JOIN ticket_categories c ON t.category_id = c.id
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.id = ?`;
        
    const [tickets] = await pool.execute(ticketQuery, [ticketId]);
    if (tickets.length === 0) { res.status(404); throw new Error('Ticket no encontrado'); }
    
    const ticket = tickets[0];
    if (['client', 'boss', 'purchasing'].includes(role) && ticket.user_id !== userId) { res.status(403); throw new Error('No tienes permiso para ver este ticket.'); }
    
    let commentsQuery = `
        SELECT c.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username, 'Usuario Eliminado') as username
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = ?
        ${['client', 'boss', 'purchasing'].includes(role) ? ' AND c.is_internal = false' : ''}
        ORDER BY c.created_at ASC`;
        
    const [comments] = await pool.execute(commentsQuery, [ticketId]);
    
    const [attachments] = await pool.execute(
        'SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId]
    );

    const responseData = { ...ticket, comments, attachments };
    res.status(200).json({ success: true, data: responseData });
});

// (El resto de las funciones se mantienen sin cambios)

const getCategories = asyncHandler(async (req, res) => {
    const [categories] = await pool.execute('SELECT id, name FROM ticket_categories ORDER BY name ASC');
    res.status(200).json({ success: true, data: categories });
});

const getDepartments = asyncHandler(async (req, res) => {
    const [departments] = await pool.execute('SELECT id, name FROM departments ORDER BY name ASC');
    res.status(200).json({ success: true, data: departments });
});

const updateTicket = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const {
        title,
        description,
        priority,
        category_id,
        subcategoria,
        es_tarea_interna,
        horas_estimadas,
        horas_reales,
        telefono_contacto,
        github_repo,
        assigned_to_user_id,
    } = req.body;
    const fieldsToUpdate = [];
    const params = [];
    if (title) { fieldsToUpdate.push('title = ?'); params.push(title); }
    if (description) { fieldsToUpdate.push('description = ?'); params.push(description); }
    if (priority) { fieldsToUpdate.push('priority = ?'); params.push(priority); }
    if (category_id) { fieldsToUpdate.push('category_id = ?'); params.push(category_id); }
    if (subcategoria !== undefined) {
        fieldsToUpdate.push('subcategoria = ?');
        params.push(subcategoria != null && String(subcategoria).trim() !== '' ? String(subcategoria).trim() : null);
    }
    if (es_tarea_interna !== undefined) {
        fieldsToUpdate.push('es_tarea_interna = ?');
        params.push(parseCreateBool(es_tarea_interna, false) ? 1 : 0);
    }
    if (horas_estimadas !== undefined) {
        fieldsToUpdate.push('horas_estimadas = ?');
        params.push(parseOptionalDecimal(horas_estimadas));
    }
    if (horas_reales !== undefined) {
        fieldsToUpdate.push('horas_reales = ?');
        params.push(parseOptionalDecimal(horas_reales));
    }
    if (telefono_contacto !== undefined) {
        fieldsToUpdate.push('telefono_contacto = ?');
        params.push(parseOptionalPhone(telefono_contacto));
    }
    if (github_repo !== undefined) {
        fieldsToUpdate.push('github_repo = ?');
        params.push(parseOptionalGithubRepo(github_repo));
    }
    if (assigned_to_user_id !== undefined) {
        const raw = assigned_to_user_id;
        if (raw === null || raw === '') {
            fieldsToUpdate.push('assigned_to_user_id = ?');
            params.push(null);
        } else {
            const aid = parseInt(raw, 10);
            if (!Number.isNaN(aid)) {
                const [rows] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [aid]);
                if (
                    rows.length > 0 &&
                    ['agent', 'admin', 'boss', 'purchasing'].includes(rows[0].role)
                ) {
                    fieldsToUpdate.push('assigned_to_user_id = ?');
                    params.push(aid);
                }
            }
        }
    }
    if (fieldsToUpdate.length === 0) { res.status(400); throw new Error("Debes proporcionar al menos un campo para actualizar."); }
    params.push(ticketId);
    const query = `UPDATE tickets SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    await pool.execute(query, params);
    const [[updatedTicket]] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    res.status(200).json({ success: true, message: 'Ticket actualizado correctamente.', data: updatedTicket });
});

const deleteTicket = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    
    await pool.execute('DELETE FROM comments WHERE ticket_id = ?', [ticketId]);
    const [result] = await pool.execute('DELETE FROM tickets WHERE id = ?', [ticketId]);
    
    if (result.affectedRows === 0) { res.status(404); throw new Error('Ticket no encontrado'); }
    res.status(200).json({ success: true, message: 'Ticket eliminado permanentemente.' });
});

const updateTicketStatus = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { status: newStatus } = req.body;
    const { role: userRole, id: currentUserId } = req.user;

    if (!newStatus) {
        res.status(400);
        throw new Error('No se proporcionó un nuevo estado.');
    }

    const [tickets] = await pool.execute(
        `SELECT t.user_id, t.assigned_to_user_id, t.title, t.status, t.horas_reales, t.es_tarea_interna,
                d.name AS department_name
         FROM tickets t
         LEFT JOIN departments d ON t.department_id = d.id
         WHERE t.id = ?`,
        [ticketId]
    );
    if (tickets.length === 0) {
        res.status(404);
        throw new Error('Ticket no encontrado');
    }
    const ticket = tickets[0];

    const requiresRealHoursClosure =
        isDesarrolloDepartmentName(ticket.department_name) || parseCreateBool(ticket.es_tarea_interna, false);

    if (
        (newStatus === 'resolved' || newStatus === 'closed') &&
        requiresRealHoursClosure &&
        !realHoursMeaningful(ticket.horas_reales)
    ) {
        res.status(400);
        throw new Error(
            'Las horas reales son obligatorias (mayores a cero) para tickets de Desarrollo o tareas internas antes de resolver o cerrar.'
        );
    }

    if (['client', 'boss', 'purchasing'].includes(userRole)) {
        const canReopen = ticket.status === 'resolved' && newStatus === 'open';
        const canClose = ticket.status === 'resolved' && newStatus === 'closed';
        if (!canReopen && !canClose) {
            res.status(403); 
            throw new Error('No tienes permiso para realizar este cambio de estado.');
        }
    }

    let updateQuery = 'UPDATE tickets SET status = ? WHERE id = ?';
    if (newStatus === 'resolved' || newStatus === 'closed') {
        updateQuery = 'UPDATE tickets SET status = ?, closed_at = NOW() WHERE id = ?';
    }
    await pool.execute(updateQuery, [newStatus, ticketId]);

    const pushUserIds = [];
    if (ticket.user_id && currentUserId !== ticket.user_id) {
        pushUserIds.push(ticket.user_id);
        const statusLabels = { open: 'abierto', 'in-progress': 'en progreso', resolved: 'resuelto', closed: 'cerrado', reopened: 'reabierto' };
        const statusLabel = statusLabels[newStatus] || newStatus;
        const message = `Tu ticket #${ticketId}: "${ticket.title}" cambió de estado a "${statusLabel}".`;
        const [notificationResult] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [ticket.user_id, message, 'ticket_status_changed', ticketId, 'ticket']);
        const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notificationResult.insertId]);
        if (newNotification) {
            req.io.to(`user-${ticket.user_id}`).emit('new_notification', newNotification);
        }
    }
    const [adminsAgents] = await pool.execute("SELECT id FROM users WHERE role IN ('admin', 'agent') AND is_active != 0");
    adminsAgents.forEach(u => { if (u.id !== currentUserId && !pushUserIds.includes(u.id)) pushUserIds.push(u.id); });
    if (ticket.assigned_to_user_id && ticket.assigned_to_user_id !== currentUserId && !pushUserIds.includes(ticket.assigned_to_user_id)) {
        pushUserIds.push(ticket.assigned_to_user_id);
    }
    if (pushUserIds.length > 0) {
        sendPushToUsers(pushUserIds, 'Actualización en Ticket', `Actualización en Ticket #${ticketId}`, { ticketId }).catch(() => {});
        sendWebPushToUsers(pushUserIds, 'Actualización en Ticket', `Actualización en Ticket #${ticketId}`, { ticketId }).catch(() => {});
    }

    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Estado del ticket #${ticketId} actualizado` });
    res.status(200).json({ success: true, message: `El estado del ticket se actualizó a '${newStatus}'.` });
});

const assignTicketToSelf = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { id: agentId, first_name, last_name, username } = req.user;
    const agentName = (first_name && last_name) ? `${first_name} ${last_name}` : username;

    const [result] = await pool.execute("UPDATE tickets SET assigned_to_user_id = ?, status = 'in-progress' WHERE id = ? AND status = 'open'", [agentId, ticketId]);
    
    if (result.affectedRows > 0) {
        const [[ticket]] = await pool.execute('SELECT user_id, title FROM tickets WHERE id = ?', [ticketId]);
        
        const messageToClient = `El agente ${agentName} ha tomado tu ticket #${ticketId}: "${ticket.title}"`;
        const [notificationResult] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [ticket.user_id, messageToClient, 'ticket_assigned', ticketId, 'ticket']);
        const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notificationResult.insertId]);
        
        if (newNotification) {
            req.io.to(`user-${ticket.user_id}`).emit('new_notification', newNotification);
        }
        sendPushToUsers([ticket.user_id], 'Ticket asignado', messageToClient, { ticketId }).catch(() => {});
        sendWebPushToUsers([ticket.user_id], 'Ticket asignado', messageToClient, { ticketId }).catch(() => {});

        req.io.to('admin').to('agent').emit('dashboard_update', { message: `Ticket #${ticketId} auto-asignado por ${agentName}` });
        res.status(200).json({ success: true, message: `Ticket #${ticketId} asignado a tu usuario.` });
    } else {
        res.status(400).json({ success: false, message: 'No se pudo asignar el ticket.' });
    }
});

const reassignTicket = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { newAgentId } = req.body;

    if (!newAgentId) { res.status(400); throw new Error('No se especificó el ID del nuevo agente.'); }
    const [users] = await pool.execute('SELECT role, username, first_name, last_name FROM users WHERE id = ?', [newAgentId]);
    const assignableRoles = ['agent', 'admin', 'boss', 'purchasing'];
    if (users.length === 0 || !assignableRoles.includes(users[0].role)) { res.status(400); throw new Error('El usuario especificado no puede recibir tickets. Solo agentes, admin, jefes y encargados de compras.'); }
    
    await pool.execute('UPDATE tickets SET assigned_to_user_id = ? WHERE id = ?', [newAgentId, ticketId]);

    const [[ticket]] = await pool.execute('SELECT user_id, title FROM tickets WHERE id = ?', [ticketId]);
    const newAgent = users[0];
    const newAgentName = (newAgent.first_name && newAgent.last_name) ? `${newAgent.first_name} ${newAgent.last_name}` : newAgent.username;

    const messageToAgent = `Se te ha asignado el ticket #${ticketId}: "${ticket.title}"`;
    const [notifToAgentRes] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [newAgentId, messageToAgent, 'ticket_assigned', ticketId, 'ticket']);
    const [[newNotifForAgent]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notifToAgentRes.insertId]);
    if (newNotifForAgent) {
        req.io.to(`user-${newAgentId}`).emit('new_notification', newNotifForAgent);
    }
    
    const messageToClient = `Tu ticket #${ticketId} ha sido reasignado al agente ${newAgentName}.`;
    const [notifToClientRes] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [ticket.user_id, messageToClient, 'ticket_assigned', ticketId, 'ticket']);
    const [[newNotifForClient]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notifToClientRes.insertId]);
    if (newNotifForClient) {
        req.io.to(`user-${ticket.user_id}`).emit('new_notification', newNotifForClient);
    }
    sendPushToUsers([newAgentId, ticket.user_id], 'Ticket reasignado', `Ticket #${ticketId}: "${ticket.title}"`, { ticketId }).catch(() => {});
    sendWebPushToUsers([newAgentId, ticket.user_id], 'Ticket reasignado', `Ticket #${ticketId}: "${ticket.title}"`, { ticketId }).catch(() => {});

    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Ticket #${ticketId} reasignado` });
    res.status(200).json({ success: true, message: `Ticket #${ticketId} reasignado exitosamente.` });
});

const addCommentToTicket = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { comment_text, is_internal } = req.body;
    const { id: commenterId, role: commenterRole } = req.user;

    if (!comment_text || comment_text.trim() === '') { res.status(400); throw new Error('El comentario no puede estar vacío.'); }

    const finalIsInternal = !['client', 'boss', 'purchasing'].includes(commenterRole) && (is_internal === true || is_internal === 'true' || is_internal === 1);

    await pool.execute('INSERT INTO comments (ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, ?)', [ticketId, commenterId, comment_text, finalIsInternal]);

    if (!finalIsInternal) {
        const [ticketRows] = await pool.execute('SELECT user_id, assigned_to_user_id, title FROM tickets WHERE id = ?', [ticketId]);
        const ticket = ticketRows[0];
        let targetUserId, message;
        const pushUserIds = [];

        if (['client', 'boss', 'purchasing'].includes(commenterRole) && ticket.assigned_to_user_id) {
            targetUserId = ticket.assigned_to_user_id;
            message = `Nuevo comentario del cliente en el ticket #${ticketId}: "${ticket.title}"`;
            pushUserIds.push(ticket.assigned_to_user_id);
            const [adminAgentIds] = await pool.execute("SELECT id FROM users WHERE role IN ('admin', 'agent') AND is_active != 0");
            adminAgentIds.forEach(u => { if (u.id !== commenterId && !pushUserIds.includes(u.id)) pushUserIds.push(u.id); });
        } else if (!['client', 'boss', 'purchasing'].includes(commenterRole) && ticket.user_id !== commenterId) {
            targetUserId = ticket.user_id;
            message = `Un agente ha respondido a tu ticket #${ticketId}: "${ticket.title}"`;
            pushUserIds.push(ticket.user_id);
            if (ticket.assigned_to_user_id && ticket.assigned_to_user_id !== commenterId && !pushUserIds.includes(ticket.assigned_to_user_id)) pushUserIds.push(ticket.assigned_to_user_id);
            const [adminAgentIds] = await pool.execute("SELECT id FROM users WHERE role IN ('admin', 'agent') AND is_active != 0");
            adminAgentIds.forEach(u => { if (u.id !== commenterId && !pushUserIds.includes(u.id)) pushUserIds.push(u.id); });
        }

        if (targetUserId) {
            const [result] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [targetUserId, message, 'comment', ticketId, 'ticket']);
            const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
            if (newNotification) {
                req.io.to(`user-${targetUserId}`).emit('new_notification', newNotification);
            }
        }
        if (pushUserIds.length > 0) {
            sendPushToUsers(pushUserIds, 'Actualización en Ticket', `Actualización en Ticket #${ticketId}`, { ticketId }).catch(() => {});
            sendWebPushToUsers(pushUserIds, 'Actualización en Ticket', `Actualización en Ticket #${ticketId}`, { ticketId }).catch(() => {});
        }
    }
    
    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Nuevo comentario en ticket #${ticketId}` });
    res.status(201).json({ success: true, message: 'Comentario añadido exitosamente.' });
});

/**
 * Commits de GitHub que referencian este ticket (usa el token del usuario actual).
 * @route GET /api/tickets/:id/github-commits
 */
const getTicketGithubCommits = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { role, id: userId } = req.user;

    const [tickets] = await pool.execute(
        'SELECT t.id, t.user_id, t.github_repo FROM tickets t WHERE t.id = ?',
        [ticketId]
    );
    if (tickets.length === 0) {
        res.status(404);
        throw new Error('Ticket no encontrado');
    }
    const ticket = tickets[0];
    if (['client', 'boss', 'purchasing'].includes(role) && ticket.user_id !== userId) {
        res.status(403);
        throw new Error('No tienes permiso para ver este ticket.');
    }

    const repo = ticket.github_repo && String(ticket.github_repo).trim();
    if (!repo) {
        return res.status(200).json({ success: true, data: { commits: [] } });
    }

    const { getLatestCommits } = require('../services/githubService');
    try {
        const commits = await getLatestCommits(repo, ticket.id, userId);
        return res.status(200).json({ success: true, data: { commits } });
    } catch (err) {
        const status =
            err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502;
        return res.status(status).json({
            success: false,
            message: err.message || 'Error al consultar la API de GitHub.',
        });
    }
});

const getTicketComments = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { role, id: userId } = req.user;
    const [ticket] = await pool.execute('SELECT user_id FROM tickets WHERE id = ?', [ticketId]);
    if (ticket.length === 0) { res.status(404); throw new Error('Ticket no encontrado'); }
    if (['client', 'boss', 'purchasing'].includes(role) && ticket[0].user_id !== userId) { res.status(403); throw new Error('No tienes permiso para ver los comentarios de este ticket.'); }
    
    let query = `SELECT c.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username, 'Usuario Eliminado') as username 
                  FROM comments c 
                  LEFT JOIN users u ON c.user_id = u.id 
                  WHERE c.ticket_id = ?`;

    if (['client', 'boss', 'purchasing'].includes(role)) { query += ' AND c.is_internal = false'; }
    query += ' ORDER BY c.created_at ASC';
    const [comments] = await pool.execute(query, [ticketId]);
    res.status(200).json({ success: true, count: comments.length, data: comments });
});

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    deleteTicket,
    updateTicketStatus,
    assignTicketToSelf,
    addCommentToTicket,
    getTicketComments,
    getTicketGithubCommits,
    reassignTicket,
    getCategories,
    getDepartments,
};