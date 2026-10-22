import React, { useCallback, useEffect, useState } from 'react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Depositario } from '../types';
import { toast } from 'react-toastify';
import RouteGeneratorModal from '../components/Depositarios/RouteGeneratorModal';
import { MaintenanceModal } from './DepositariosPage';
import { PERMISSION_KEYS } from '../constants/permissions';
import { hasPermission } from '../utils/permissions';
import { useModuleEnabled } from '../context/SystemModulesContext';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstalledApp(): boolean {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIos(): boolean {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

const FieldLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const ok = await login({ email: email.trim(), password });
            if (ok) onSuccess();
            else setError('No se pudo entrar. Revisá correo y contraseña.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo entrar.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex-1 bg-slate-900 text-white flex flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <form onSubmit={submit} className="m-auto w-full max-w-sm">
                <img src="/images/recorridos-192.png" alt="" className="w-20 h-20 rounded-3xl mb-6" />
                <h1 className="text-3xl font-bold">Recorridos</h1>
                <p className="text-slate-300 mt-1 mb-8">Hoja de ruta del día.</p>
                <label className="block text-sm text-slate-300">
                    Correo
                    <input
                        type="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="mt-1 w-full min-h-14 rounded-2xl bg-slate-800 px-4 text-base text-white outline-none"
                    />
                </label>
                <label className="block text-sm text-slate-300 mt-4">
                    Contraseña
                    <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="mt-1 w-full min-h-14 rounded-2xl bg-slate-800 px-4 text-base text-white outline-none"
                    />
                </label>
                {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
                <button
                    type="submit"
                    disabled={busy}
                    className="mt-6 w-full min-h-14 rounded-2xl bg-red-600 text-lg font-bold disabled:opacity-60"
                >
                    {busy ? 'Entrando…' : 'Entrar'}
                </button>
            </form>
        </div>
    );
};

const FieldAppPage: React.FC = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const moduleEnabled = useModuleEnabled('depositarios');
    const [depositarios, setDepositarios] = useState<Depositario[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Depositario | null>(null);
    const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [hideInstall, setHideInstall] = useState(isInstalledApp);

    const allowed = !!user
        && (user.role === 'admin' || user.role === 'agent')
        && moduleEnabled
        && hasPermission(user, PERMISSION_KEYS.DEPOSITARIOS_VIEW);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/api/depositarios');
            setDepositarios(res.data.data || []);
        } catch {
            toast.error('No se pudieron cargar los depositarios.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && allowed) fetchData();
        else setLoading(false);
    }, [isAuthenticated, allowed, fetchData]);

    useEffect(() => {
        const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
        const previousHref = link?.getAttribute('href');
        if (link) link.setAttribute('href', `${process.env.PUBLIC_URL || ''}/manifest-recorridos.json`);

        const theme = document.querySelector('meta[name="theme-color"]');
        const previousTheme = theme?.getAttribute('content');
        if (theme) theme.setAttribute('content', '#0f172a');

        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
        const previousAppleIcon = appleIcon?.getAttribute('href');
        if (appleIcon) appleIcon.setAttribute('href', `${process.env.PUBLIC_URL || ''}/images/recorridos-192.png`);

        const ensureMeta = (name: string, content: string) => {
            let el = document.querySelector(`meta[name="${name}"]`);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute('name', name);
                document.head.appendChild(el);
            }
            el.setAttribute('content', content);
        };
        ensureMeta('mobile-web-app-capable', 'yes');
        ensureMeta('apple-mobile-web-app-capable', 'yes');
        ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
        ensureMeta('apple-mobile-web-app-title', 'Recorridos');

        const previousTitle = document.title;
        document.title = 'Recorridos';

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        }

        const onPrompt = (event: Event) => {
            event.preventDefault();
            setInstallEvent(event as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);

        return () => {
            if (link && previousHref) link.setAttribute('href', previousHref);
            if (theme && previousTheme) theme.setAttribute('content', previousTheme);
            if (appleIcon && previousAppleIcon) appleIcon.setAttribute('href', previousAppleIcon);
            document.title = previousTitle;
            window.removeEventListener('beforeinstallprompt', onPrompt);
        };
    }, []);

    const install = async () => {
        if (!installEvent) return;
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === 'accepted') setHideInstall(true);
        setInstallEvent(null);
    };

    const installHelp = !hideInstall && (
        <div className={`${isAuthenticated ? 'fixed top-0 inset-x-0 z-[1200]' : ''} bg-amber-300 text-slate-900 px-4 py-3`}>
            <p className="text-sm font-semibold">Dejala en la pantalla de inicio</p>
            {isIos() ? (
                <p className="text-xs mt-1">Tocá Compartir y después “Agregar a inicio”. El ícono abre esta pantalla, sin el menú del sistema.</p>
            ) : installEvent ? (
                <p className="text-xs mt-1">Queda como una app. La próxima vez se abre directo, sin entrar a la web.</p>
            ) : (
                <p className="text-xs mt-1">En el menú del navegador elegí “Instalar aplicación” o “Agregar a la pantalla principal”.</p>
            )}
            <div className="flex gap-2 mt-2">
                {installEvent && (
                    <button type="button" onClick={install} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold">
                        Instalar
                    </button>
                )}
                <button type="button" onClick={() => setHideInstall(true)} className="min-h-11 px-4 rounded-lg bg-white/70 text-sm font-semibold">
                    Ahora no
                </button>
            </div>
        </div>
    );

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col">
                {installHelp}
                <FieldLogin onSuccess={() => undefined} />
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-6 text-center gap-4">
                <h1 className="text-2xl font-bold">Recorridos</h1>
                <p className="text-slate-300">Este usuario no tiene el módulo de depositarios.</p>
                <button type="button" onClick={logout} className="min-h-12 px-5 rounded-2xl bg-white text-slate-900 font-bold">
                    Salir
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {installHelp}
            {loading ? (
                <div className="min-h-screen flex flex-col items-center justify-center text-white gap-3">
                    <p className="text-2xl font-bold">Recorridos</p>
                    <p className="text-sm text-slate-300">Cargando la hoja de hoy…</p>
                </div>
            ) : (
                <RouteGeneratorModal
                    appMode
                    depositarios={depositarios}
                    onClose={logout}
                    onMaintenanceOpen={setSelected}
                />
            )}

            {selected && (
                <MaintenanceModal
                    depositario={selected}
                    onClose={() => setSelected(null)}
                    onSave={fetchData}
                />
            )}
        </div>
    );
};

export default FieldAppPage;
