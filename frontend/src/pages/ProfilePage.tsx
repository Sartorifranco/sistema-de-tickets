import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';

const ProfilePage: React.FC = () => {
    const { user } = useAuth();
    const [companyName, setCompanyName] = useState<string>('No asignada');
    const [departmentName, setDepartmentName] = useState<string>('No asignado');
    const [loadingDetails, setLoadingDetails] = useState<boolean>(true);

    const [notificationEmail, setNotificationEmail] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [pushEnabled, setPushEnabled] = useState(true);
    const [savingPrefs, setSavingPrefs] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const canEditNotificationPrefs = ['admin', 'purchasing', 'supplier', 'boss'].includes(user?.role || '');
    const canViewConfigStatus = user?.role === 'admin' || user?.role === 'purchasing';
    const [configStatus, setConfigStatus] = useState<Record<string, { configured?: boolean; message?: string; [k: string]: unknown }> | null>(null);
    const [whatsappHelp, setWhatsappHelp] = useState<{ sandboxNumber?: string; sandboxJoinCode?: string | null } | null>(null);
    const [testingWhatsApp, setTestingWhatsApp] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);

    const fetchDetails = useCallback(async () => {
        if (!user) return;
        setLoadingDetails(true);
        try {
            if (user.company_id) {
                const companyRes = await api.get(`/api/companies/${user.company_id}`);
                setCompanyName(companyRes.data.data.name || 'No asignada');
            }
            if (user.department_id) {
                const deptRes = await api.get(`/api/departments/${user.department_id}`);
                setDepartmentName(deptRes.data.data.name || 'No asignado');
            }
            if (canEditNotificationPrefs) {
                const prefsRes = await api.get('/api/users/me/notification-preferences');
                if (prefsRes.data.success && prefsRes.data.data) {
                    const p = prefsRes.data.data;
                    setNotificationEmail(p.notification_email || '');
                    setWhatsappNumber(p.whatsapp_number || '');
                    setPushEnabled(p.push_enabled !== false);
                }
            }
            if (canViewConfigStatus) {
                try {
                    const statusRes = await api.get('/api/notifications/config-status');
                    if (statusRes.data.success && statusRes.data.data) {
                        setConfigStatus(statusRes.data.data);
                    }
                } catch { /* ignorar */ }
            }
            if (canEditNotificationPrefs) {
                try {
                    const helpRes = await api.get('/api/notifications/whatsapp-help');
                    if (helpRes.data.success && helpRes.data.data) {
                        setWhatsappHelp(helpRes.data.data);
                    }
                } catch { /* ignorar */ }
            }
        } catch (error) {
            console.error("Error al cargar detalles del perfil:", error);
        } finally {
            setLoadingDetails(false);
        }
    }, [user, canEditNotificationPrefs, canViewConfigStatus]);

    const handleTestWhatsApp = async () => {
        const num = whatsappNumber.trim();
        if (!num) {
            toast.error('Ingrese su número de WhatsApp primero.');
            return;
        }
        setTestingWhatsApp(true);
        try {
            const res = await api.post('/api/notifications/test-whatsapp', { phoneNumber: num });
            if (res.data.success) {
                toast.success('Mensaje de prueba enviado. Revíselo en su WhatsApp.');
            } else {
                toast.error(res.data.message || 'Error al enviar.');
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al enviar prueba.';
            toast.error(msg);
        } finally {
            setTestingWhatsApp(false);
        }
    };

    const handleTestEmail = async () => {
        const email = notificationEmail.trim() || user?.email;
        if (!email) {
            toast.error('Configure un email en preferencias o use el de su cuenta.');
            return;
        }
        setTestingEmail(true);
        try {
            const res = await api.post('/api/notifications/test-email', { email });
            if (res.data.success) {
                toast.success('Email de prueba enviado. Revise su bandeja (incluya spam).');
            } else {
                toast.error(res.data.message || 'Error al enviar.');
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al enviar prueba.';
            toast.error(msg);
        } finally {
            setTestingEmail(false);
        }
    };
    
    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleSaveNotificationPrefs = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEditNotificationPrefs) return;
        setSavingPrefs(true);
        try {
            const res = await api.put('/api/users/me/notification-preferences', {
                notification_email: notificationEmail.trim() || null,
                whatsapp_number: whatsappNumber.trim() || null,
                push_enabled: pushEnabled,
            });
            toast.success(res.data.message || 'Preferencias guardadas.');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar.';
            toast.error(msg);
        } finally {
            setSavingPrefs(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Las nuevas contraseñas no coinciden.");
            return;
        }
        setIsUpdatingPassword(true);
        try {
            const response = await api.put('/api/users/change-password', {
                currentPassword,
                newPassword,
                confirmPassword
            });
            toast.success(response.data.message);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            const message = err.response?.data?.message || "Error al cambiar la contraseña.";
            toast.error(message);
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (!user) {
        return <div className="text-center p-8">Cargando perfil...</div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Mi Perfil</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Detalles de la Cuenta</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                    <div><strong>Nombre de Usuario:</strong> {user.username}</div>
                    <div><strong>Email:</strong> {user.email}</div>
                    <div><strong>Rol:</strong> {user.role}</div>
                    <div><strong>Empresa:</strong> {loadingDetails ? 'Cargando...' : companyName}</div>
                    <div><strong>Departamento:</strong> {loadingDetails ? 'Cargando...' : departmentName}</div>
                </div>
            </div>

            {canViewConfigStatus && configStatus && (
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Estado de canales de notificación</h2>
                    <p className="text-sm text-gray-600 mb-4">Verificación de la configuración del servidor para pruebas reales.</p>
                    <div className="space-y-3">
                        <div className={`p-3 rounded-lg ${configStatus.email?.configured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <span className="font-medium">Email:</span>{' '}
                            {configStatus.email?.configured ? '✅ Configurado' : '⚠️ ' + (configStatus.email?.message || 'Revisar EMAIL_HOST, EMAIL_USER, EMAIL_PASS en .env')}
                        </div>
                        <div className={`p-3 rounded-lg ${configStatus.push?.configured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <span className="font-medium">Push (FCM):</span>{' '}
                            {configStatus.push?.configured ? `✅ Firebase OK (${configStatus.push.usersWithFcmToken || 0} usuarios con token)` : '⚠️ ' + (configStatus.push?.message || 'Revisar FIREBASE_CREDENTIALS')}
                        </div>
                        <div className={`p-3 rounded-lg ${configStatus.whatsapp?.configured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <span className="font-medium">WhatsApp:</span>{' '}
                            {configStatus.whatsapp?.configured ? '✅ Twilio configurado' : '⚠️ ' + (configStatus.whatsapp?.message || 'Revisar TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN en .env')}
                        </div>
                    </div>
                </div>
            )}

            {canEditNotificationPrefs && (
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Preferencias de Notificación</h2>
                    <form onSubmit={handleSaveNotificationPrefs} className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email alternativo de alertas</label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="email"
                                    value={notificationEmail}
                                    onChange={(e) => setNotificationEmail(e.target.value)}
                                    placeholder="Dejar vacío para usar el email de la cuenta"
                                    className="flex-1 rounded-md border-gray-300 shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleTestEmail}
                                    disabled={testingEmail || (!notificationEmail.trim() && !user?.email)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {testingEmail ? 'Enviando...' : 'Probar email'}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Número de WhatsApp (con código de país)</label>
                            <input
                                type="text"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                placeholder="Ej: +54 9 11 1234-5678"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                            />
                            {whatsappHelp && (whatsappHelp.sandboxJoinCode || whatsappHelp.sandboxNumber) && (
                                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                    <p className="font-medium mb-2">📱 Para recibir notificaciones por WhatsApp (modo prueba):</p>
                                    <p className="text-xs text-amber-800 mb-2">El número que recibe debe ser el mismo que envía el mensaje. La membresía dura 72 horas.</p>
                                    <ol className="list-decimal list-inside space-y-1 mb-2">
                                        <li>Guarde su número arriba y haga clic en &quot;Guardar preferencias&quot;.</li>
                                        <li>En WhatsApp (con ese mismo número), agregue <strong>{whatsappHelp.sandboxNumber || '+1 415 523 8886'}</strong></li>
                                        <li>Envíe: <strong>join {whatsappHelp.sandboxJoinCode || '???'}</strong></li>
                                        <li>Si Twilio responde con error, el código puede ser incorrecto. Vea la consola de Twilio → Messaging → Try WhatsApp → Sandbox y use el <em>sandbox name</em> exacto (ej: join happy-fish).</li>
                                        <li>Cuando Twilio confirme, use &quot;Probar WhatsApp&quot;.</li>
                                    </ol>
                                    <button
                                        type="button"
                                        onClick={handleTestWhatsApp}
                                        disabled={testingWhatsApp || !whatsappNumber.trim()}
                                        className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {testingWhatsApp ? 'Enviando...' : '📱 Probar WhatsApp'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={pushEnabled}
                                onClick={() => setPushEnabled(!pushEnabled)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${pushEnabled ? 'bg-red-600' : 'bg-gray-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${pushEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                            <label className="text-sm font-medium text-gray-700">Habilitar notificaciones push</label>
                        </div>
                        <div className="pt-2">
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md" disabled={savingPrefs}>
                                {savingPrefs ? 'Guardando...' : 'Guardar preferencias'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Cambiar Contraseña</h2>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contraseña Actual</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Confirmar Nueva Contraseña</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div className="text-right pt-2">
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md" disabled={isUpdatingPassword}>
                            {isUpdatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;