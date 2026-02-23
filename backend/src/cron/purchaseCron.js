/**
 * "El Perseguidor Automático" - Cron jobs para el Módulo de Compras
 * Ejecuta: Lunes a Viernes a las 9:00 AM
 */
const cron = require('node-cron');
const admin = require('firebase-admin');
const { db } = require('../config/firebase');
const { notifyUserWithPrefs } = require('../services/notificationService');
const pool = require('../config/db');

const serverTimestamp = () => {
    try {
        return admin.firestore.FieldValue.serverTimestamp();
    } catch {
        return new Date();
    }
};

const CRON_SCHEDULE = '0 9 * * 1-5'; // 9:00 AM, Lunes a Viernes
const CRON_RECURRING = '0 9 1 * *';  // 9:00 AM, día 1 de cada mes
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Tarea 1: Reclamo de presupuestos pendientes (>48h sin responder)
 */
async function taskQuoteReminder() {
    if (!db) return;
    try {
        const cutoff = new Date(Date.now() - FORTY_EIGHT_HOURS_MS);
        const snapshot = await db.collection('purchase_quotes')
            .where('status', '==', 'pending')
            .limit(100)
            .get();

        let sent = 0;
        for (const doc of snapshot.docs) {
            try {
                const d = doc.data();
                if (d.quote_reminder_sent === true) continue;

                const createdAt = d.createdAt?.toDate?.();
                if (!createdAt || createdAt > cutoff) continue;

                const reqSnap = await db.collection('purchase_requests').doc(d.purchaseRequestId).get();
                const reqData = reqSnap.exists ? reqSnap.data() : {};

                const emailData = {
                    productOrService: reqData.productOrService || 'Solicitud',
                    quantity: reqData.quantity || 'N/A',
                    description: reqData.description || ''
                };

                await notifyUserWithPrefs(Number(d.supplierId), {
                    emailTemplate: 'supplierQuoteReminder',
                    emailData,
                    pushTitle: 'Recordatorio: Cotización pendiente',
                    pushBody: reqData.productOrService || 'Solicitud de presupuesto',
                    whatsappMessage: `Recordatorio: Tiene una cotización pendiente: ${reqData.productOrService}`
                });

                await doc.ref.update({
                    quote_reminder_sent: true,
                    quote_reminder_sent_at: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                sent++;
            } catch (err) {
                console.error('[PurchaseCron] Error recordatorio cotización', doc.id, err.message);
            }
        }
        if (sent > 0) {
            console.log(`[PurchaseCron] Tarea 1: ${sent} recordatorios de cotización enviados.`);
        }
    } catch (err) {
        console.error('[PurchaseCron] Error Tarea 1 (quote reminder):', err.message);
    }
}

/**
 * Tarea 2: Alerta de entregas demoradas (fecha tope hoy o vencida)
 */
async function taskDeliveryAlert() {
    if (!db) return;
    try {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

        const snapshot = await db.collection('purchase_requests')
            .where('status', '==', 'Esperando entrega')
            .limit(100)
            .get();

        let supplierSent = 0;
        let purchasingSent = 0;

        for (const doc of snapshot.docs) {
            try {
                const data = doc.data();
                if (data.delivery_reminder_sent === true) continue;

                const estDate = data.estimatedDeliveryDate;
                let isDue = false;
                if (estDate) {
                    if (typeof estDate === 'string') {
                        isDue = estDate <= todayStr;
                    } else {
                        const d = (estDate && typeof estDate.toDate === 'function')
                            ? estDate.toDate()
                            : new Date(estDate);
                        isDue = d <= today;
                    }
                }
                if (!isDue) continue;

                let supplierId = data.winningSupplierId;
                let supplierName = 'Proveedor';
                if (data.winningQuoteId) {
                    const qSnap = await db.collection('purchase_quotes').doc(data.winningQuoteId).get();
                    if (qSnap.exists) {
                        const q = qSnap.data();
                        supplierId = supplierId || q.supplierId;
                        supplierName = q.supplierName || q.supplierEmail || supplierName;
                    }
                }
                if (Array.isArray(data.itemWinners) && data.itemWinners.length > 0 && !supplierId) {
                    const firstWinner = data.itemWinners.find(w => w.quoteId && w.quoteId !== '__none__');
                    if (firstWinner) {
                        const qSnap = await db.collection('purchase_quotes').doc(firstWinner.quoteId).get();
                        if (qSnap.exists) {
                            const q = qSnap.data();
                            supplierId = q.supplierId;
                            supplierName = q.supplierName || q.supplierEmail || supplierName;
                        }
                    }
                }
                const productOrService = data.productOrService || 'Solicitud';
                const emailData = {
                    productOrService,
                    estimatedDeliveryDate: typeof estDate === 'string' ? estDate : (estDate?.toDate?.()?.toISOString?.()?.slice(0, 10) || 'N/A'),
                    supplierName
                };

                if (supplierId) {
                    try {
                        await notifyUserWithPrefs(Number(supplierId), {
                            emailTemplate: 'supplierDeliveryReminder',
                            emailData,
                            pushTitle: 'Recordatorio de entrega',
                            pushBody: productOrService,
                            whatsappMessage: `Recordatorio: Entrega pendiente - ${productOrService}`
                        });
                        supplierSent++;
                    } catch (e) {
                        console.error('[PurchaseCron] Error email proveedor:', e.message);
                    }
                }

                const [purchasingUsers] = await pool.execute(
                    "SELECT id FROM users WHERE role = 'purchasing'"
                );
                for (const p of purchasingUsers) {
                    try {
                        await notifyUserWithPrefs(p.id, {
                            emailTemplate: 'purchasingDeliveryDelayed',
                            emailData,
                            pushTitle: 'Entrega demorada',
                            pushBody: `${productOrService} - ${supplierName}`,
                            whatsappMessage: `Alerta: Entrega demorada - ${productOrService} (${supplierName})`
                        });
                        purchasingSent++;
                    } catch (e) {
                        console.error('[PurchaseCron] Error email compras:', e.message);
                    }
                }

                await doc.ref.update({
                    delivery_reminder_sent: true,
                    delivery_reminder_sent_at: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            } catch (err) {
                console.error('[PurchaseCron] Error Tarea 2 para', doc.id, err.message);
            }
        }
        if (supplierSent > 0 || purchasingSent > 0) {
            console.log(`[PurchaseCron] Tarea 2: Alertas de entrega enviadas.`);
        }
    } catch (err) {
        console.error('[PurchaseCron] Error Tarea 2 (delivery alert):', err.message);
    }
}

/**
 * Tarea 3: Clonar compras recurrentes mensuales (día 1 de cada mes)
 * Busca is_recurring: true, no Rechazadas, y crea copia con estado Recibido
 */
async function taskRecurringClones() {
    if (!db) return;
    try {
        const snapshot = await db.collection('purchase_requests')
            .where('is_recurring', '==', true)
            .get();

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let cloned = 0;
        for (const doc of snapshot.docs) {
            try {
                const data = doc.data();
                if (data.status === 'Rechazado') continue;
                if (data.parentPurchaseId) continue; // No clonar a los hijos

                const lastCloneAt = data.lastRecurringCloneAt?.toDate?.();
                if (lastCloneAt && lastCloneAt >= thisMonthStart) continue; // Ya clonado este mes

                const cloneData = {
                    items: data.items || [],
                    productOrService: data.productOrService,
                    description: data.description,
                    quantity: data.quantity,
                    rubro: data.rubro || null,
                    referenceLink: data.referenceLink || null,
                    deliveryDeadline: data.deliveryDeadline || null,
                    imageUrl: null,
                    status: 'Recibido',
                    userId: data.userId,
                    departmentId: data.departmentId,
                    requesterUsername: data.requesterUsername || 'Desconocido',
                    is_recurring: false,
                    parentPurchaseId: doc.id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await db.collection('purchase_requests').add(cloneData);

                await doc.ref.update({
                    lastRecurringCloneAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                const [purchasingUsers] = await pool.execute(
                    "SELECT id FROM users WHERE role = 'purchasing'"
                );
                for (const p of purchasingUsers) {
                    try {
                        await notifyUserWithPrefs(p.id, {
                            emailTemplate: 'purchasingRecurringOrder',
                            emailData: {
                                productOrService: data.productOrService,
                                requesterUsername: data.requesterUsername
                            },
                            pushTitle: 'Pedido recurrente mensual',
                            pushBody: data.productOrService || 'Nueva solicitud generada',
                            whatsappMessage: `Pedido recurrente: ${data.productOrService}`
                        });
                    } catch (e) {
                        console.error('[PurchaseCron] Error notificar compras recurrente:', e.message);
                    }
                }
                cloned++;
            } catch (err) {
                console.error('[PurchaseCron] Error clonar recurrente', doc.id, err.message);
            }
        }
        if (cloned > 0) {
            console.log(`[PurchaseCron] Tarea 3: ${cloned} pedidos recurrentes clonados.`);
        }
    } catch (err) {
        console.error('[PurchaseCron] Error Tarea 3 (recurring clones):', err.message);
    }
}

/**
 * Ejecuta todas las tareas con try/catch global
 */
async function runPurchaseCron() {
    console.log('[PurchaseCron] Ejecutando "El Perseguidor Automático"...');
    try {
        await taskQuoteReminder();
    } catch (e) {
        console.error('[PurchaseCron] Error en Tarea 1:', e.message);
    }
    try {
        await taskDeliveryAlert();
    } catch (e) {
        console.error('[PurchaseCron] Error en Tarea 2:', e.message);
    }
    console.log('[PurchaseCron] Finalizado.');
}

let purchaseCronTask = null;
let recurringCronTask = null;

function startPurchaseCrons() {
    if (purchaseCronTask) return;
    purchaseCronTask = cron.schedule(CRON_SCHEDULE, () => {
        runPurchaseCron().catch(err => {
            console.error('[PurchaseCron] Error global:', err.message);
        });
    });
    recurringCronTask = cron.schedule(CRON_RECURRING, () => {
        taskRecurringClones().catch(err => {
            console.error('[PurchaseCron] Error recurrente:', err.message);
        });
    });
    console.log('[PurchaseCron] Programado: Lunes a Viernes 9:00 AM + Recurrente día 1 a las 9:00 AM.');
}

module.exports = { startPurchaseCrons, runPurchaseCron };
