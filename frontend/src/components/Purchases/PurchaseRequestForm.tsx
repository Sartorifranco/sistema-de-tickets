import React, { useState } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';

interface PurchaseItem {
    producto: string;
    cantidad: number;
    descripcion: string;
}

interface PurchaseRequestFormProps {
    onSuccess?: () => void;
}

const MAX_ITEMS = 20;
const INITIAL_ITEM: PurchaseItem = { producto: '', cantidad: 1, descripcion: '' };

const RUBRO_OPTIONS = [
    'Librería e Insumos de Oficina',
    'Tecnología / IT',
    'Limpieza y Maestranza',
    'Mantenimiento y Ferretería',
    'Servicios Profesionales',
    'Otros'
] as const;

const PurchaseRequestForm: React.FC<PurchaseRequestFormProps> = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<PurchaseItem[]>([{ ...INITIAL_ITEM }]);
    const [rubro, setRubro] = useState<string>('');
    const [referenceLink, setReferenceLink] = useState('');
    const [deliveryDeadline, setDeliveryDeadline] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isRecurring, setIsRecurring] = useState(false);

    const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const addItem = () => {
        if (items.length >= MAX_ITEMS) {
            toast.warn(`Máximo ${MAX_ITEMS} ítems por solicitud.`);
            return;
        }
        setItems(prev => [...prev, { ...INITIAL_ITEM }]);
    };

    const removeItem = (index: number) => {
        if (items.length <= 1) {
            toast.warn('Debe haber al menos un ítem.');
            return;
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setImage(file || null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validItems = items
            .map(it => ({
                producto: String(it.producto || '').trim(),
                cantidad: Math.max(1, parseInt(String(it.cantidad), 10) || 1),
                descripcion: String(it.descripcion || '').trim()
            }))
            .filter(it => it.producto && it.descripcion);

        if (validItems.length === 0) {
            toast.error('Agregue al menos un ítem con producto y descripción.');
            return;
        }
        if (validItems.length !== items.length) {
            toast.error('Complete producto y descripción en todos los ítems.');
            return;
        }
        if (items.length > MAX_ITEMS) {
            toast.error(`Máximo ${MAX_ITEMS} ítems permitidos.`);
            return;
        }
        if (!rubro || !RUBRO_OPTIONS.includes(rubro as typeof RUBRO_OPTIONS[number])) {
            toast.error('Seleccione el Rubro de Compra.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                items: validItems,
                rubro: rubro.trim(),
                referenceLink: referenceLink.trim() || undefined,
                deliveryDeadline: deliveryDeadline || undefined,
                is_recurring: isRecurring
            };
            await api.post('/api/purchases', payload);
            toast.success('Solicitud de compra creada correctamente.');
            setItems([{ ...INITIAL_ITEM }]);
            setRubro('');
            setReferenceLink('');
            setDeliveryDeadline('');
            setImage(null);
            setIsRecurring(false);
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al crear la solicitud.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Nueva solicitud de compra</h2>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700">Ítems de la solicitud</label>
                    <button
                        type="button"
                        onClick={addItem}
                        disabled={items.length >= MAX_ITEMS}
                        className="text-sm px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        + Añadir ítem
                    </button>
                </div>
                <p className="text-xs text-gray-500">Máximo {MAX_ITEMS} ítems. Cada ítem debe tener producto, cantidad y descripción.</p>

                {items.map((item, index) => (
                    <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
                    >
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">Ítem {index + 1}</span>
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={items.length <= 1}
                                className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Eliminar
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Producto o servicio *</label>
                                <input
                                    type="text"
                                    value={item.producto}
                                    onChange={(e) => handleItemChange(index, 'producto', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                                    placeholder="Ej: Monitor Dell 24 pulgadas"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad *</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={item.cantidad}
                                    onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción de la necesidad *</label>
                                <textarea
                                    value={item.descripcion}
                                    onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                                    placeholder="Describa por qué necesita este producto/servicio..."
                                    required
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t pt-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rubro de Compra (Categoría) *</label>
                    <select
                        value={rubro}
                        onChange={(e) => setRubro(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    >
                        <option value="">-- Seleccione un rubro --</option>
                        {RUBRO_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link de referencia</label>
                    <input
                        type="url"
                        value={referenceLink}
                        onChange={(e) => setReferenceLink(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        placeholder="https://..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha tope de entrega</label>
                    <input
                        type="date"
                        value={deliveryDeadline}
                        onChange={(e) => setDeliveryDeadline(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <input
                        id="is-recurring"
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <label htmlFor="is-recurring" className="text-sm font-medium text-gray-700">
                        🔄 Hacer que este pedido sea recurrente (Mensual)
                    </label>
                </div>
                <p className="text-xs text-gray-500 -mt-2">Se generará automáticamente una nueva solicitud idéntica el día 1 de cada mes.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">La subida a Storage se habilitará en la siguiente fase.</p>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50"
            >
                {loading ? 'Enviando...' : 'Enviar solicitud'}
            </button>
        </form>
    );
};

export default PurchaseRequestForm;
