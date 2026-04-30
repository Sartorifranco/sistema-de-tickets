import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { toast } from 'react-toastify';
import { clInput } from '../utils/cleanLightUi';

/** CDN directo .mp4 (alta disponibilidad) */
const LOGIN_HERO_VIDEO = 'https://v1.exhibit.com/videos/exhibit-hero-v1.mp4';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, user } = useAuth();
    const { addNotification } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            if (user.role === 'supplier') navigate('/purchases', { replace: true });
            else if (user.role === 'boss' || user.role === 'purchasing') navigate('/client', { replace: true });
            else navigate(`/${user.role}`, { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const success = await login({ email, password });
            if (success) {
                addNotification('Inicio de sesión exitoso.', 'success');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error en el inicio de sesión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="flex h-screen min-h-0 w-full flex-col overflow-hidden font-medium md:flex-row"
            style={{ fontFamily: "'Urbanist', ui-sans-serif, system-ui, sans-serif" }}
        >
            {/* Video — 50% desktop; bloque superior en móvil (z-index por encima del panel derecho en el stack local) */}
            <div className="relative z-10 isolate h-[36vh] w-full min-h-0 shrink-0 overflow-hidden bg-slate-950 md:h-full md:w-1/2">
                <div className="relative z-[1] h-full w-full min-h-0">
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover"
                        src={LOGIN_HERO_VIDEO}
                    />
                </div>
                {/* Gradiente muy suave solo para legibilidad en el borde; no tapa el video */}
                <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/25 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/15" />
            </div>

            {/* Formulario — 50% Clean & Light; z-0 para no superponerse al panel del video */}
            <div className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-white px-4 py-8 sm:px-8 md:w-1/2 md:py-12">
                <div className="w-full max-w-md">
                    <div className="rounded-2xl border border-gray-100 bg-white px-6 py-9 shadow-sm sm:px-10 sm:py-11">
                        <div className="flex flex-col items-center text-center">
                            <img
                                className="h-24 w-auto max-w-full object-contain drop-shadow-sm sm:h-28"
                                src="/images/logo-grupo-bacar-horizontal.png"
                                alt="Grupo BACAR"
                            />
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bacar OS</p>
                            <h1 className="mt-6 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">Bienvenido</h1>
                            <p className="mt-2 text-sm text-slate-600">Ingresá con tu cuenta corporativa</p>
                        </div>

                        <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
                            <div className="space-y-5">
                                <div>
                                    <label htmlFor="email-address" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="email-address"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                        placeholder="nombre@empresa.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                        Contraseña
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-xl bg-[#DC2626] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B91C1C] focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:ring-offset-2 disabled:bg-gray-400 disabled:hover:bg-gray-400"
                                disabled={loading}
                            >
                                {loading ? 'Iniciando sesión...' : 'Ingresar'}
                            </button>
                        </form>

                        <p className="mt-8 text-center text-sm text-slate-600">
                            ¿No tenés cuenta?{' '}
                            <Link
                                to="/register"
                                className="font-semibold text-[#DC2626] underline-offset-2 hover:text-[#B91C1C] hover:underline"
                            >
                                Registrate aquí
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
