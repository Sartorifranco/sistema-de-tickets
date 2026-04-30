import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import PushNotificationButton from '../components/PushNotificationButton/PushNotificationButton';
import DeveloperGithubSettings from '../components/Profile/DeveloperGithubSettings';
import { isDesarrolloDepartmentName } from '../utils/ticketAccess';
import { clCard, clInput } from '../utils/cleanLightUi';

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
    const [testingPush, setTestingPush] = useState(false);

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

    const handleTestPush = async () => {
        setTestingPush(true);
        try {
            const res = await api.post('/api/notifications/test');
            if (res.data.success) {
                console.log('✅ [TEST PUSH] Notificación de prueba enviada correctamente');
                toast.success('Enviado. Debería aparecer la notificación de WINDOWS (esquina de la pantalla). Si no la ves, revisa notificaciones del navegador y de Windows.');
            } else {
                console.error('❌ [TEST PUSH] Respuesta sin éxito:', res.data);
                toast.error(res.data.message || 'Error al enviar prueba.');
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al enviar prueba.';
            console.error('❌ [TEST PUSH] Error en petición Axios:', err);
            toast.error(msg);
        } finally {
            setTestingPush(false);
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

    const showDeveloperGithubSettings =
        user.role === 'admin' || isDesarrolloDepartmentName(departmentName);

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mi Perfil</h1>
            
            <div className={`${clCard} p-6`}>
                <h2 className="text-xl font-bold mb-4 text-slate-900 border-b border-gray-100 pb-2">Detalles de la Cuenta</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                    <div><strong>Nombre de Usuario:</strong> {user.username}</div>
                    <div><strong>Email:</strong> {user.email}</div>
                    <div><strong>Rol:</strong> {user.role}</div>
                    <div><strong>Empresa:</strong> {loadingDetails ? 'Cargando...' : companyName}</div>
                    <div><strong>Departamento:</strong> {loadingDetails ? 'Cargando...' : departmentName}</div>
                </div>
            </div>

            <DeveloperGithubSettings visible={showDeveloperGithubSettings} />

            {canViewConfigStatus && configStatus && (
                <div className={`${clCard} p-6`}>
                    <h2 className="text-xl font-bold mb-4 text-slate-900 border-b border-gray-100 pb-2">Estado de canales de notificación</h2>
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

            <div className={`${clCard} p-6`}>
                <h2 className="text-xl font-bold mb-4 text-slate-900 border-b border-gray-100 pb-2">Notificaciones Push</h2>
                <p className="text-sm text-gray-600 mb-4">Activa las notificaciones para recibir alertas incluso con el navegador cerrado.</p>
                <div className="flex flex-wrap items-center gap-3">
                    <PushNotificationButton />
                    <button
                        type="button"
                        onClick={handleTestPush}
                        disabled={testingPush}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {testingPush ? 'Enviando...' : '🔔 Probar Alerta'}
                    </button>
                </div>
            </div>

            {canEditNotificationPrefs && (
                <div className={`${clCard} p-6`}>
                    <h2 className="text-xl font-bold mb-4 text-slate-900 border-b border-gray-100 pb-2">Preferencias de Notificación</h2>
                    <form onSubmit={handleSaveNotificationPrefs} className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email alternativo de alertas</label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="email"
                                    value={notificationEmail}
                                    onChange={(e) => setNotificationEmail(e.target.value)}
                                    placeholder="Dejar vacío para usar el email de la cuenta"
                                    className={`flex-1 ${clInput}`}
                                />
                                <button
                                    type="button"
                                    onClick={handleTestEmail}
                                    disabled={testingEmail || (!notificationEmail.trim() && !user?.email)}
                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                                className={`mt-1 block w-full ${clInput}`}
                            />
                            {whatsappHelp && (whatsappHelp.sandboxJoinCode || whatsappHelp.sandboxNumber) && (
                                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
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
                                        className="mt-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm" disabled={savingPrefs}>
                                {savingPrefs ? 'Guardando...' : 'Guardar preferencias'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`${clCard} p-6`}>
                <h2 className="text-xl font-bold mb-4 text-slate-900 border-b border-gray-100 pb-2">Cambiar Contraseña</h2>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contraseña Actual</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={`mt-1 block w-full ${clInput}`} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`mt-1 block w-full ${clInput}`} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Confirmar Nueva Contraseña</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`mt-1 block w-full ${clInput}`} required />
                    </div>
                    <div className="text-right pt-2">
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm" disabled={isUpdatingPassword}>
                            {isUpdatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;