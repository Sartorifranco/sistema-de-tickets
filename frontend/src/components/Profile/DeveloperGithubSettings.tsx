import React, { useEffect, useState } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';
import { clCard, clInput } from '../../utils/cleanLightUi';

type Props = {
    /** Mostrar la tarjeta (admin o departamento Desarrollo) */
    visible: boolean;
};

/**
 * Configuración de token y usuario de GitHub (token cifrado en servidor).
 */
const DeveloperGithubSettings: React.FC<Props> = ({ visible }) => {
    const [githubUsername, setGithubUsername] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [hasToken, setHasToken] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const res = await api.get('/api/developer/settings');
                if (cancelled || !res.data.success) return;
                const d = res.data.data;
                setGithubUsername(d.github_username || '');
                setHasToken(!!d.has_github_token);
                setGithubToken('');
            } catch {
                if (!cancelled) toast.error('No se pudo cargar la configuración de GitHub.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [visible]);

    if (!visible) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body: { github_username: string | null; github_token?: string } = {
                github_username: githubUsername.trim() || null,
            };
            if (githubToken.trim() !== '') {
                body.github_token = githubToken.trim();
            }
            await api.post('/api/developer/settings', body);
            toast.success('Configuración de desarrollador guardada.');
            setGithubToken('');
            const res = await api.get('/api/developer/settings');
            if (res.data.success && res.data.data) {
                setHasToken(!!res.data.data.has_github_token);
                setGithubUsername(res.data.data.github_username || '');
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error al guardar.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleClearToken = async () => {
        if (!window.confirm('¿Eliminar el token de GitHub guardado?')) return;
        setSaving(true);
        try {
            await api.post('/api/developer/settings', {
                github_username: githubUsername.trim() || null,
                github_token: '',
            });
            toast.success('Token eliminado.');
            setGithubToken('');
            setHasToken(false);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error al eliminar el token.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`${clCard} p-6`}>
            <h2 className="text-xl font-semibold mb-1 text-gray-900 border-b border-gray-100 pb-2">Configuración de Desarrollador</h2>
            <p className="text-sm text-gray-600 mb-6">
                Conectá tu cuenta de GitHub para ver commits vinculados a tickets de desarrollo. El token se guarda
                cifrado en el servidor.
            </p>

            {loading ? (
                <p className="text-gray-500 py-4">Cargando…</p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">GitHub Username</label>
                        <input
                            type="text"
                            value={githubUsername}
                            onChange={(e) => setGithubUsername(e.target.value)}
                            placeholder="ej: octocat"
                            autoComplete="username"
                            className={`mt-1 block w-full ${clInput}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            GitHub Personal Access Token
                        </label>
                        <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder={
                                hasToken
                                    ? 'Dejá vacío para mantener el token actual; pegá uno nuevo para reemplazar'
                                    : 'ghp_… o fine-grained token'
                            }
                            autoComplete="off"
                            className={`mt-1 block w-full ${clInput} font-mono text-sm`}
                        />
                        {hasToken && (
                            <p className="mt-1 text-xs text-green-700">Hay un token guardado de forma segura.</p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm disabled:opacity-50"
                        >
                            {saving ? 'Guardando…' : 'Guardar configuración'}
                        </button>
                        {hasToken && (
                            <button
                                type="button"
                                onClick={handleClearToken}
                                disabled={saving}
                                className="border border-red-300 text-red-700 hover:bg-red-50 font-semibold py-2.5 px-5 rounded-xl disabled:opacity-50"
                            >
                                Quitar token
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        Creá un token en GitHub → Settings → Developer settings → Personal access tokens. Scope mínimo:
                        <code className="mx-1 bg-gray-100 px-1 rounded">repo</code> (lectura) para listar commits.
                    </p>
                </form>
            )}
        </div>
    );
};

export default DeveloperGithubSettings;
