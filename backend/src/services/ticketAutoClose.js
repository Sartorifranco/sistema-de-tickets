const { notifyBacarnetTicketStatusChangeSafe } = require('./bacarnetWebhookService');

async function closeResolvedTicketDueToInactivity(ticket, connection) {
    await connection.execute(
        `UPDATE tickets SET status = 'closed', closure_reason = 'AUTO_INACTIVITY' WHERE id = ?`,
        [ticket.id]
    );

    const commentText = 'Este ticket ha sido cerrado automáticamente después de 48 horas sin actividad en estado "Resuelto".';
    await connection.execute(
        'INSERT INTO comments (ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, ?)',
        [ticket.id, null, commentText, false]
    );

    notifyBacarnetTicketStatusChangeSafe({
        stTicketId: ticket.id,
        status: 'closed',
        previousStatus: 'resolved',
        requesterEmail: ticket.requester_email || null,
        title: ticket.title,
        assignedToUserId: ticket.assigned_to_user_id,
        changedAt: new Date().toISOString(),
        source: 'cron',
    });
}

module.exports = { closeResolvedTicketDueToInactivity };
