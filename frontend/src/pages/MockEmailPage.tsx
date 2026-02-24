/**
 * Vista simulada de bandeja de correo para E2E / Demo.
 * Muestra un "correo" estilo Gmail/Outlook con botones para aprobar o rechazar una solicitud.
 * Ruta: /mock-email?purchaseId=xxx
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../config/axiosConfig';

const MockEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const purchaseId = searchParams.get('purchaseId');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [approveUrl, setApproveUrl] = useState<string | null>(null);
    const [productOrService, setProductOrService] = useState<string>('');
    const [description, setDescription] = useState<string>('');

    useEffect(() => {
        if (!purchaseId) {
            setError('Falta el parámetro purchaseId en la URL.');
            setLoading(false);
            return;
        }
        api.get(`/api/purchases/e2e-get-approve-url/${purchaseId}`)
            .then((res) => {
                if (res.data.success && res.data.data?.approveUrl) {
                    setApproveUrl(res.data.data.approveUrl);
                    setProductOrService(res.data.data.productOrService || 'Solicitud de compra');
                    setDescription(res.data.data.description || '');
                } else {
                    setError(res.data.message || 'No se pudo obtener el enlace de aprobación.');
                }
            })
            .catch((err) => {
                const msg = err.response?.data?.message || err.message || 'Error al cargar. Verifique que E2E_ENABLED=true en el backend.';
                setError(msg);
            })
            .finally(() => setLoading(false));
    }, [purchaseId]);

    const handleApprove = () => {
        if (approveUrl) {
            window.location.href = approveUrl;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-600">Cargando correo...</div>
            </div>
        );
    }

    if (error || !approveUrl) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <Link to="/login" className="text-red-600 hover:underline">Ir al Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-200 flex flex-col">
            {/* Cabecera estilo cliente de correo */}
            <header className="bg-white border-b border-gray-300 shadow-sm px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-lg">B</div>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-800">Bacar Mail</h1>
                        <p className="text-xs text-gray-500">Correo del Sistema</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 flex justify-center">
                <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                    {/* Cabecera del mensaje */}
                    <div className="border-b border-gray-200 p-4 bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">De: Sistema Bacar &lt;sistema@bacar.com.ar&gt;</p>
                                <p className="text-sm font-semibold text-gray-800 mt-1">Asunto: Requiere su Aprobación</p>
                                <p className="text-xs text-gray-500 mt-2">Hace unos momentos</p>
                            </div>
                        </div>
                    </div>

                    {/* Cuerpo del correo */}
                    <div className="p-6 space-y-4 text-gray-700">
                        <p className="text-sm">Estimado/a,</p>
                        <p className="text-sm">
                            Se ha creado una nueva solicitud de compra que requiere su aprobación como Jefe de Área.
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Detalle de la solicitud:</p>
                            <p className="text-sm font-medium text-gray-800">{productOrService}</p>
                            {description && (
                                <p className="text-sm text-gray-600 mt-2">{description}</p>
                            )}
                        </div>
                        <p className="text-sm">
                            Por favor, utilice los botones siguientes para aprobar o rechazar la solicitud. No es necesario iniciar sesión.
                        </p>

                        {/* Botones de acción */}
                        <div className="flex flex-wrap gap-4 pt-6">
                            <button
                                onClick={handleApprove}
                                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-lg shadow-md transition-colors"
                            >
                                ✅ APROBAR
                            </button>
                            <Link
                                to="/success-approval?approved=false"
                                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-lg shadow-md transition-colors inline-flex items-center justify-center"
                            >
                                ❌ RECHAZAR
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MockEmailPage;
