/**
 * Rutas del Módulo de Compras
 * Protegidas con authenticateToken
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const {
    e2eGetApproveUrl,
    magicApprove,
    magicReject,
    getPurchaseMetrics,
    getQuoteOptions,
    createPurchaseRequest,
    getMyPurchases,
    getPendingApprovals,
    approveRequest,
    getAllPurchases,
    getPurchasesDashboard,
    updatePurchaseStatus,
    sendQuoteRequest,
    getMyQuotes,
    getMyPendingQuotes,
    submitQuote,
    getQuotesByPurchaseId,
    selectQuoteWinner,
    uploadPaymentReceipt,
    uploadQuoteInvoice,
    uploadQuoteBudget,
    markOrderShipped,
    getPurchaseById,
    setItemWinners,
    getInvoices,
    markPurchaseReceived,
    rejectPurchaseRequest,
    markPurchaseConforme
} = require('../controllers/purchaseController');

// Rutas públicas (Magic Links) - ANTES de authenticateToken
router.get('/e2e-get-approve-url/:purchaseId', e2eGetApproveUrl);
router.get('/magic-approve/:token', magicApprove);
router.get('/magic-reject/:token', magicReject);

router.use(authenticateToken);

// Rutas base
router.route('/')
    .post(createPurchaseRequest)
    .get(getMyPurchases);

// Cotizaciones - rutas específicas antes de :id
router.get('/quotes/options', getQuoteOptions);
router.get('/quotes/my-quotes', authorize(['supplier']), getMyQuotes);
router.get('/quotes/pending', authorize(['supplier']), getMyPendingQuotes);
router.post('/quotes/:quoteId/submit', authorize(['supplier']), submitQuote);
router.put('/quotes/:quoteId/select-winner', authorize(['purchasing']), selectQuoteWinner);
router.post('/quotes/:quoteId/upload-invoice', authorize(['supplier']), uploadMiddleware.uploadToMemory.single('invoice'), uploadQuoteInvoice);
router.post('/quotes/:quoteId/upload-budget', authorize(['supplier']), uploadMiddleware.uploadBudgetPdf.single('budget'), uploadQuoteBudget);
router.put('/quotes/:quoteId/mark-shipped', authorize(['supplier']), markOrderShipped);

// Jefes
router.get('/pending-approvals', authorize(['boss']), getPendingApprovals);
router.put('/:id/approve', authorize(['boss']), approveRequest);

// Encargado de Compras (invoices debe ir antes de :purchaseId)
router.get('/invoices', authorize(['purchasing', 'admin']), getInvoices);
router.get('/metrics', authorize(['purchasing', 'admin']), getPurchaseMetrics);
router.get('/dashboard', authorize(['purchasing']), getPurchasesDashboard);
router.get('/all', authorize(['purchasing']), getAllPurchases);
router.put('/:id/mark-received', authorize(['purchasing']), markPurchaseReceived);
router.put('/:id/reject', authorize(['purchasing']), rejectPurchaseRequest);
router.put('/:id/conforme', authorize(['client', 'boss', 'purchasing']), markPurchaseConforme);
router.get('/:purchaseId', authorize(['purchasing']), getPurchaseById);
router.post('/:purchaseId/upload-payment-receipt', authorize(['purchasing']), uploadMiddleware.uploadToMemory.single('receipt'), uploadPaymentReceipt);
router.put('/:purchaseId/item-winners', authorize(['purchasing']), setItemWinners);
router.post('/:purchaseId/request-quotes', authorize(['purchasing']), sendQuoteRequest);
router.get('/:purchaseId/quotes', authorize(['purchasing']), getQuotesByPurchaseId);
router.put('/:id/status', authorize(['purchasing']), updatePurchaseStatus);

module.exports = router;
