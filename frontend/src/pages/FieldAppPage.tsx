import React, { useCallback, useEffect, useState } from 'react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Depositario } from '../types';
import { toast } from 'react-toastify';
import RouteGeneratorModal from '../components/Depositarios/RouteGeneratorModal';
import { MaintenanceModal } from './DepositariosPage';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstalledApp(): boolean {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

const FieldAppPage: React.FC = () => {
    const { logout } = useAuth();
    const [depositarios, setDepositarios] = useState<Depositario[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Depositario | null>(null);
    const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIosHelp, setShowIosHelp] = useState(false);
    const [hideInstall, setHideInstall] = useState(isInstalledApp);

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
        fetchData();
    }, [fetchData]);

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
        document.title = 'Recorridos Bacar';

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        }

        const onPrompt = (event: Event) => {
            event.preventDefault();
            setInstallEvent(event as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);

        const apple = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
        if (apple && !isInstalledApp()) setShowIosHelp(true);

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

    return (
        <div className="min-h-screen bg-slate-900">
            {!hideInstall && (installEvent || showIosHelp) && (
                <div className="fixed top-0 inset-x-0 z-[1200] bg-amber-300 text-slate-900 px-4 py-3 shadow-lg">
                    <p className="text-sm font-semibold">Instalá Recorridos en este equipo</p>
                    {installEvent ? (
                        <p className="text-xs mt-1">Queda como una app. La próxima vez se abre directo, sin entrar a la web.</p>
                    ) : (
                        <p className="text-xs mt-1">En el iPhone o iPad: Compartir y después “Agregar a inicio”. El ícono abre esta pantalla.</p>
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
            )}

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
