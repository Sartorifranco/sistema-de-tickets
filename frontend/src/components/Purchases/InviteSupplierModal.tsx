import React, { useState, useEffect } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';

interface Supplier {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    is_active?: number;
}

interface InviteSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const InviteSupplierModal: React.FC<InviteSupplierModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [showNewForm, setShowNewForm] = useState(false);
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [invitationLink, setInvitationLink] = useState<string | null>(null);
    const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoadingSuppliers(true);
            api.get('/api/suppliers')
                .then((r) => {
                    if (r.data.success && r.data.data) setSuppliers(r.data.data);
                })
                .catch(() => toast.error('Error al cargar proveedores.'))
                .finally(() => setLoadingSuppliers(false));
        }
    }, [isOpen]);

    const handleRegenerateLink = async (supplierId: number) => {
        setRegeneratingId(supplierId);
        try {
            const { data } = await api.post(`/api/suppliers/${supplierId}/invitation`);
            if (data.success && data.data?.invitationLink) {
                setInvitationLink(data.data.invitationLink);
                toast.success('Link regenerado.');
                onSuccess();
            } else {
                toast.error(data.message || 'Error.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al regenerar link.');
        } finally {
            setRegeneratingId(null);
        }
    };

    const handleCreateNew = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !contactName) {
            toast.error('Email y nombre de contacto son obligatorios.');
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post('/api/suppliers', {
                contactName: contactName.trim(),
                email: email.trim(),
                companyName: companyName.trim() || undefined,
            });
            if (data.success && data.data?.invitationLink) {
                setInvitationLink(data.data.invitationLink);
                toast.success(data.message || 'Proveedor registrado.');
                onSuccess();
                setSuppliers((prev) => [...prev, {
                    id: data.data.id,
                    email: data.data.email || email,
                    first_name: contactName.split(' ')[0],
                    last_name: contactName.split(' ').slice(1).join(' '),
                    is_active: 0,
                }]);
                setShowNewForm(false);
                setContactName('');
                setEmail('');
                setCompanyName('');
            } else {
                toast.error(data.message || 'Error al registrar.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al registrar proveedor.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (invitationLink) {
            navigator.clipboard.writeText(invitationLink);
            toast.success('Link copiado al portapapeles.');
        }
    };

    const handleClose = () => {
        setInvitationLink(null);
        setShowNewForm(false);
        setContactName('');
        setEmail('');
        setCompanyName('');
        onClose();
    };

    const supplierDisplayName = (s: Supplier) =>
        [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {invitationLink ? 'Link de invitación' : 'Invitar Proveedor'}
                    </h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
                </div>

                {invitationLink ? (
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm">
                            Comparta este link con el proveedor para que establezca su contraseña y active su cuenta.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={invitationLink}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                            />
                            <button onClick={handleCopyLink} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md">
                                Copiar
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">El link fue enviado por email (si el servidor de correo está configurado).</p>
                        <button onClick={handleClose} className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md">Cerrar</button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-600 mb-4">
                            Seleccione un proveedor registrado para reenviar el link de invitación, o registre uno nuevo.
                        </p>
                        <div className="space-y-3 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Proveedores registrados</p>
                            {loadingSuppliers ? (
                                <p className="text-gray-500 text-sm">Cargando...</p>
                            ) : suppliers.length === 0 ? (
                                <p className="text-gray-500 text-sm">No hay proveedores. Registre uno nuevo abajo.</p>
                            ) : (
                                <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                                    {suppliers.map((s) => (
                                        <div key={s.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                            <div>
                                                <span className="font-medium text-gray-800">{supplierDisplayName(s)}</span>
                                                <span className="text-gray-500 text-sm block">{s.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {s.is_active ? (
                                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Activo</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRegenerateLink(s.id)}
                                                        disabled={regeneratingId === s.id}
                                                        className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
                                                    >
                                                        {regeneratingId === s.id ? '...' : 'Reenviar link'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t">
                            {!showNewForm ? (
                                <button
                                    onClick={() => setShowNewForm(true)}
                                    className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-600 rounded-lg font-medium"
                                >
                                    + Registrar nuevo proveedor
                                </button>
                            ) : (
                                <form onSubmit={handleCreateNew} className="space-y-3">
                                    <p className="text-sm font-medium text-gray-700">Nuevo proveedor</p>
                                    <input
                                        type="text"
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        placeholder="Nombre de contacto *"
                                        className="w-full px-3 py-2 border rounded-md"
                                        required
                                    />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email *"
                                        className="w-full px-3 py-2 border rounded-md"
                                        required
                                    />
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="Empresa (opcional)"
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                    <div className="flex gap-2">
                                        <button type="submit" disabled={loading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50">
                                            {loading ? 'Registrando...' : 'Registrar e invitar'}
                                        </button>
                                        <button type="button" onClick={() => setShowNewForm(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md">
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                        <button onClick={handleClose} className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md">
                            Cerrar
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default InviteSupplierModal;
