/**
 * Servicio Centralizado de Notificaciones Omnicanal
 * Módulo de Compras - Fase 3
 * Email (Nodemailer), Push (FCM), WhatsApp (Twilio)
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { admin } = require('../config/firebase');

let twilioClient = null;
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('[NotificationService] Twilio WhatsApp configurado.');
    } catch (err) {
        console.warn('[NotificationService] Twilio no disponible:', err.message);
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: true },
});

/** Normaliza número para WhatsApp: +54 9 11 1234-5678 -> whatsapp:+5491112345678 */
const normalizeWhatsAppNumber = (num) => {
    if (!num || typeof num !== 'string') return null;
    let cleaned = num.replace(/\D/g, '');
    if (cleaned.length < 10) return null;
    if (cleaned.startsWith('54')) cleaned = cleaned;
    else if (cleaned.startsWith('9')) cleaned = '54' + cleaned;
    else if (cleaned.startsWith('0')) cleaned = '54' + cleaned.slice(1);
    else cleaned = '54' + cleaned;
    return `whatsapp:+${cleaned}`;
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3020';

// --- PLANTILLAS EMAIL ---
const templates = {
    bossNewRequest: (data) => ({
        subject: 'Nueva solicitud de compra para aprobar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📋 Nueva solicitud de compra</h2>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Solicitante:</strong> ${data.requesterUsername || 'N/A'}</p>
                <p><strong>Descripción:</strong> ${(data.description || '').slice(0, 200)}${(data.description || '').length > 200 ? '...' : ''}</p>
                <p style="margin-top: 20px;"><strong>Aprobar o rechazar en 1 clic (sin iniciar sesión):</strong></p>
                <a href="${data.magicApproveUrl || '#'}" style="background-color: #16A34A; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 8px; margin-right: 10px;">
                    ✓ Aprobar
                </a>
                <a href="${data.magicRejectUrl || '#'}" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 8px;">
                    ✗ Rechazar
                </a>
                <p style="margin-top: 16px; font-size: 12px; color: #666;">O ingrese al portal para más detalles:</p>
                <a href="${FRONTEND_URL}/purchases/approvals" style="color: #2563EB; text-decoration: underline; font-size: 14px;">Ver solicitudes</a>
            </div>
        `,
    }),
    purchasingRequestApproved: (data) => ({
        subject: 'Solicitud de compra aprobada por Jefatura',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>✅ Solicitud aprobada</h2>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Aprobada por:</strong> ${data.approvedBy || 'Jefatura'}</p>
                <a href="${FRONTEND_URL}/purchases/management" style="background-color: #16A34A; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Gestionar compras
                </a>
            </div>
        `,
    }),
    supplierQuoteRequest: (data) => ({
        subject: 'Solicitud de presupuesto - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📌 Nueva solicitud de presupuesto</h2>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Cantidad:</strong> ${data.quantity || 'N/A'}</p>
                <p><strong>Descripción:</strong> ${(data.description || '').slice(0, 300)}${(data.description || '').length > 300 ? '...' : ''}</p>
                <a href="${FRONTEND_URL}/login" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Ingresar al portal
                </a>
            </div>
        `,
    }),
    purchasingQuoteSubmitted: (data) => ({
        subject: 'Nuevo presupuesto recibido - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📋 Nuevo presupuesto recibido</h2>
                <p>Un proveedor ha enviado su cotización para:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Proveedor:</strong> ${data.supplierName || 'N/A'}</p>
                <p><strong>Precio:</strong> $${(data.price != null) ? Number(data.price).toLocaleString('es-AR') : 'N/A'}</p>
                <a href="${FRONTEND_URL}/purchases/management" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Ver presupuestos
                </a>
            </div>
        `,
    }),
    purchasingOrderShipped: (data) => ({
        subject: 'Pedido enviado por proveedor - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📦 Pedido enviado</h2>
                <p>El proveedor ha notificado que envió el pedido:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                ${data.shippingNotes ? `<p><strong>Detalles:</strong> ${data.shippingNotes}</p>` : ''}
                <a href="${FRONTEND_URL}/purchases/management" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Ver detalle
                </a>
            </div>
        `,
    }),
    supplierQuoteWinner: (data) => ({
        subject: '¡Felicitaciones! Su presupuesto fue seleccionado',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>🏆 Presupuesto ganador</h2>
                <p>Su cotización ha sido seleccionada para la siguiente solicitud:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p>Por favor, ingrese al portal para subir la factura correspondiente.</p>
                <a href="${FRONTEND_URL}/login" style="background-color: #16A34A; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Subir factura
                </a>
            </div>
        `,
    }),
    supplierQuoteReminder: (data) => ({
        subject: 'Recordatorio: Cotización pendiente - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📌 Recordatorio: Cotización pendiente</h2>
                <p>Tiene una solicitud de presupuesto pendiente de responder hace más de 48 horas:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Cantidad:</strong> ${data.quantity || 'N/A'}</p>
                <p><strong>Descripción:</strong> ${(data.description || '').slice(0, 200)}${(data.description || '').length > 200 ? '...' : ''}</p>
                <a href="${FRONTEND_URL}/login" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Enviar cotización
                </a>
            </div>
        `,
    }),
    supplierDeliveryReminder: (data) => ({
        subject: 'Recordatorio: Entrega pendiente - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>📦 Recordatorio de entrega</h2>
                <p>El pedido que ganó está en espera de entrega. La fecha tope es hoy o ya ha pasado:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Fecha tope:</strong> ${data.estimatedDeliveryDate || 'N/A'}</p>
                <a href="${FRONTEND_URL}/login" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Ver detalle
                </a>
            </div>
        `,
    }),
    purchasingRecurringOrder: (data) => ({
        subject: 'Pedido recurrente mensual generado - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>🔄 Pedido recurrente mensual</h2>
                <p>Se generó automáticamente una nueva solicitud idéntica al pedido recurrente:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Solicitante:</strong> ${data.requesterUsername || 'N/A'}</p>
                <a href="${FRONTEND_URL}/purchases/management" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Ver pedido
                </a>
            </div>
        `,
    }),
    purchasingDeliveryDelayed: (data) => ({
        subject: 'Alerta: Entrega demorada - Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>⚠️ Entrega demorada</h2>
                <p>La siguiente solicitud tiene fecha tope de entrega vencida o es hoy:</p>
                <p><strong>Producto/Servicio:</strong> ${data.productOrService || 'N/A'}</p>
                <p><strong>Proveedor:</strong> ${data.supplierName || 'N/A'}</p>
                <p><strong>Fecha tope:</strong> ${data.estimatedDeliveryDate || 'N/A'}</p>
                <a href="${FRONTEND_URL}/purchases/management" style="background-color: #DC2626; color: white; padding: 12px 25px; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                    Ver detalle
                </a>
            </div>
        `,
    }),
};

// --- Obtener preferencias de notificación del usuario ---
const getUserNotificationPrefs = async (userId) => {
    try {
        const [rows] = await pool.execute(
            'SELECT email, notification_email, whatsapp_number, push_enabled FROM users WHERE id = ?',
            [userId]
        );
        if (rows.length === 0) return null;
        const u = rows[0];
        return {
            email: (u.notification_email && String(u.notification_email).trim()) || u.email,
            whatsapp_number: (u.whatsapp_number && String(u.whatsapp_number).trim()) || null,
            push_enabled: u.push_enabled !== 0 && u.push_enabled !== false,
        };
    } catch (err) {
        console.error('[NotificationService] Error obteniendo prefs:', err.message);
        return null;
    }
};

// --- ENVÍO EMAIL ---
const sendPurchaseEmail = async (to, templateKey, data) => {
    try {
        const tpl = templates[templateKey]?.(data);
        if (!tpl || !to) {
            console.warn('[NotificationService] Email omitido: sin plantilla o destinatario.');
            return { ok: false };
        }
        const from = process.env.EMAIL_USER ? `"Compras BACAR" <${process.env.EMAIL_USER}>` : '"Compras BACAR" <noreply@bacarsa.com.ar>';
        await transporter.sendMail({
            from,
            to: String(to).trim(),
            subject: tpl.subject,
            html: tpl.html,
        });
        console.log(`[NotificationService] Email enviado a ${to} (${templateKey})`);
        return { ok: true };
    } catch (err) {
        console.error('[NotificationService] Error email:', err.message, err.code || '');
        return { ok: false, error: err.message };
    }
};

// --- PUSH FCM (fire-and-forget, respeta push_enabled) ---
const sendPushToUser = async (userId, title, body) => {
    try {
        if (!admin || !admin.apps?.length) return;
        const [rows] = await pool.execute(
            'SELECT fcm_token, push_enabled FROM users WHERE id = ? AND fcm_token IS NOT NULL',
            [userId]
        );
        if (rows.length === 0 || !rows[0].fcm_token) return;
        if (rows[0].push_enabled === 0 || rows[0].push_enabled === false) return;
        const token = rows[0].fcm_token;
        await admin.messaging().send({
            token,
            notification: { title, body },
            data: { type: 'purchase', userId: String(userId) },
        });
        console.log(`[NotificationService] Push enviado a user ${userId}`);
    } catch (err) {
        console.error('[NotificationService] Error push:', err.message);
    }
};

// --- WHATSAPP (Twilio) ---
const sendWhatsApp = async (numero, mensaje) => {
    if (!numero || !mensaje) return;
    const toNumber = normalizeWhatsAppNumber(numero);
    if (!toNumber) {
        console.warn('[NotificationService] Número WhatsApp inválido:', numero);
        return;
    }
    if (twilioClient) {
        try {
            const from = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;
            await twilioClient.messages.create({
                body: mensaje,
                from,
                to: toNumber,
            });
            console.log(`[NotificationService] WhatsApp enviado a ${toNumber}`);
        } catch (err) {
            console.error('[NotificationService] Error WhatsApp:', err.message);
        }
    } else {
        console.warn('[WhatsApp] Twilio no configurado. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM en .env');
    }
};

// Alias para compatibilidad
const sendWhatsAppMessage = sendWhatsApp;

// --- NOTIFICAR OMNICANAL (lee preferencias del usuario; fallback a email si prefs es null) ---
const notifyUserWithPrefs = async (userId, { emailTemplate, emailData, pushTitle, pushBody, whatsappMessage }) => {
    let prefs = await getUserNotificationPrefs(userId);
    if (!prefs) {
        // Fallback: enviar al menos por email principal del usuario
        try {
            const [rows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
            if (rows.length > 0 && rows[0].email) {
                prefs = {
                    email: rows[0].email,
                    whatsapp_number: null,
                    push_enabled: true
                };
            } else {
                return;
            }
        } catch (err) {
            console.error('[NotificationService] Error fallback prefs:', err.message);
            return;
        }
    }

    const promises = [];
    if (prefs.email && emailTemplate) {
        promises.push(sendPurchaseEmail(prefs.email, emailTemplate, emailData));
    }
    if (prefs.push_enabled && pushTitle && pushBody) {
        promises.push(sendPushToUser(userId, pushTitle, pushBody));
    }
    if (prefs.whatsapp_number && whatsappMessage) {
        setImmediate(() => sendWhatsApp(prefs.whatsapp_number, whatsappMessage).catch(() => {}));
    }
    if (promises.length > 0) {
        Promise.all(promises).catch(() => {});
    }
};

// --- NOTIFICAR POR EMAIL Y PUSH (compatibilidad) ---
const notifyUser = async (userId, { emailTo, emailTemplate, emailData, pushTitle, pushBody }) => {
    const promises = [];
    if (emailTo && emailTemplate) {
        promises.push(sendPurchaseEmail(emailTo, emailTemplate, emailData));
    }
    if (pushTitle && pushBody) {
        promises.push(sendPushToUser(userId, pushTitle, pushBody));
    }
    if (promises.length > 0) {
        Promise.all(promises).catch(() => {});
    }
};

// --- VERIFICACIÓN DE CONFIGURACIÓN (para pruebas y diagnóstico) ---
const getNotificationConfigStatus = async () => {
    const status = { email: {}, push: {}, whatsapp: {} };

    try {
        const hasVars = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
        let smtpOk = false;
        let smtpError = null;
        if (hasVars) {
            const verify = await verifyEmailConnection();
            smtpOk = verify.ok;
            smtpError = verify.error || null;
        }
        status.email = {
            configured: hasVars && smtpOk,
            hasHost: !!process.env.EMAIL_HOST,
            hasUser: !!process.env.EMAIL_USER,
            hasPass: !!process.env.EMAIL_PASS,
            smtpVerified: smtpOk,
            message: !hasVars
                ? 'Faltan EMAIL_HOST, EMAIL_USER o EMAIL_PASS en .env. Gmail: use contraseña de aplicación.'
                : smtpOk
                    ? 'SMTP conectado correctamente'
                    : smtpError || 'Error al conectar con el servidor SMTP',
        };
    } catch (e) {
        status.email = { configured: false, message: e.message };
    }

    try {
        const hasFirebase = !!(admin && admin.apps && admin.apps.length > 0);
        let usersWithFcm = 0;
        if (hasFirebase && pool) {
            const [rows] = await pool.execute(
                'SELECT COUNT(*) as c FROM users WHERE fcm_token IS NOT NULL AND fcm_token != ""'
            );
            usersWithFcm = rows[0]?.c || 0;
        }
        status.push = {
            configured: hasFirebase,
            firebaseCredentials: !!process.env.FIREBASE_CREDENTIALS,
            usersWithFcmToken: usersWithFcm,
            message: hasFirebase
                ? `Firebase OK. ${usersWithFcm} usuario(s) con FCM token.`
                : 'Configure FIREBASE_CREDENTIALS y que los usuarios registren el token.',
        };
    } catch (e) {
        status.push = { configured: false, message: e.message };
    }

    try {
        const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
        const sandboxJoinCode = process.env.TWILIO_WHATSAPP_SANDBOX_JOIN_CODE || '';
        const sandboxNumber = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').replace('whatsapp:', '').trim();
        status.whatsapp = {
            configured: !!twilioClient,
            hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
            hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
            twilioClient: !!twilioClient,
            sandboxNumber: sandboxNumber || '+1 415 523 8886',
            sandboxJoinCode: sandboxJoinCode || null,
            message: twilioClient
                ? 'Twilio WhatsApp configurado'
                : hasTwilio
                    ? 'Credenciales presentes pero cliente no inicializado'
                    : 'Faltan TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env. Sandbox: TWILIO_WHATSAPP_FROM=whatsapp:+14155238886',
        };
    } catch (e) {
        status.whatsapp = { configured: false, message: e.message };
    }

    return status;
};

// --- Verificar conexión SMTP (Gmail: usar contraseña de aplicación, EMAIL_PASS entre comillas si tiene espacios) ---
const verifyEmailConnection = async () => {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return { ok: false, error: 'Faltan EMAIL_HOST, EMAIL_USER o EMAIL_PASS en .env' };
    }
    try {
        await transporter.verify();
        return { ok: true };
    } catch (err) {
        const msg = (err.message || '').toLowerCase();
        let hint = '';
        if (msg.includes('invalid login') || msg.includes('authentication failed') || msg.includes('535')) {
            hint = ' Gmail: use contraseña de aplicación (App Password). Si tiene espacios, ponga EMAIL_PASS entre comillas en .env.';
        } else if (msg.includes('self signed') || msg.includes('certificate')) {
            hint = ' Problema de certificado TLS.';
        }
        return { ok: false, error: (err.message || 'Error SMTP') + hint };
    }
};

// --- Enviar email de prueba ---
const sendTestEmail = async (toEmail) => {
    const email = String(toEmail || '').trim();
    if (!email || !email.includes('@')) return { ok: false, error: 'Email inválido.' };
    const verify = await verifyEmailConnection();
    if (!verify.ok) return verify;
    const testTpl = {
        subject: 'Prueba de notificaciones - Compras BACAR',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Correo de prueba</h2>
                <p>Si recibió este mensaje, las notificaciones por email están configuradas correctamente.</p>
                <p><a href="${FRONTEND_URL}">Ir al sistema</a></p>
            </div>
        `,
    };
    try {
        const from = process.env.EMAIL_USER ? `"Compras BACAR" <${process.env.EMAIL_USER}>` : '"Compras BACAR"';
        await transporter.sendMail({ from, to: email, subject: testTpl.subject, html: testTpl.html });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message || 'Error al enviar.' };
    }
};

// --- Enviar mensaje de prueba por WhatsApp ---
const sendTestWhatsApp = async (phoneNumber) => {
    if (!phoneNumber || !twilioClient) return { ok: false, error: 'WhatsApp no configurado o número inválido.' };
    const toNumber = normalizeWhatsAppNumber(phoneNumber);
    if (!toNumber) return { ok: false, error: 'Número inválido. Use formato con código de país, ej: +54 9 11 1234-5678' };
    try {
        const from = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;
        await twilioClient.messages.create({
            body: '🔔 Mensaje de prueba - Sistema de Compras BACAR. Si recibió esto, WhatsApp está configurado correctamente.',
            from,
            to: toNumber,
        });
        return { ok: true };
    } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('63016') || msg.includes('not in your sandbox') || msg.includes('not connected') || msg.includes('connect it first')) {
            return { ok: false, error: 'Este número no está unido al sandbox. Desde WhatsApp (con ese mismo número), envíe "join [código]" al +1 415 523 8886. Vea las instrucciones en su perfil.' };
        }
        return { ok: false, error: err.message || 'Error al enviar.' };
    }
};

module.exports = {
    sendPurchaseEmail,
    sendPushToUser,
    sendWhatsApp,
    sendWhatsAppMessage,
    notifyUser,
    notifyUserWithPrefs,
    getUserNotificationPrefs,
    getNotificationConfigStatus,
    verifyEmailConnection,
    sendTestEmail,
    sendTestWhatsApp,
    templates,
};
