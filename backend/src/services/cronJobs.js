const cron = require('node-cron');
const pool = require('../config/db');
const { closeResolvedTicketDueToInactivity } = require('./ticketAutoClose');

console.log('Módulo de tareas programadas (cron) inicializado.');

const closeOldResolvedTickets = async () => {
    console.log('[Cron Job] Ejecutando tarea: "Cerrar tickets resueltos antiguos"...');
    let connection;
    try {
        connection = await pool.getConnection();

        const [ticketsToClose] = await connection.execute(
            `SELECT t.id, t.user_id, t.title, t.assigned_to_user_id, u.email AS requester_email
             FROM tickets t
             LEFT JOIN users u ON t.user_id = u.id
             WHERE t.status = 'resolved' AND t.updated_at < NOW() - INTERVAL 48 HOUR`
        );

        if (ticketsToClose.length === 0) {
            console.log('[Cron Job] No se encontraron tickets para cerrar.');
            return;
        }

        console.log(`[Cron Job] Se encontraron ${ticketsToClose.length} tickets para cerrar.`);

        for (const ticket of ticketsToClose) {
            await closeResolvedTicketDueToInactivity(ticket, connection);
        }

        console.log(`[Cron Job] Tarea completada. Se cerraron ${ticketsToClose.length} tickets.`);

    } catch (error) {
        console.error('[Cron Job] Error al ejecutar la tarea de cierre de tickets:', error);
    } finally {
        if (connection) connection.release();
    }
};

const cronTask = cron.schedule('* * * * *', closeOldResolvedTickets);

const startCronJobs = () => {
    console.log('Iniciando tareas programadas...');
    cronTask.start();
};

module.exports = { startCronJobs, closeOldResolvedTickets };
