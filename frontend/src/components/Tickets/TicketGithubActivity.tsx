import React, { useEffect, useState } from 'react';
import api from '../../config/axiosConfig';
import { formatLocalDate } from '../../utils/dateFormatter';

export interface GithubCommitItem {
    sha: string;
    message: string;
    date: string | null;
    html_url: string;
    author_name?: string;
    author_login?: string;
}

const GitHubMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
        />
    </svg>
);

type Props = {
    ticketId: number;
    githubRepo: string;
};

/**
 * Lista commits del repo que mencionan el ticket (usa token configurado en perfil).
 */
const TicketGithubActivity: React.FC<Props> = ({ ticketId, githubRepo }) => {
    const [commits, setCommits] = useState<GithubCommitItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get(`/api/tickets/${ticketId}/github-commits`);
                if (cancelled) return;
                if (res.data.success && res.data.data?.commits) {
                    setCommits(res.data.data.commits);
                } else {
                    setCommits([]);
                }
            } catch (err: unknown) {
                if (cancelled) return;
                const msg =
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'No se pudo cargar la actividad de GitHub.';
                setError(msg);
                setCommits([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [ticketId]);

    const authorLabel = (c: GithubCommitItem) => {
        if (c.author_login) return `@${c.author_login}`;
        if (c.author_name) return c.author_name;
        return 'Autor desconocido';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <div className="flex items-center gap-2 mb-4 border-b pb-3">
                <GitHubMark className="w-6 h-6 text-gray-800" />
                <h2 className="text-xl font-bold text-gray-800">Actividad en GitHub</h2>
                <span className="text-xs font-mono text-gray-500 ml-auto truncate max-w-[50%]" title={githubRepo}>
                    {githubRepo}
                </span>
            </div>

            {loading && (
                <div className="flex items-center gap-3 py-8 text-gray-600">
                    <div className="h-8 w-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                    <span>Cargando commits desde GitHub…</span>
                </div>
            )}

            {!loading && error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <strong className="font-semibold">No se pudo obtener la actividad.</strong>
                    <p className="mt-1">{error}</p>
                    <p className="mt-2 text-xs text-red-700">
                        Verificá el token en Configuración de desarrollador (perfil), que el repo exista y que tengas
                        permisos de lectura.
                    </p>
                </div>
            )}

            {!loading && !error && commits.length === 0 && (
                <p className="text-gray-600 text-sm py-4">
                    No hay commits en este repositorio que mencionen el ticket #{ticketId} (buscamos{' '}
                    <code className="bg-gray-100 px-1 rounded">#{ticketId}</code> o el número en el mensaje).
                </p>
            )}

            {!loading && !error && commits.length > 0 && (
                <ul className="space-y-4">
                    {commits.map((c) => (
                        <li
                            key={c.sha}
                            className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 hover:border-gray-300 transition-colors"
                        >
                            <div className="flex flex-wrap items-start gap-2 justify-between">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <GitHubMark className="w-4 h-4 text-gray-700 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-gray-900 font-medium break-words">{c.message}</p>
                                        <p className="text-xs text-gray-600 mt-2">
                                            <span className="font-semibold text-gray-700">{authorLabel(c)}</span>
                                            {c.date && (
                                                <>
                                                    {' · '}
                                                    {formatLocalDate(c.date)}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {c.html_url && (
                                    <a
                                        href={c.html_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                                    >
                                        Ver en GitHub
                                    </a>
                                )}
                            </div>
                            <p className="text-[10px] font-mono text-gray-400 mt-2 truncate">{c.sha}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TicketGithubActivity;
