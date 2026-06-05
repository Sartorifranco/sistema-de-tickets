import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import PushNotificationButton from '../components/PushNotificationButton/PushNotificationButton';
import DeveloperGithubSettings from '../components/Profile/DeveloperGithubSettings';
import { isDesarrolloDepartmentName } from '../utils/ticketAccess';
import { clCard, clInput } from '../utils/cleanLightUi';
import { UserRole } from '../types';

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    agent: 'Agente',
    client: 'Cliente',
    boss: 'Jefe',
    purchasing: 'Compras',
    supplier: 'Proveedor',
};

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

    const canEditNotificationPrefs = ['admin', 'agent', 'client', 'purchasing', 'supplier', 'boss'].includes(user?.role || '');
    const showStaffNotificationTools = ['admin', 'purchasing', 'supplier', 'boss'].includes(user?.role || '');
    const canViewConfigStatus = user?.role === 'admin' || user?.role === 'purchasing';
    const isClient = user?.role === 'client';
    const [configStatus, setConfigStatus] = useState<Record<string, { configured?: boolean; message?: string; [k: string]: unknown }> | null>(null);
    const [whatsappHelp, setWhatsappHelp] = useState<{ sandboxNumber?: string; sandboxJoinCode?: string | null } | null>(null);
    const [testingWhatsApp, setTestingWhatsApp] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [testingPush, setTestingPush] = useState(false);

    const fetchDetails = useCallback(async () => {
        if (!user) return;
        setLoadingDetails(true);
        try {
            if (user.company_name) {
                setCompanyName(user.company_name);
            }
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
            if (showStaffNotificationTools) {
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
    }, [user, canEditNotificationPrefs, canViewConfigStatus, showStaffNotificationTools]);

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

    const displayName =
        user.first_name || user.last_name
            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
            : user.username;
    const resolvedCompanyName =
        user.company_name || (loadingDetails ? 'Cargando...' : companyName);
    const roleLabel = ROLE_LABELS[user.role] || user.role;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    {isClient ? 'Mi cuenta' : 'Mi Perfil'}
                </h1>
                <p className="text-sm text-gray-600 mt-2">
                    {isClient
                        ? `Hola, ${displayName}. Desde acá podés revisar tus datos, activar avisos de tickets y cambiar tu contraseña.`
                        : 'Administrá tu cuenta, notificaciones y seguridad.'}
                </p>
            </div>

            {isClient && (
                <div className={`${clCard} p-4 sm:p-5 border-l-4 border-blue-500 bg-blue-50/40`}>
                    <p className="text-sm font-semibold text-blue-900 mb-2">¿Para qué sirve esta pantalla?</p>
                    <ul className="text-sm text-blue-900/90 space-y-1 list-disc list-inside">
                        <li>Ver los datos de tu usuario y empresa.</li>
                        <li>Activar alertas cuando respondan o actualicen tus tickets.</li>
                        <li>Cambiar tu contraseña de acceso al sistema.</li>
                    </ul>
                    <p className="text-xs text-blue-800/80 mt-3">
                        Para crear o seguir tickets, andá a{' '}
                        <Link to="/client/tickets" className="font-semibold underline">
                            Mis Tickets
                        </Link>{' '}
                        desde el menú lateral.
                    </p>
                </div>
            )}

            <div className={`${clCard} p-6`}>
                <h2 className="text-xl font-bold mb-1 text-slate-900">Datos de la cuenta</h2>
                <p className="text-xs text-gray-500 mb-4">
                    {isClient
                        ? 'Información asociada a tu usuario en el sistema de tickets.'
                        : 'Información general de tu usuario.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-gray-700">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Usuario</p>
                        <p className="font-medium">{user.username}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</p>
                        <p className="font-medium">{displayName}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
                        <p className="font-medium">{user.email}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rol</p>
                        <p className="font-medium">{roleLabel}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Empresa</p>
                        <p className="font-medium">{resolvedCompanyName}</p>
                    </div>
                    {!isClient && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Departamento</p>
                            <p className="font-medium">
                                {loadingDetails ? 'Cargando...' : departmentName}
                            </p>
                        </div>
                    )}
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
                <h2 className="text-xl font-bold mb-1 text-slate-900">Alertas en el navegador</h2>
                <p className="text-sm text-gray-600 mb-4">
                    {isClient
                        ? 'Activá las notificaciones para enterarte cuando un agente responda o cambie el estado de tus tickets, incluso si no tenés esta pestaña abierta.'
                        : 'Activá las notificaciones para recibir alertas incluso con el navegador cerrado.'}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <PushNotificationButton />
                    {showStaffNotificationTools && (
                        <button
                            type="button"
                            onClick={handleTestPush}
                            disabled={testingPush}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {testingPush ? 'Enviando...' : 'Probar alerta'}
                        </button>
                    )}
                </div>
            </div>

            {canEditNotificationPrefs && (
                <div className={`${clCard} p-6`}>
                    <h2 className="text-xl font-bold mb-1 text-slate-900">Preferencias de notificación</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        {isClient
                            ? 'Elegí dónde querés recibir avisos sobre tus tickets. Si no completás el email alternativo, usamos el de tu cuenta.'
                            : 'Configurá los canales donde querés recibir alertas del sistema.'}
                    </p>
                    <form onSubmit={handleSaveNotificationPrefs} className="space-y-4 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Email para alertas
                            </label>
                            <p className="text-xs text-gray-500 mb-1">
                                Dejalo vacío para usar <strong>{user.email}</strong>
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="email"
                                    value={notificationEmail}
                                    onChange={(e) => setNotificationEmail(e.target.value)}
                                    placeholder={user.email}
                                    className={`flex-1 ${clInput}`}
                                />
                                {showStaffNotificationTools && (
                                    <button
                                        type="button"
                                        onClick={handleTestEmail}
                                        disabled={testingEmail || (!notificationEmail.trim() && !user?.email)}
                                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {testingEmail ? 'Enviando...' : 'Probar email'}
                                    </button>
                                )}
                            </div>
                        </div>
                        {showStaffNotificationTools && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Número de WhatsApp (con código de país)
                                </label>
                                <input
                                    type="text"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                    placeholder="Ej: +54 9 11 1234-5678"
                                    className={`mt-1 block w-full ${clInput}`}
                                />
                                {whatsappHelp && (whatsappHelp.sandboxJoinCode || whatsappHelp.sandboxNumber) && (
                                    <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                                        <p className="font-medium mb-2">Para recibir notificaciones por WhatsApp (modo prueba):</p>
                                        <ol className="list-decimal list-inside space-y-1 mb-2 text-xs">
                                            <li>Guarde su número arriba y haga clic en &quot;Guardar preferencias&quot;.</li>
                                            <li>En WhatsApp, agregue <strong>{whatsappHelp.sandboxNumber || '+1 415 523 8886'}</strong></li>
                                            <li>Envíe: <strong>join {whatsappHelp.sandboxJoinCode || '???'}</strong></li>
                                        </ol>
                                        <button
                                            type="button"
                                            onClick={handleTestWhatsApp}
                                            disabled={testingWhatsApp || !whatsappNumber.trim()}
                                            className="mt-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {testingWhatsApp ? 'Enviando...' : 'Probar WhatsApp'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
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
                            <label className="text-sm font-medium text-gray-700">
                                Recibir notificaciones push
                            </label>
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
                <h2 className="text-xl font-bold mb-1 text-slate-900">Cambiar contraseña</h2>
                <p className="text-sm text-gray-600 mb-4">
                    {isClient
                        ? 'Usá una contraseña segura que solo vos conozcas. La necesitás cada vez que ingresás al sistema.'
                        : 'Actualizá tu contraseña de acceso cuando lo consideres necesario.'}
                </p>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contraseña actual</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={`mt-1 block w-full ${clInput}`} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`mt-1 block w-full ${clInput}`} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`mt-1 block w-full ${clInput}`} required />
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm" disabled={isUpdatingPassword}>
                            {isUpdatingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;