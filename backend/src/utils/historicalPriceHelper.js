/**
 * Utilidad para obtener precios históricos de ítems desde compras cerradas.
 * Busca en Firestore solicitudes con status "Conforme / Cerrado" de los últimos 6 meses.
 */
const natural = require('natural');

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.85; // 85% similar para considerar "muy similar"
const MAX_DOCS = 150; // Límite para optimizar la consulta

/**
 * Normaliza nombre de producto para comparación
 */
const normalize = (str) => String(str || '').toLowerCase().trim();

/**
 * Compara si dos nombres de producto son iguales o muy similares
 */
const isSameOrSimilar = (a, b) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const sim = natural.JaroWinklerDistance(na, nb);
    return sim >= SIMILARITY_THRESHOLD;
};

/**
 * Obtiene el precio unitario más bajo pagado por cada ítem en los últimos 6 meses.
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<{producto: string}>} items - Items a buscar
 * @returns {Promise<Record<string, {price: number, date: string}>>} Map producto -> {price, date}
 */
async function getHistoricalPricesForItems(db, items) {
    if (!db || !Array.isArray(items) || items.length === 0) {
        return {};
    }

    const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);
    const result = {}; // producto -> { price, date }

    const closedSnap = await db.collection('purchase_requests')
        .where('status', '==', 'Conforme / Cerrado')
        .limit(MAX_DOCS)
        .get();

    for (const doc of closedSnap.docs) {
        const data = doc.data();
        const conformedAt = data.conformedAt?.toDate?.() || data.updatedAt?.toDate?.() || data.createdAt?.toDate?.();
        if (!conformedAt || conformedAt < sixMonthsAgo) continue;

        const reqItems = Array.isArray(data.items) ? data.items : [];
        if (reqItems.length === 0) continue;

        const itemWinners = Array.isArray(data.itemWinners) ? data.itemWinners : [];
        const winningQuoteId = data.winningQuoteId;

        const getUnitPriceForItem = async (itemIndex) => {
            let quoteId = null;
            if (itemWinners.length > 0) {
                const w = itemWinners.find(x => Number(x.itemIndex) === itemIndex);
                if (w && w.quoteId && w.quoteId !== '__none__') quoteId = w.quoteId;
            } else if (winningQuoteId) {
                quoteId = winningQuoteId;
            }
            if (!quoteId) return null;

            const qSnap = await db.collection('purchase_quotes').doc(quoteId).get();
            if (!qSnap.exists) return null;

            const q = qSnap.data();
            const ip = (q.itemPrices || []).find(p => Number(p.itemIndex) === itemIndex);
            if (!ip || !ip.inStock) return null;
            return ip.unitPrice;
        };

        for (const searchItem of items) {
            const searchProducto = searchItem?.producto;
            if (!searchProducto) continue;

            for (let i = 0; i < reqItems.length; i++) {
                const reqItem = reqItems[i];
                const reqProducto = reqItem?.producto;
                if (!reqProducto) continue;

                if (!isSameOrSimilar(searchProducto, reqProducto)) continue;

                const unitPrice = await getUnitPriceForItem(i);
                if (unitPrice == null || unitPrice <= 0) continue;

                const dateStr = conformedAt ? conformedAt.toISOString().slice(0, 10) : '';
                const key = normalize(searchProducto);
                if (!result[key] || unitPrice < result[key].price) {
                    result[key] = { price: unitPrice, date: dateStr, producto: searchProducto };
                }
            }
        }
    }

    const byProducto = {};
    for (const item of items) {
        const p = item?.producto;
        if (!p) continue;
        const key = normalize(p);
        if (result[key]) {
            byProducto[p] = { price: result[key].price, date: result[key].date };
        }
    }
    return byProducto;
}

module.exports = { getHistoricalPricesForItems };
