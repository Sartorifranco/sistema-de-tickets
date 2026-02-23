/**
 * Helper para disparar notificaciones del Módulo de Compras
 * Fire-and-forget: no bloquea la respuesta de la API
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { notifyUserWithPrefs } = require('../services/notificationService');

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 5042}`;

const generateMagicToken = (purchaseId, bossId, action) => {
    return jwt.sign(
        { purchaseId, bossId, action },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
    );
};

const fireAndForget = (fn) => {
    setImmediate(() => {
        fn().catch(err => console.error('[PurchaseNotifications]', err.message));
    });
};

const createAndEmitNotification = async (userId, message, type, relatedId, relatedType, io) => {
    try {
        const [r] = await pool.execute(
            'INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
            [userId, message, type, relatedId || null, relatedType || null]
        );
        const [[n]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [r.insertId]);
        if (io && n) {
            io.to(`user-${userId}`).emit('new_notification', n);
        }
    } catch (err) {
        console.error('[PurchaseNotifications] Error createAndEmitNotification:', err.message);
    }
};

// a) Empleado crea solicitud -> Avisar al Jefe del departamento (con Magic Links)
const notifyBossNewRequest = (io, purchaseData) => {
    fireAndForget(async () => {
        const [bosses] = await pool.execute(
            "SELECT id FROM users WHERE role = 'boss' AND department_id = ?",
            [purchaseData.departmentId || 0]
        );
        for (const b of bosses) {
            const approveToken = generateMagicToken(purchaseData.purchaseId, b.id, 'approve');
            const rejectToken = generateMagicToken(purchaseData.purchaseId, b.id, 'reject');
            const magicApproveUrl = `${API_URL}/api/purchases/magic-approve/${approveToken}`;
            const magicRejectUrl = `${API_URL}/api/purchases/magic-reject/${rejectToken}`;

            await createAndEmitNotification(
                b.id,
                `Nueva solicitud: ${purchaseData.productOrService} - ${purchaseData.requesterUsername}`,
                'purchase_new_request',
                purchaseData.purchaseId,
                'purchase',
                io
            );
            await notifyUserWithPrefs(b.id, {
                emailTemplate: 'bossNewRequest',
                emailData: {
                    ...purchaseData,
                    magicApproveUrl,
                    magicRejectUrl
                },
                pushTitle: 'Nueva solicitud de compra',
                pushBody: purchaseData.productOrService,
                whatsappMessage: `Nueva solicitud de compra: ${purchaseData.productOrService}`,
            });
        }
    });
};

// b) Jefe aprueba -> Avisar a Compras
const notifyPurchasingApproved = (io, purchaseData) => {
    fireAndForget(async () => {
        const [purchasing] = await pool.execute(
            "SELECT id FROM users WHERE role = 'purchasing'"
        );
        for (const p of purchasing) {
            await createAndEmitNotification(
                p.id,
                `Solicitud aprobada: ${purchaseData.productOrService}`,
                'purchase_approved',
                purchaseData.purchaseId,
                'purchase',
                io
            );
            await notifyUserWithPrefs(p.id, {
                emailTemplate: 'purchasingRequestApproved',
                emailData: purchaseData,
                pushTitle: 'Solicitud aprobada',
                pushBody: purchaseData.productOrService,
                whatsappMessage: `Solicitud aprobada: ${purchaseData.productOrService}`,
            });
        }
    });
};

// c) Compras pide presupuestos -> Avisar Proveedores
const notifySuppliersQuoteRequest = (io, purchaseData, suppliers) => {
    fireAndForget(async () => {
        for (const s of suppliers) {
            await createAndEmitNotification(
                s.id,
                `Nueva solicitud de presupuesto: ${purchaseData.productOrService}`,
                'purchase_quote_request',
                purchaseData.purchaseId,
                'purchase',
                io
            );
            await notifyUserWithPrefs(s.id, {
                emailTemplate: 'supplierQuoteRequest',
                emailData: purchaseData,
                pushTitle: 'Nueva solicitud de presupuesto',
                pushBody: purchaseData.productOrService,
                whatsappMessage: `Nueva solicitud de presupuesto: ${purchaseData.productOrService}`,
            });
        }
    });
};

// d) Proveedor envía cotización -> Avisar a Compras
const notifyPurchasingQuoteSubmitted = (io, purchaseData) => {
    fireAndForget(async () => {
        const [purchasing] = await pool.execute(
            "SELECT id FROM users WHERE role = 'purchasing'"
        );
        for (const p of purchasing) {
            await createAndEmitNotification(
                p.id,
                `Nuevo presupuesto recibido: ${purchaseData.productOrService} - ${purchaseData.supplierName}`,
                'purchase_quote_submitted',
                purchaseData.purchaseId,
                'purchase',
                io
            );
            await notifyUserWithPrefs(p.id, {
                emailTemplate: 'purchasingQuoteSubmitted',
                emailData: purchaseData,
                pushTitle: 'Nuevo presupuesto recibido',
                pushBody: `${purchaseData.productOrService} - ${purchaseData.supplierName}`,
                whatsappMessage: `Nuevo presupuesto: ${purchaseData.productOrService} - ${purchaseData.supplierName}`,
            });
        }
    });
};

// e) Proveedor marca pedido como enviado -> Avisar a Compras
const notifyPurchasingOrderShipped = (io, purchaseData) => {
    fireAndForget(async () => {
        try {
            const [purchasing] = await pool.execute(
                "SELECT id FROM users WHERE role = 'purchasing'"
            );
            if (purchasing.length === 0) {
                console.warn('[PurchaseNotifications] No hay usuarios con rol purchasing para notificar.');
            }
            for (const p of purchasing) {
                try {
                    await notifyUserWithPrefs(p.id, {
                        emailTemplate: 'purchasingOrderShipped',
                        emailData: purchaseData,
                        pushTitle: 'Pedido enviado',
                        pushBody: purchaseData.productOrService,
                        whatsappMessage: `Pedido enviado: ${purchaseData.productOrService}`,
                    });
                } catch (err) {
                    console.error('[PurchaseNotifications] Error notifyUserWithPrefs (order shipped):', err.message);
                }
                await createAndEmitNotification(
                    p.id,
                    `Pedido enviado por proveedor: ${purchaseData.productOrService}`,
                    'purchase_order_shipped',
                    purchaseData.purchaseId,
                    'purchase',
                    io
                );
            }
        } catch (err) {
            console.error('[PurchaseNotifications] notifyPurchasingOrderShipped:', err.message);
        }
    });
};

// f) Compras elige ganador -> Avisar Proveedor ganador
const notifySupplierWinner = (io, purchaseData, supplier) => {
    fireAndForget(async () => {
        await createAndEmitNotification(
            supplier.id,
            `¡Su presupuesto fue seleccionado! ${purchaseData.productOrService}`,
            'purchase_quote_winner',
            purchaseData.purchaseId,
            'purchase',
            io
        );
        await notifyUserWithPrefs(supplier.id, {
            emailTemplate: 'supplierQuoteWinner',
            emailData: purchaseData,
            pushTitle: 'Presupuesto ganador',
            pushBody: purchaseData.productOrService,
            whatsappMessage: `Su presupuesto fue seleccionado: ${purchaseData.productOrService}`,
        });
    });
};

module.exports = {
    notifyBossNewRequest,
    notifyPurchasingApproved,
    notifySuppliersQuoteRequest,
    notifyPurchasingQuoteSubmitted,
    notifyPurchasingOrderShipped,
    notifySupplierWinner,
};
