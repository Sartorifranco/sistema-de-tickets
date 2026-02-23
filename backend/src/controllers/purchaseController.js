/**
 * Controlador del Módulo de Compras
 * Firestore: purchase_requests, purchase_quotes
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { db, bucket } = require('../config/firebase');
const admin = require('firebase-admin');
const pool = require('../config/db');
const {
    notifyBossNewRequest,
    notifyPurchasingApproved,
    notifySuppliersQuoteRequest,
    notifyPurchasingQuoteSubmitted,
    notifyPurchasingOrderShipped,
    notifySupplierWinner,
} = require('../utils/purchaseNotificationHelper');
const { getHistoricalPricesForItems } = require('../utils/historicalPriceHelper');

// Solo empleados Bacar pueden crear/listar solicitudes de compra (clientes de otras empresas solo tickets)
const isBacarEmployee = (user) => {
    if (!user) return false;
    if (['admin', 'agent', 'boss', 'purchasing'].includes(user.role)) return true;
    if (user.role === 'client' && user.company_name && String(user.company_name).toLowerCase().includes('bacar')) return true;
    return false;
};

// @desc    Crear solicitud de compra
// @route   POST /api/purchases
// @access  Private (todos los usuarios autenticados)
const createPurchaseRequest = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible. Configure FIREBASE_CREDENTIALS.'
        });
        return;
    }
    if (!isBacarEmployee(req.user)) {
        res.status(403).json({
            success: false,
            message: 'Solo empleados de Bacar pueden crear solicitudes de compra. Las otras empresas solo pueden usar el módulo de tickets.'
        });
        return;
    }

    const { items: rawItems, rubro: reqRubro, referenceLink: reqRefLink, deliveryDeadline: reqDeadline, is_recurring: isRecurring } = req.body;
    const { id: userId, department_id: departmentId, username } = req.user;

    const items = Array.isArray(rawItems) ? rawItems : [];
    if (items.length === 0 || items.length > 20) {
        res.status(400).json({
            success: false,
            message: 'Debe enviar entre 1 y 20 ítems. Cada ítem debe tener producto, cantidad y descripción.'
        });
        return;
    }

    const validatedItems = items
        .map((it) => ({
            producto: String(it.producto || '').trim(),
            cantidad: Math.max(1, parseInt(it.cantidad, 10) || 1),
            descripcion: String(it.descripcion || '').trim()
        }))
        .filter((it) => it.producto && it.descripcion);

    if (validatedItems.length === 0) {
        res.status(400).json({
            success: false,
            message: 'Cada ítem debe tener producto y descripción.'
        });
        return;
    }
    if (validatedItems.length !== items.length) {
        res.status(400).json({
            success: false,
            message: 'Complete producto y descripción en todos los ítems.'
        });
        return;
    }

    const rubro = reqRubro && String(reqRubro).trim() ? String(reqRubro).trim() : null;
    if (!rubro) {
        res.status(400).json({
            success: false,
            message: 'El Rubro de Compra es obligatorio.'
        });
        return;
    }

    const productOrService = validatedItems.length === 1
        ? validatedItems[0].producto
        : `Solicitud (${validatedItems.length} ítems)`;
    const description = validatedItems.map((i) => `${i.producto}: ${i.descripcion}`).join(' | ');
    const quantity = validatedItems.reduce((sum, i) => sum + i.cantidad, 0);

    try {
        const docRef = await db.collection('purchase_requests').add({
            items: validatedItems,
            productOrService,
            description,
            quantity,
            rubro,
            referenceLink: reqRefLink ? String(reqRefLink).trim() : null,
            deliveryDeadline: reqDeadline || null,
            imageUrl: null,
            status: 'Pendiente Aprobación Jefe',
            userId: Number(userId),
            departmentId: departmentId ? Number(departmentId) : null,
            requesterUsername: username || 'Desconocido',
            is_recurring: !!isRecurring,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const purchaseData = {
            purchaseId: docRef.id,
            productOrService,
            description,
            quantity,
            requesterUsername: username || 'Desconocido',
            departmentId: departmentId ? Number(departmentId) : null,
        };
        notifyBossNewRequest(req.io, purchaseData);

        res.status(201).json({
            success: true,
            message: 'Solicitud de compra creada correctamente.',
            data: { id: docRef.id }
        });
    } catch (error) {
        console.error('[PurchaseController] Error crear solicitud:', error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar la solicitud de compra.'
        });
    }
});

// @desc    Obtener mis solicitudes de compra
// @route   GET /api/purchases
// @access  Private
const getMyPurchases = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible. Configure FIREBASE_CREDENTIALS.'
        });
        return;
    }
    if (!isBacarEmployee(req.user)) {
        res.status(403).json({
            success: false,
            message: 'Solo empleados de Bacar pueden acceder a las solicitudes de compra.'
        });
        return;
    }

    const userId = Number(req.user?.id);
    if (!userId || isNaN(userId)) {
        res.status(400).json({
            success: false,
            message: 'Usuario no válido.'
        });
        return;
    }

    try {
        const snapshot = await db.collection('purchase_requests')
            .where('userId', '==', userId)
            .get();

        const purchases = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt
                };
            })
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

        res.status(200).json({
            success: true,
            data: purchases
        });
    } catch (error) {
        console.error('[PurchaseController] Error listar solicitudes:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las solicitudes de compra.'
        });
    }
});

// @desc    Obtener solicitudes pendientes de aprobación (solo Jefes)
// @route   GET /api/purchases/pending-approvals
// @access  Private (rol boss)
const getPendingApprovals = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible. Configure FIREBASE_CREDENTIALS.'
        });
        return;
    }

    const { department_id: departmentId } = req.user;
    if (!departmentId) {
        res.status(400).json({
            success: false,
            message: 'El jefe debe tener un departamento asignado.'
        });
        return;
    }

    try {
        const snapshot = await db.collection('purchase_requests')
            .where('status', '==', 'Pendiente Aprobación Jefe')
            .where('departmentId', '==', Number(departmentId))
            .get();

        const requests = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt
                };
            })
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

        res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('[PurchaseController] Error getPendingApprovals:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las solicitudes pendientes.'
        });
    }
});

// @desc    Aprobar o rechazar solicitud (solo Jefes)
// @route   PUT /api/purchases/:id/approve
// @access  Private (rol boss)
const approveRequest = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible. Configure FIREBASE_CREDENTIALS.'
        });
        return;
    }

    const { id } = req.params;
    const { approved } = req.body; // boolean: true = aprobar, false = rechazar
    const { department_id: departmentId, username } = req.user;

    if (!departmentId) {
        res.status(400).json({
            success: false,
            message: 'El jefe debe tener un departamento asignado.'
        });
        return;
    }

    if (typeof approved !== 'boolean') {
        res.status(400).json({
            success: false,
            message: 'Debe especificar "approved" (true o false).'
        });
        return;
    }

    try {
        const docRef = db.collection('purchase_requests').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada.'
            });
            return;
        }

        const data = docSnap.data();
        if (Number(data.departmentId) !== Number(departmentId)) {
            res.status(403).json({
                success: false,
                message: 'Solo puede aprobar solicitudes de su departamento.'
            });
            return;
        }

        if (data.status !== 'Pendiente Aprobación Jefe') {
            res.status(400).json({
                success: false,
                message: 'La solicitud ya fue procesada.'
            });
            return;
        }

        const newStatus = approved ? 'Aprobado por Jefe' : 'Rechazado';
        await docRef.update({
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: username || req.user.id,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (approved) {
            notifyPurchasingApproved(req.io, {
                productOrService: data.productOrService,
                approvedBy: username || req.user.id,
                purchaseId: id,
            });
        }

        res.status(200).json({
            success: true,
            message: approved ? 'Solicitud aprobada.' : 'Solicitud rechazada.',
            data: { id, status: newStatus }
        });
    } catch (error) {
        console.error('[PurchaseController] Error approveRequest:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la aprobación.'
        });
    }
});

// Estados permitidos para el Encargado de Compras
const PURCHASING_STATUSES = [
    'Aprobado por Jefe',
    'Recibido',
    'Esperando presupuesto',
    'Compra Aprobada',
    'Esperando entrega',
    'Entregado',
    'Conforme / Cerrado'
];

// Estados considerados "nuevos" (recién aprobadas)
const NEW_STATUSES = ['Aprobado por Jefe', 'Recibido'];

// @desc    Dashboard por áreas (solo Encargado de Compras)
// @route   GET /api/purchases/dashboard
// @access  Private (rol purchasing)
const getPurchasesDashboard = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible.'
        });
        return;
    }

    try {
        const snapshot = await db.collection('purchase_requests')
            .where('status', 'in', ['Aprobado por Jefe', 'Recibido', 'Esperando presupuesto', 'Compra Aprobada', 'Esperando entrega', 'Entregado', 'Conforme / Cerrado'])
            .get();

        const purchases = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                departmentId: data.departmentId || null
            };
        });

        const deptIds = [...new Set(purchases.map(p => p.departmentId).filter(Boolean))];
        let deptMap = {};
        if (deptIds.length > 0) {
            const [deptRows] = await pool.execute(
                'SELECT id, name FROM departments WHERE id IN (' + deptIds.map(() => '?').join(',') + ')',
                deptIds
            );
            deptMap = Object.fromEntries(deptRows.map(d => [d.id, d.name]));
        }

        const byArea = {};
        for (const p of purchases) {
            const deptId = p.departmentId || 0;
            const deptName = deptMap[deptId] || 'Sin área';
            if (!byArea[deptId]) {
                byArea[deptId] = {
                    departmentId: deptId,
                    departmentName: deptName,
                    total: 0,
                    newCount: 0,
                    purchases: []
                };
            }
            byArea[deptId].total++;
            if (NEW_STATUSES.includes(p.status)) byArea[deptId].newCount++;
            byArea[deptId].purchases.push({
                id: p.id,
                productOrService: p.productOrService,
                status: p.status,
                createdAt: p.createdAt?.toDate?.()?.toISOString?.() || p.createdAt
            });
        }

        const areas = Object.values(byArea).sort((a, b) =>
            String(a.departmentName).localeCompare(String(b.departmentName))
        );

        res.status(200).json({
            success: true,
            data: {
                areas,
                purchases
            }
        });
    } catch (error) {
        console.error('[PurchaseController] Error getPurchasesDashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el dashboard.'
        });
    }
});

// @desc    Métricas financieras (solo Encargado de Compras). ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// @route   GET /api/purchases/metrics
// @access  Private (purchasing)
const getPurchaseMetrics = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible.'
        });
        return;
    }

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let dateFrom = defaultFrom;
    let dateTo = defaultTo;
    if (req.query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom)) {
        dateFrom = new Date(req.query.dateFrom + 'T00:00:00');
    }
    if (req.query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo)) {
        dateTo = new Date(req.query.dateTo + 'T23:59:59');
    }

    try {
        const snapshot = await db.collection('purchase_requests')
            .where('status', 'in', ['Conforme / Cerrado', 'Entregado', 'Compra Aprobada'])
            .get();

        const deptIds = new Set();
        const cleanPurchases = [];
        const supplierAmounts = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            let refDate = null;
            if (data.status === 'Conforme / Cerrado' && data.conformedAt) {
                refDate = data.conformedAt.toDate ? data.conformedAt.toDate() : new Date(data.conformedAt);
            } else if (data.approvedAt) {
                refDate = data.approvedAt.toDate ? data.approvedAt.toDate() : new Date(data.approvedAt);
            } else {
                refDate = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(0);
            }
            if (refDate < dateFrom || refDate > dateTo) continue;

            let amount = 0;
            const items = Array.isArray(data.items) ? data.items : [];

            if (data.winningQuoteId) {
                const qSnap = await db.collection('purchase_quotes').doc(data.winningQuoteId).get();
                if (qSnap.exists) {
                    const q = qSnap.data();
                    amount = Number(q.price) || 0;
                }
            } else if (Array.isArray(data.itemWinners) && data.itemWinners.length > 0) {
                const NONE = '__none__';
                const winnersWithQuote = data.itemWinners.filter(w => w.quoteId && w.quoteId !== NONE);
                for (const w of winnersWithQuote) {
                    const qSnap = await db.collection('purchase_quotes').doc(w.quoteId).get();
                    if (!qSnap.exists) continue;
                    const q = qSnap.data();
                    const itemPrices = q.itemPrices || [];
                    const ip = itemPrices.find(p => Number(p.itemIndex) === Number(w.itemIndex));
                    const item = items[Number(w.itemIndex)];
                    const qty = (item && item.cantidad) ? Number(item.cantidad) : 1;
                    if (ip && ip.inStock && ip.unitPrice != null) {
                        amount += (Number(ip.unitPrice) || 0) * qty;
                    } else if (q.price != null && winnersWithQuote.length === 1) {
                        amount = Number(q.price);
                    }
                }
            }

            const deptId = data.departmentId || 0;
            const rubro = (data.rubro && String(data.rubro).trim()) || 'Sin clasificar';

            let supplierId = null;
            let supplierName = 'Desconocido';
            if (data.winningQuoteId) {
                const qSnap = await db.collection('purchase_quotes').doc(data.winningQuoteId).get();
                if (qSnap.exists) {
                    const q = qSnap.data();
                    supplierId = q.supplierId;
                    supplierName = q.supplierName || q.supplierEmail || 'Proveedor';
                    supplierAmounts.push({ supplierId, supplierName, amount });
                }
            } else if (Array.isArray(data.itemWinners) && data.itemWinners.length > 0) {
                const NONE = '__none__';
                const winnersWithQuote = data.itemWinners.filter(w => w.quoteId && w.quoteId !== NONE);
                for (const w of winnersWithQuote) {
                    const qSnap = await db.collection('purchase_quotes').doc(w.quoteId).get();
                    if (!qSnap.exists) continue;
                    const q = qSnap.data();
                    const itemPrices = q.itemPrices || [];
                    const ip = itemPrices.find(p => Number(p.itemIndex) === Number(w.itemIndex));
                    const item = items[Number(w.itemIndex)];
                    const qty = (item && item.cantidad) ? Number(item.cantidad) : 1;
                    let portion = 0;
                    if (ip && ip.inStock && ip.unitPrice != null) {
                        portion = (Number(ip.unitPrice) || 0) * qty;
                    } else if (q.price != null && winnersWithQuote.length === 1) {
                        portion = Number(q.price);
                    }
                    if (portion > 0) {
                        supplierAmounts.push({
                            supplierId: q.supplierId,
                            supplierName: q.supplierName || q.supplierEmail || 'Proveedor',
                            amount: portion
                        });
                    }
                }
                const first = winnersWithQuote[0];
                if (first && !supplierId) {
                    const qSnap = await db.collection('purchase_quotes').doc(first.quoteId).get();
                    if (qSnap.exists) {
                        const q = qSnap.data();
                        supplierId = q.supplierId;
                        supplierName = q.supplierName || q.supplierEmail || 'Proveedor';
                    }
                }
            } else if (amount > 0) {
                supplierAmounts.push({ supplierId: null, supplierName: 'Desconocido', amount });
            }

            deptIds.add(deptId);
            cleanPurchases.push({
                amount,
                departmentId: deptId,
                rubro,
                supplierId,
                supplierName
            });
        }

        const deptIdsArr = [...deptIds];
        let deptMap = {};
        if (deptIdsArr.length > 0) {
            const [rows] = await pool.execute(
                'SELECT id, name FROM departments WHERE id IN (' + deptIdsArr.map(() => '?').join(',') + ')',
                deptIdsArr
            );
            deptMap = Object.fromEntries(rows.map(d => [d.id, d.name]));
        }

        const totalGastado = cleanPurchases.reduce((s, p) => s + (p.amount || 0), 0);
        const cantidadPedidos = cleanPurchases.length;
        const ticketPromedio = cantidadPedidos > 0 ? totalGastado / cantidadPedidos : 0;

        const byArea = {};
        const byRubro = {};
        const bySupplier = {};

        for (const p of cleanPurchases) {
            const areaName = deptMap[p.departmentId] || 'Sin área';
            byArea[areaName] = (byArea[areaName] || 0) + (p.amount || 0);
            byRubro[p.rubro] = (byRubro[p.rubro] || 0) + (p.amount || 0);
        }
        for (const s of supplierAmounts) {
            if (s.supplierId != null && s.amount > 0) {
                const key = String(s.supplierId);
                if (!bySupplier[key]) bySupplier[key] = { name: s.supplierName, total: 0 };
                bySupplier[key].total += s.amount;
            }
        }

        const areaData = Object.entries(byArea).map(([name, value]) => ({ name, value }));
        const rubroData = Object.entries(byRubro).map(([name, value]) => ({ name, value }));
        const supplierData = Object.entries(bySupplier)
            .map(([id, o]) => ({ id, name: o.name, total: o.total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        res.status(200).json({
            success: true,
            data: {
                totalGastado,
                cantidadPedidos,
                ticketPromedio,
                byArea: areaData,
                byRubro: rubroData,
                topSuppliers: supplierData
            }
        });
    } catch (error) {
        console.error('[PurchaseController] Error getPurchaseMetrics:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener métricas.'
        });
    }
});

// @desc    Obtener todas las compras aprobadas (solo Encargado de Compras). Opcional: ?departmentId=X
// @route   GET /api/purchases/all
// @access  Private (rol purchasing)
const getAllPurchases = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible. Configure FIREBASE_CREDENTIALS.'
        });
        return;
    }

    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

    try {
        let snapshot = await db.collection('purchase_requests')
            .where('status', 'in', ['Aprobado por Jefe', 'Recibido', 'Esperando presupuesto', 'Compra Aprobada', 'Esperando entrega', 'Entregado', 'Conforme / Cerrado'])
            .get();

        let purchases = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
                    approvedAt: data.approvedAt?.toDate?.()?.toISOString?.() || data.approvedAt,
                    estimatedDeliveryDate: data.estimatedDeliveryDate || null
                };
            })
            .filter(p => {
                if (departmentId === null || departmentId === undefined) return true;
                if (departmentId === 0) return !p.departmentId || Number(p.departmentId) === 0;
                return Number(p.departmentId) === departmentId;
            })
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

        res.status(200).json({
            success: true,
            data: purchases
        });
    } catch (error) {
        console.error('[PurchaseController] Error getAllPurchases:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las compras.'
        });
    }
});

// @desc    Marcar como "Solicitud recibida" automáticamente al abrir (solo si está "Aprobado por Jefe")
// @route   PUT /api/purchases/:id/mark-received
// @access  Private (rol purchasing)
const markPurchaseReceived = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { id } = req.params;
    const docRef = db.collection('purchase_requests').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
        return;
    }
    const data = docSnap.data();
    if (data.status !== 'Aprobado por Jefe') {
        res.status(200).json({ success: true, message: 'Sin cambios.', data: { id, status: data.status } });
        return;
    }
    await docRef.update({
        status: 'Recibido',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({
        success: true,
        message: 'Marcada como recibida.',
        data: { id, status: 'Recibido' }
    });
});

// @desc    Actualizar estado de una solicitud (solo Encargado de Compras)
// @route   PUT /api/purchases/:id/status
// @access  Private (rol purchasing)
const updatePurchaseStatus = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({
            success: false,
            message: 'El módulo de compras no está disponible. Configure FIREBASE_CREDENTIALS.'
        });
        return;
    }

    const { id } = req.params;
    const { status, estimatedDeliveryDate } = req.body;

    if (!status || !PURCHASING_STATUSES.includes(status)) {
        res.status(400).json({
            success: false,
            message: `Estado inválido. Use uno de: ${PURCHASING_STATUSES.join(', ')}`
        });
        return;
    }

    try {
        const docRef = db.collection('purchase_requests').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada.'
            });
            return;
        }

        const currentData = docSnap.data();
        const currentStatus = currentData.status;

        // No puede cambiar si está en "Pendiente" o "Rechazado"
        if (currentStatus === 'Pendiente Aprobación Jefe' || currentStatus === 'Rechazado') {
            res.status(400).json({
                success: false,
                message: 'No puede cambiar el estado de solicitudes pendientes o rechazadas.'
            });
            return;
        }

        const updateData = {
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            statusUpdatedBy: req.user.username || req.user.id
        };
        if (typeof estimatedDeliveryDate === 'string' && estimatedDeliveryDate.trim()) {
            updateData.estimatedDeliveryDate = estimatedDeliveryDate.trim();
        }
        await docRef.update(updateData);

        res.status(200).json({
            success: true,
            message: 'Estado actualizado.',
            data: { id, status }
        });
    } catch (error) {
        console.error('[PurchaseController] Error updatePurchaseStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el estado.'
        });
    }
});

// ==================== COTIZACIONES (FLUJO PROVEEDORES) ====================

// @desc    Solicitar presupuestos a múltiples proveedores (purchasing)
// @route   POST /api/purchases/:purchaseId/request-quotes
// @access  Private (purchasing)
const sendQuoteRequest = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { purchaseId } = req.params;
    const { supplierIds, paymentPreferences } = req.body;
    if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
        res.status(400).json({ success: false, message: 'Seleccione al menos un proveedor.' });
        return;
    }

    const reqDoc = await db.collection('purchase_requests').doc(purchaseId).get();
    if (!reqDoc.exists) {
        res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
        return;
    }
    const reqData = reqDoc.data();
    if (!['Aprobado por Jefe', 'Recibido', 'Esperando presupuesto'].includes(reqData.status)) {
        res.status(400).json({ success: false, message: 'La solicitud no está en estado válido para solicitar presupuestos.' });
        return;
    }

    const placeholders = supplierIds.map(() => '?').join(',');
    const [suppliers] = await pool.execute(
        `SELECT id, email, first_name, last_name FROM users WHERE id IN (${placeholders}) AND role = ?`,
        [...supplierIds.map(Number), 'supplier']
    );

    const batch = db.batch();
    for (const s of suppliers) {
        const ref = db.collection('purchase_quotes').doc();
        batch.set(ref, {
            purchaseRequestId: purchaseId,
            supplierId: Number(s.id),
            supplierEmail: s.email,
            supplierName: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await batch.commit();
    const updateData = {
        status: 'Esperando presupuesto',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (paymentPreferences != null && String(paymentPreferences).trim()) {
        updateData.paymentPreferences = String(paymentPreferences).trim();
    }
    await db.collection('purchase_requests').doc(purchaseId).update(updateData);

    const supplierList = suppliers.map(s => ({ id: s.id, email: s.email, phone: null }));
    notifySuppliersQuoteRequest(req.io, {
        productOrService: reqData.productOrService,
        description: reqData.description,
        quantity: reqData.quantity,
        purchaseId,
    }, supplierList);

    res.status(201).json({
        success: true,
        message: `Solicitud enviada a ${suppliers.length} proveedor(es).`,
        data: { count: suppliers.length }
    });
});

// @desc    Obtener todas mis cotizaciones (proveedor) - pendientes, enviadas y ganadoras
// @route   GET /api/purchases/quotes/my-quotes
// @access  Private (supplier)
const getMyQuotes = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const supplierId = Number(req.user.id);

    const snapshot = await db.collection('purchase_quotes')
        .where('supplierId', '==', supplierId)
        .get();

    const items = [];
    for (const doc of snapshot.docs) {
        const d = doc.data();
        const reqSnap = await db.collection('purchase_requests').doc(d.purchaseRequestId).get();
        const reqData = reqSnap.exists ? reqSnap.data() : {};
        items.push({
            quoteId: doc.id,
            purchaseRequestId: d.purchaseRequestId,
            status: d.status,
            price: d.price,
            invoiceFileUrl: d.invoiceFileUrl || null,
            invoiceUploadedAt: d.invoiceUploadedAt?.toDate?.()?.toISOString?.() || null,
            shippedAt: d.shippedAt?.toDate?.()?.toISOString?.() || null,
            purchaseRequest: {
                productOrService: reqData.productOrService,
                description: reqData.description,
                quantity: reqData.quantity,
                items: reqData.items || []
            },
            createdAt: d.createdAt?.toDate?.()?.toISOString?.(),
            submittedAt: d.submittedAt?.toDate?.()?.toISOString?.()
        });
    }
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({ success: true, data: items });
});

// @desc    Obtener solicitudes de cotización pendientes (proveedor)
// @route   GET /api/purchases/quotes/pending
// @access  Private (supplier)
const getMyPendingQuotes = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const supplierId = Number(req.user.id);

    const snapshot = await db.collection('purchase_quotes')
        .where('supplierId', '==', supplierId)
        .where('status', '==', 'pending')
        .get();

    const items = [];
    for (const doc of snapshot.docs) {
        const d = doc.data();
        const reqSnap = await db.collection('purchase_requests').doc(d.purchaseRequestId).get();
        const reqData = reqSnap.exists ? reqSnap.data() : {};
        items.push({
            quoteId: doc.id,
            purchaseRequestId: d.purchaseRequestId,
            purchaseRequest: {
                productOrService: reqData.productOrService,
                description: reqData.description,
                quantity: reqData.quantity,
                items: reqData.items || [],
                referenceLink: reqData.referenceLink,
                deliveryDeadline: reqData.deliveryDeadline,
                paymentPreferences: reqData.paymentPreferences || null
            },
            createdAt: d.createdAt?.toDate?.()?.toISOString?.()
        });
    }
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({ success: true, data: items });
});

// Opciones para formulario de cotización
const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'cheque', 'transferencia', 'cc'];
const RECEIPT_TYPES = ['Factura A', 'Factura B', 'Consumidor final', 'Otro'];

const getQuoteOptions = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        data: { paymentMethods: PAYMENT_METHODS, receiptTypes: RECEIPT_TYPES }
    });
});

// @desc    Enviar cotización (proveedor)
// @route   POST /api/purchases/quotes/:quoteId/submit
// @access  Private (supplier)
const submitQuote = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { quoteId } = req.params;
    let { paymentMethods, deliveryTerm, paymentTerm, receiptType, price, budgetPdfUrl, itemPrices } = req.body;
    const supplierId = Number(req.user.id);

    if (!deliveryTerm || !paymentTerm || !receiptType) {
        res.status(400).json({ success: false, message: 'Plazo de entrega, plazo de pago y tipo de comprobante son obligatorios.' });
        return;
    }

    const quoteRef = db.collection('purchase_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
        res.status(404).json({ success: false, message: 'Solicitud de cotización no encontrada.' });
        return;
    }
    const q = quoteSnap.data();
    if (Number(q.supplierId) !== supplierId) {
        res.status(403).json({ success: false, message: 'No autorizado.' });
        return;
    }
    if (q.status !== 'pending') {
        res.status(400).json({ success: false, message: 'Esta cotización ya fue enviada.' });
        return;
    }

    const methods = Array.isArray(paymentMethods) ? paymentMethods.filter(m => PAYMENT_METHODS.includes(m)) : [];
    const reqSnapForItems = await db.collection('purchase_requests').doc(q.purchaseRequestId).get();
    const reqItems = reqSnapForItems.exists ? (reqSnapForItems.data().items || []) : [];
    let priceNum = 0;
    let validatedItemPrices = [];

    if (Array.isArray(itemPrices) && itemPrices.length > 0 && reqItems.length > 0) {
        validatedItemPrices = itemPrices
            .map((ip) => ({
                itemIndex: parseInt(ip.itemIndex, 10),
                inStock: !!ip.inStock,
                unitPrice: parseFloat(ip.unitPrice) || 0
            }))
            .filter((ip) => ip.itemIndex >= 0 && ip.itemIndex < reqItems.length);
        for (let i = 0; i < validatedItemPrices.length; i++) {
            const ip = validatedItemPrices[i];
            const item = reqItems[ip.itemIndex];
            if (item && ip.inStock && ip.unitPrice > 0) {
                priceNum += ip.unitPrice * (item.cantidad || 1);
            }
        }
    } else {
        priceNum = parseFloat(price) || 0;
    }
    if (priceNum <= 0) {
        res.status(400).json({ success: false, message: 'Indique el precio total o los precios por ítem.' });
        return;
    }

    const updatePayload = {
        status: 'submitted',
        paymentMethods: methods,
        deliveryTerm: String(deliveryTerm),
        paymentTerm: String(paymentTerm),
        receiptType: String(receiptType),
        price: priceNum,
        budgetPdfUrl: budgetPdfUrl || q.budgetPdfUrl || null,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (validatedItemPrices.length > 0) {
        updatePayload.itemPrices = validatedItemPrices;
    }
    await quoteRef.update(updatePayload);

    const reqData = reqSnapForItems.exists ? reqSnapForItems.data() : {};
    const supplierName = (q.supplierName && String(q.supplierName).trim()) || 'Proveedor';
    notifyPurchasingQuoteSubmitted(req.io, {
        productOrService: reqData.productOrService || 'N/A',
        purchaseId: q.purchaseRequestId,
        supplierName,
        price: priceNum,
    });

    res.status(200).json({
        success: true,
        message: 'Cotización enviada correctamente.',
        data: { quoteId }
    });
});

// @desc    Obtener todas las cotizaciones de una solicitud (purchasing) con reputación y precios históricos
// @route   GET /api/purchases/:purchaseId/quotes
// @access  Private (purchasing)
const getQuotesByPurchaseId = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { purchaseId } = req.params;

    const reqSnap = await db.collection('purchase_requests').doc(purchaseId).get();
    if (!reqSnap.exists) {
        res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
        return;
    }

    const reqData = reqSnap.data();
    const items = Array.isArray(reqData.items) ? reqData.items : [];

    const quotesSnap = await db.collection('purchase_quotes')
        .where('purchaseRequestId', '==', purchaseId)
        .get();

    const supplierIds = [...new Set(quotesSnap.docs.map(d => Number(d.data().supplierId)).filter(Boolean))];
    let supplierRatings = {};
    if (supplierIds.length > 0) {
        const placeholders = supplierIds.map(() => '?').join(',');
        const [rows] = await pool.execute(
            `SELECT id, COALESCE(rating_sum, 0) as rating_sum, COALESCE(rating_count, 0) as rating_count FROM users WHERE id IN (${placeholders})`,
            supplierIds
        );
        for (const r of rows) {
            const count = Number(r.rating_count) || 0;
            const sum = Number(r.rating_sum) || 0;
            supplierRatings[Number(r.id)] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
        }
    }

    let historicalPrices = {};
    if (items.length > 0) {
        historicalPrices = await getHistoricalPricesForItems(db, items);
    }

    const quotes = quotesSnap.docs.map(doc => {
        const d = doc.data();
        const sid = Number(d.supplierId);
        return {
            id: doc.id,
            ...d,
            supplierRating: supplierRatings[sid] ?? null,
            createdAt: d.createdAt?.toDate?.()?.toISOString?.(),
            submittedAt: d.submittedAt?.toDate?.()?.toISOString?.(),
            invoiceFileUrl: d.invoiceFileUrl || null,
            invoiceUploadedAt: d.invoiceUploadedAt?.toDate?.()?.toISOString?.() || null,
            shippedAt: d.shippedAt?.toDate?.()?.toISOString?.() || null
        };
    });

    res.status(200).json({
        success: true,
        data: {
            purchaseRequest: { id: purchaseId, ...reqData },
            quotes,
            historicalPrices
        }
    });
});

// @desc    Seleccionar ganador (purchasing)
// @route   PUT /api/purchases/quotes/:quoteId/select-winner
// @access  Private (purchasing)
const selectQuoteWinner = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { quoteId } = req.params;

    const quoteRef = db.collection('purchase_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
        res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
        return;
    }
    const q = quoteSnap.data();
    if (q.status !== 'submitted') {
        res.status(400).json({ success: false, message: 'Solo se puede seleccionar ganador de cotizaciones enviadas.' });
        return;
    }

    const purchaseId = q.purchaseRequestId;

    // Marcar todas las demás como rechazadas
    const allQuotes = await db.collection('purchase_quotes').where('purchaseRequestId', '==', purchaseId).get();
    const batch = db.batch();
    for (const doc of allQuotes.docs) {
        if (doc.id === quoteId) {
            batch.update(doc.ref, {
                status: 'winner',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else if (doc.data().status === 'submitted') {
            batch.update(doc.ref, {
                status: 'rejected',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    await batch.commit();

    await db.collection('purchase_requests').doc(purchaseId).update({
        status: 'Compra Aprobada',
        winningQuoteId: quoteId,
        winningSupplierId: q.supplierId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const reqSnap = await db.collection('purchase_requests').doc(purchaseId).get();
    const reqDataForNotif = reqSnap.exists ? reqSnap.data() : {};
    notifySupplierWinner(req.io, {
        productOrService: reqDataForNotif.productOrService || 'Solicitud',
        purchaseId,
    }, { id: q.supplierId, email: q.supplierEmail, phone: null });

    res.status(200).json({
        success: true,
        message: 'Ganador seleccionado. El proveedor puede subir la factura.',
        data: { quoteId, purchaseRequestId: purchaseId }
    });
});

// @desc    Subir presupuesto oficial PDF (proveedor, antes de enviar cotización)
// @route   POST /api/purchases/quotes/:quoteId/upload-budget
// @access  Private (supplier)
const uploadQuoteBudget = asyncHandler(async (req, res) => {
    if (!db || !bucket) {
        res.status(503).json({ success: false, message: 'Módulo de compras o Storage no disponible.' });
        return;
    }
    const { quoteId } = req.params;
    const supplierId = Number(req.user.id);
    if (!req.file || !req.file.buffer) {
        res.status(400).json({ success: false, message: 'Debe adjuntar un archivo PDF.' });
        return;
    }
    const quoteRef = db.collection('purchase_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
        res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
        return;
    }
    const q = quoteSnap.data();
    if (Number(q.supplierId) !== supplierId || q.status !== 'pending') {
        res.status(403).json({ success: false, message: 'Solo puede subir presupuesto en cotizaciones pendientes.' });
        return;
    }
    const filename = `budgets/${quoteId}/${Date.now()}-${req.file.originalname || 'budget.pdf'}`;
    const file = bucket.file(filename);
    await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype || 'application/pdf' }
    });
    const [urlResult] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
    await quoteRef.update({
        budgetPdfUrl: urlResult,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(200).json({
        success: true,
        message: 'Presupuesto subido.',
        data: { budgetPdfUrl: urlResult }
    });
});

// @desc    Subir factura (proveedor ganador)
// @route   POST /api/purchases/quotes/:quoteId/upload-invoice
// @access  Private (supplier) - usa multer para el archivo
const uploadQuoteInvoice = asyncHandler(async (req, res) => {
    if (!db || !bucket) {
        res.status(503).json({ success: false, message: 'Módulo de compras o Storage no disponible.' });
        return;
    }
    const { quoteId } = req.params;
    const supplierId = Number(req.user.id);

    if (!req.file || !req.file.buffer) {
        res.status(400).json({ success: false, message: 'Debe adjuntar un archivo (PDF o imagen).' });
        return;
    }

    const quoteRef = db.collection('purchase_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
        res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
        return;
    }
    const q = quoteSnap.data();
    if (Number(q.supplierId) !== supplierId || q.status !== 'winner') {
        res.status(403).json({ success: false, message: 'Solo el proveedor ganador puede subir la factura.' });
        return;
    }

    const filename = `invoices/${quoteId}/${Date.now()}-${req.file.originalname || 'invoice'}`;
    const file = bucket.file(filename);
    await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype || 'application/octet-stream' }
    });
    const [urlResult] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
    const downloadUrl = urlResult;

    await quoteRef.update({
        invoiceFileUrl: downloadUrl,
        invoiceUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('purchase_requests').doc(q.purchaseRequestId).update({
        status: 'Entregado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
        success: true,
        message: 'Factura subida correctamente.',
        data: { invoiceUrl: downloadUrl }
    });
});

// @desc    Marcar pedido como enviado (proveedor ganador)
// @route   PUT /api/purchases/quotes/:quoteId/mark-shipped
// @access  Private (supplier)
const markOrderShipped = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { quoteId } = req.params;
    const { shippingNotes } = req.body || {};
    const supplierId = Number(req.user.id);

    const quoteRef = db.collection('purchase_quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
        res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
        return;
    }
    const q = quoteSnap.data();
    if (Number(q.supplierId) !== supplierId || q.status !== 'winner') {
        res.status(403).json({ success: false, message: 'Solo el proveedor ganador puede notificar el envío.' });
        return;
    }
    if (q.shippedAt) {
        res.status(400).json({ success: false, message: 'Este pedido ya fue marcado como enviado.' });
        return;
    }

    await quoteRef.update({
        shippedAt: admin.firestore.FieldValue.serverTimestamp(),
        shippingNotes: (shippingNotes && String(shippingNotes).trim()) || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('purchase_requests').doc(q.purchaseRequestId).update({
        status: 'Esperando entrega',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const reqSnap = await db.collection('purchase_requests').doc(q.purchaseRequestId).get();
    const reqData = reqSnap.exists ? reqSnap.data() : {};
    notifyPurchasingOrderShipped(req.io, {
        productOrService: reqData.productOrService || 'N/A',
        purchaseId: q.purchaseRequestId,
        shippingNotes: (shippingNotes && String(shippingNotes).trim()) || null,
    });

    res.status(200).json({
        success: true,
        message: 'Pedido marcado como enviado. Compras recibirá la notificación.',
        data: { quoteId }
    });
});

// @desc    Obtener detalle de una solicitud (purchasing, para ver y solicitar quotes)
// @route   GET /api/purchases/:purchaseId
// @access  Private (purchasing)
const getPurchaseById = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { purchaseId } = req.params;
    const doc = await db.collection('purchase_requests').doc(purchaseId).get();
    if (!doc.exists) {
        res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
        return;
    }
    const d = doc.data();
    res.status(200).json({
        success: true,
        data: {
            id: doc.id,
            ...d,
            createdAt: d.createdAt?.toDate?.()?.toISOString?.(),
            approvedAt: d.approvedAt?.toDate?.()?.toISOString?.(),
            estimatedDeliveryDate: d.estimatedDeliveryDate || null
        }
    });
});

// @desc    Listar facturas (compras) - organizadas por proveedor, fecha y monto
// @route   GET /api/purchases/invoices
// @access  Private (purchasing)
const getInvoices = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { supplierId, dateFrom, dateTo, amountMin, amountMax } = req.query || {};

    const snapshot = await db.collection('purchase_quotes')
        .where('status', '==', 'winner')
        .get();

    const invoices = [];
    for (const doc of snapshot.docs) {
        const d = doc.data();
        if (!d.invoiceFileUrl) continue;

        const reqSnap = await db.collection('purchase_requests').doc(d.purchaseRequestId).get();
        const reqData = reqSnap.exists ? reqSnap.data() : {};

        const price = d.price != null ? Number(d.price) : null;
        const invoiceDate = d.invoiceUploadedAt?.toDate?.() || null;
        const invDateStr = invoiceDate ? invoiceDate.toISOString().slice(0, 10) : null;

        if (supplierId && Number(d.supplierId) !== Number(supplierId)) continue;
        if (dateFrom && invDateStr && invDateStr < String(dateFrom)) continue;
        if (dateTo && invDateStr && invDateStr > String(dateTo)) continue;
        if (amountMin != null && (price == null || price < Number(amountMin))) continue;
        if (amountMax != null && (price == null || price > Number(amountMax))) continue;

        invoices.push({
            quoteId: doc.id,
            purchaseId: d.purchaseRequestId,
            productOrService: reqData.productOrService || 'N/A',
            supplierId: d.supplierId,
            supplierName: d.supplierName || d.supplierEmail || 'Proveedor',
            supplierEmail: d.supplierEmail,
            price,
            invoiceFileUrl: d.invoiceFileUrl,
            invoiceUploadedAt: d.invoiceUploadedAt?.toDate?.()?.toISOString?.() || null,
            createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
        });
    }

    invoices.sort((a, b) => {
        const da = a.invoiceUploadedAt || a.createdAt || '';
        const db = b.invoiceUploadedAt || b.createdAt || '';
        return db.localeCompare(da);
    });

    res.status(200).json({
        success: true,
        data: invoices,
    });
});

// @desc    Seleccionar ganadores por ítem (purchasing) - múltiples proveedores
// @route   PUT /api/purchases/:purchaseId/item-winners
// @access  Private (purchasing)
const setItemWinners = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'Módulo de compras no disponible.' });
        return;
    }
    const { purchaseId } = req.params;
    const { itemWinners: rawItemWinners } = req.body;

    const reqRef = db.collection('purchase_requests').doc(purchaseId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
        res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
        return;
    }
    const reqData = reqSnap.data();
    const items = Array.isArray(reqData.items) ? reqData.items : [];
    if (items.length === 0) {
        res.status(400).json({ success: false, message: 'Esta solicitud no tiene ítems. Use selección de ganador único.' });
        return;
    }

    const NONE_QUOTE = '__none__';
    const itemWinners = Array.isArray(rawItemWinners) ? rawItemWinners : [];
    const validIndexes = new Set(itemWinners.map(w => Number(w.itemIndex)));
    for (let i = 0; i < items.length; i++) {
        if (!validIndexes.has(i)) {
            res.status(400).json({ success: false, message: `Debe seleccionar un ganador para cada ítem (falta ítem ${i}).` });
            return;
        }
    }

    const allQuotes = await db.collection('purchase_quotes').where('purchaseRequestId', '==', purchaseId).get();
    const quoteIds = new Set(allQuotes.docs.map(d => d.id));
    const winnerQuoteIds = new Set(itemWinners.filter(w => w.quoteId !== NONE_QUOTE).map(w => w.quoteId));
    for (const w of itemWinners) {
        if (w.quoteId !== NONE_QUOTE && !quoteIds.has(w.quoteId)) {
            res.status(400).json({ success: false, message: 'Una cotización seleccionada no pertenece a esta solicitud.' });
            return;
        }
    }

    const batch = db.batch();
    for (const doc of allQuotes.docs) {
        const newStatus = winnerQuoteIds.has(doc.id) ? 'winner' : 'rejected';
        if (doc.data().status !== newStatus) {
            batch.update(doc.ref, {
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    const updateData = {
        itemWinners: itemWinners.map(w => ({ itemIndex: Number(w.itemIndex), quoteId: w.quoteId === NONE_QUOTE ? NONE_QUOTE : String(w.quoteId) })),
        status: 'Compra Aprobada',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    batch.update(reqRef, updateData);
    await batch.commit();

    for (const qDoc of allQuotes.docs) {
        const q = qDoc.data();
        if (winnerQuoteIds.has(qDoc.id)) {
            notifySupplierWinner(req.io, {
                productOrService: reqData.productOrService || 'Solicitud',
                purchaseId,
            }, { id: q.supplierId, email: q.supplierEmail, phone: null });
        }
    }

    res.status(200).json({
        success: true,
        message: 'Ganadores por ítem guardados. Los proveedores ganadores pueden subir facturas.',
        data: { purchaseId, itemWinners: updateData.itemWinners }
    });
});

// ==================== APROBACIÓN MÁGICA (1-CLIC SIN LOGIN) ====================

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3020';

// @desc    Aprobar solicitud por Magic Link (público, sin autenticación)
// @route   GET /api/purchases/magic-approve/:token
// @access  Public
const magicApprove = asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { purchaseId, bossId, action } = decoded;
        if (action !== 'approve' || !purchaseId || !bossId) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }

        if (!db) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=unavailable`);
        }

        const [[bossRow]] = await pool.execute(
            'SELECT department_id FROM users WHERE id = ? AND role = ?',
            [bossId, 'boss']
        );
        if (!bossRow || !bossRow.department_id) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }

        const docRef = db.collection('purchase_requests').doc(purchaseId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=notfound`);
        }

        const data = docSnap.data();
        if (data.status !== 'Pendiente Aprobación Jefe') {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=used`);
        }
        if (Number(data.departmentId) !== Number(bossRow.department_id)) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }

        const [userRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [bossId]);
        const bossUsername = userRows[0]?.username || bossId;

        await docRef.update({
            status: 'Aprobado por Jefe',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: bossUsername,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        notifyPurchasingApproved(req.io || null, {
            productOrService: data.productOrService,
            approvedBy: bossUsername,
            purchaseId
        });

        return res.redirect(`${FRONTEND_URL}/success-approval?approved=true`);
    } catch (err) {
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }
        console.error('[PurchaseController] magicApprove error:', err);
        return res.redirect(`${FRONTEND_URL}/success-approval?error=server`);
    }
});

// @desc    Rechazar solicitud por Magic Link (público, sin autenticación)
// @route   GET /api/purchases/magic-reject/:token
// @access  Public
const magicReject = asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { purchaseId, bossId, action } = decoded;
        if (action !== 'reject' || !purchaseId || !bossId) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }

        if (!db) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=unavailable`);
        }

        const [[bossRow]] = await pool.execute(
            'SELECT department_id FROM users WHERE id = ? AND role = ?',
            [bossId, 'boss']
        );
        if (!bossRow || !bossRow.department_id) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }

        const docRef = db.collection('purchase_requests').doc(purchaseId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=notfound`);
        }

        const data = docSnap.data();
        if (data.status !== 'Pendiente Aprobación Jefe') {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=used`);
        }
        if (Number(data.departmentId) !== Number(bossRow.department_id)) {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }

        const [userRows] = await pool.execute('SELECT username FROM users WHERE id = ?', [bossId]);
        const bossUsername = userRows[0]?.username || bossId;

        await docRef.update({
            status: 'Rechazado',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: bossUsername,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.redirect(`${FRONTEND_URL}/success-approval?approved=false`);
    } catch (err) {
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.redirect(`${FRONTEND_URL}/success-approval?error=invalid`);
        }
        console.error('[PurchaseController] magicReject error:', err);
        return res.redirect(`${FRONTEND_URL}/success-approval?error=server`);
    }
});

// @desc    Marcar solicitud como Conforme/Cerrado (solo el solicitante, estado Entregado) con calificación
// @route   PUT /api/purchases/:id/conforme
// @body    { rating?: 1-5, comment?: string }
// @access  Private (client, boss, purchasing)
const markPurchaseConforme = asyncHandler(async (req, res) => {
    if (!db) {
        res.status(503).json({ success: false, message: 'El módulo de compras no está disponible.' });
        return;
    }
    const { id } = req.params;
    const userId = Number(req.user.id);
    const { rating: rawRating, comment } = req.body || {};

    const docRef = db.collection('purchase_requests').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
        return;
    }
    const data = docSnap.data();
    if (Number(data.userId) !== userId) {
        res.status(403).json({ success: false, message: 'Solo el solicitante puede marcar la entrega como conforme.' });
        return;
    }
    if (data.status !== 'Entregado') {
        res.status(400).json({ success: false, message: 'Solo puede marcar como conforme solicitudes con estado "Entregado".' });
        return;
    }

    const rating = Math.min(5, Math.max(1, parseInt(rawRating, 10) || 0));
    const ratingValid = rating >= 1 && rating <= 5;

    const updateData = {
        status: 'Conforme / Cerrado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        conformedAt: admin.firestore.FieldValue.serverTimestamp(),
        conformedBy: userId
    };
    if (ratingValid) {
        updateData.deliveryRating = rating;
        if (comment != null && String(comment).trim()) {
            updateData.deliveryRatingComment = String(comment).trim();
        }
    }
    await docRef.update(updateData);

    // Actualizar rating del proveedor en MySQL
    const supplierIds = new Set();
    if (data.winningSupplierId != null) {
        supplierIds.add(Number(data.winningSupplierId));
    }
    if (Array.isArray(data.itemWinners) && data.itemWinners.length > 0) {
        const NONE = '__none__';
        for (const w of data.itemWinners) {
            if (w.quoteId && w.quoteId !== NONE) {
                const qSnap = await db.collection('purchase_quotes').doc(w.quoteId).get();
                if (qSnap.exists && qSnap.data().supplierId != null) {
                    supplierIds.add(Number(qSnap.data().supplierId));
                }
            }
        }
    }

    if (ratingValid && supplierIds.size > 0) {
        for (const supplierId of supplierIds) {
            await pool.execute(
                'UPDATE users SET rating_sum = COALESCE(rating_sum, 0) + ?, rating_count = COALESCE(rating_count, 0) + 1 WHERE id = ?',
                [rating, supplierId]
            ).catch((err) => {
                console.warn('[PurchaseController] No se pudo actualizar rating del proveedor', supplierId, err.message);
            });
        }
    }

    res.status(200).json({
        success: true,
        message: 'Solicitud marcada como conforme.',
        data: { id, status: 'Conforme / Cerrado' }
    });
});

module.exports = {
    magicApprove,
    magicReject,
    getPurchaseMetrics,
    getQuoteOptions,
    createPurchaseRequest,
    getMyPurchases,
    getPendingApprovals,
    approveRequest,
    getAllPurchases,
    updatePurchaseStatus,
    sendQuoteRequest,
    getMyQuotes,
    getMyPendingQuotes,
    submitQuote,
    getQuotesByPurchaseId,
    selectQuoteWinner,
    uploadQuoteInvoice,
    uploadQuoteBudget,
    markOrderShipped,
    getPurchaseById,
    setItemWinners,
    getPurchasesDashboard,
    getInvoices,
    markPurchaseReceived,
    markPurchaseConforme
};
