const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

// @desc    Crear un nuevo ticket y notificar a los admins/agentes
// @route   POST /api/tickets
// @access  Private
const createTicket = asyncHandler(async (req, res) => {
    const { title, description, priority, category_id, department_id, user_id: clientUserId, location_id } = req.body;
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

    if (!finalUserId) {
        res.status(400);
        throw new Error('No se pudo determinar el usuario para el cual se crea el ticket.');
    }

    const creatorName = (loggedInUser.first_name && loggedInUser.last_name) 
        ? `${loggedInUser.first_name} ${loggedInUser.last_name}` 
        : loggedInUser.username;


    const [result] = await pool.execute(
        'INSERT INTO tickets (user_id, title, description, priority, category_id, department_id, status, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [finalUserId, title, description, priority, category_id, department_id, 'open', location_id || null]
    );
    const newTicketId = result.insertId;

    if (req.files && req.files.length > 0) {
        const attachmentPromises = req.files.map(file => {
            const query = 'INSERT INTO ticket_attachments (ticket_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)';
            return pool.execute(query, [newTicketId, file.path, file.originalname, file.mimetype]);
        });
        await Promise.all(attachmentPromises);
    }

    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Nuevo ticket creado #${newTicketId}` });

    const message = `Nuevo ticket #${newTicketId} creado por ${creatorName}: "${title}"`;
    const [adminsAndAgents] = await pool.execute("SELECT id FROM users WHERE role IN ('admin', 'agent')");

    for (const user of adminsAndAgents) {
        if (user.id === loggedInUser.id) {
            continue;
        }

        const [notificationResult] = await pool.execute(
            'INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
            [user.id, message, 'ticket_created', newTicketId, 'ticket']
        );
        const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notificationResult.insertId]);
        if (newNotification) {
            req.io.to(`user-${user.id}`).emit('new_notification', newNotification);
        }
    }

    res.status(201).json({ success: true, message: 'Ticket creado exitosamente.', data: { id: newTicketId } });
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
    if (role === 'client') {
        // Un cliente solo ve sus tickets
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
    if (role === 'client' && ticket.user_id !== userId) { res.status(403); throw new Error('No tienes permiso para ver este ticket.'); }
    
    let commentsQuery = `
        SELECT c.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username, 'Usuario Eliminado') as username
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = ?
        ${role === 'client' ? ' AND c.is_internal = false' : ''}
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
    const { title, description, priority, category_id } = req.body;
    const fieldsToUpdate = []; 
    const params = [];
    if (title) { fieldsToUpdate.push('title = ?'); params.push(title); }
    if (description) { fieldsToUpdate.push('description = ?'); params.push(description); }
    if (priority) { fieldsToUpdate.push('priority = ?'); params.push(priority); }
    if (category_id) { fieldsToUpdate.push('category_id = ?'); params.push(category_id); }
    if (fieldsToUpdate.length === 0) { res.status(400); throw new Error("Debes proporcionar al menos un campo para actualizar."); }
    params.push(ticketId);
    const query = `UPDATE tickets SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    await pool.execute(query, params);
    res.status(200).json({ success: true, message: 'Ticket actualizado correctamente.' });
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

    const [tickets] = await pool.execute('SELECT user_id, title, status FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) {
        res.status(404);
        throw new Error('Ticket no encontrado');
    }
    const ticket = tickets[0];

    if (userRole === 'client') {
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

    if (newStatus === 'resolved' && currentUserId !== ticket.user_id) {
        const message = `Tu ticket #${ticketId}: "${ticket.title}" ha sido marcado como resuelto.`;
        const [notificationResult] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [ticket.user_id, message, 'ticket_resolved', ticketId, 'ticket']);
        const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notificationResult.insertId]);
        if (newNotification) {
            req.io.to(`user-${ticket.user_id}`).emit('new_notification', newNotification);
        }
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
    if (users.length === 0 || !['agent', 'admin'].includes(users[0].role)) { res.status(400); throw new Error('El usuario especificado no es un agente o administrador válido.'); }
    
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

    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Ticket #${ticketId} reasignado` });
    res.status(200).json({ success: true, message: `Ticket #${ticketId} reasignado exitosamente.` });
});

const addCommentToTicket = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { comment_text, is_internal } = req.body;
    const { id: commenterId, role: commenterRole } = req.user;

    if (!comment_text || comment_text.trim() === '') { res.status(400); throw new Error('El comentario no puede estar vacío.'); }

    const finalIsInternal = commenterRole !== 'client' && (is_internal === true || is_internal === 'true' || is_internal === 1);

    await pool.execute('INSERT INTO comments (ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, ?)', [ticketId, commenterId, comment_text, finalIsInternal]);

    if (!finalIsInternal) {
        const [ticketRows] = await pool.execute('SELECT user_id, assigned_to_user_id, title FROM tickets WHERE id = ?', [ticketId]);
        const ticket = ticketRows[0];
        let targetUserId, message;

        if (commenterRole === 'client' && ticket.assigned_to_user_id) {
            targetUserId = ticket.assigned_to_user_id;
            message = `Nuevo comentario del cliente en el ticket #${ticketId}: "${ticket.title}"`;
        } else if (commenterRole !== 'client' && ticket.user_id !== commenterId) {
            targetUserId = ticket.user_id;
            message = `Un agente ha respondido a tu ticket #${ticketId}: "${ticket.title}"`;
        }

        if (targetUserId) {
            const [result] = await pool.execute('INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)', [targetUserId, message, 'comment', ticketId, 'ticket']);
            const [[newNotification]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
            if (newNotification) {
                req.io.to(`user-${targetUserId}`).emit('new_notification', newNotification);
            }
        }
    }
    
    req.io.to('admin').to('agent').emit('dashboard_update', { message: `Nuevo comentario en ticket #${ticketId}` });
    res.status(201).json({ success: true, message: 'Comentario añadido exitosamente.' });
});

const getTicketComments = asyncHandler(async (req, res) => {
    const { id: ticketId } = req.params;
    const { role, id: userId } = req.user;
    const [ticket] = await pool.execute('SELECT user_id FROM tickets WHERE id = ?', [ticketId]);
    if (ticket.length === 0) { res.status(404); throw new Error('Ticket no encontrado'); }
    if (role === 'client' && ticket[0].user_id !== userId) { res.status(403); throw new Error('No tienes permiso para ver los comentarios de este ticket.'); }
    
    let query = `SELECT c.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username, 'Usuario Eliminado') as username 
                  FROM comments c 
                  LEFT JOIN users u ON c.user_id = u.id 
                  WHERE c.ticket_id = ?`;

    if (role === 'client') { query += ' AND c.is_internal = false'; }
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
    reassignTicket,
    getCategories,
    getDepartments,
};