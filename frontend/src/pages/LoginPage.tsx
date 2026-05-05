import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { toast } from 'react-toastify';
import { clInput } from '../utils/cleanLightUi';

/** Video local en `public/assets/video/`. */
const LOGIN_VIDEO = '/assets/video/login-video.mp4';

/** Textura SVG muy sutil (ruido) para disimular bandas de compresión en clips suaves. */
const GRAIN_TEXTURE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const videoSharpStyle: React.CSSProperties = {
    objectFit: 'cover',
    imageRendering: 'auto',
    // Refuerzo de nitidez perceptiva en escalado (compatible con la mayoría de navegadores)
    filter: 'brightness(1.02) contrast(1.06) saturate(1.04)',
};

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

    const urbanist = { fontFamily: "'Urbanist', ui-sans-serif, system-ui, sans-serif", fontWeight: 500 as const };

    return (
        <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden md:flex-row" style={urbanist}>
            {/* 70% — video escalado (recorta marca de agua), overlays y degradado fino */}
            <div className="relative h-[38vh] w-full min-h-0 shrink-0 overflow-hidden bg-slate-900 md:h-full md:w-[70%] md:min-w-0 md:shrink-0">
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="absolute left-1/2 top-1/2 z-0 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 origin-center scale-[1.12] transform-gpu object-cover will-change-transform"
                    src={LOGIN_VIDEO}
                    style={videoSharpStyle}
                />
                <div className="pointer-events-none absolute inset-0 z-[1] bg-black/10" aria-hidden />
                <div
                    className="pointer-events-none absolute inset-0 z-[2] opacity-[0.045] mix-blend-soft-light"
                    style={{
                        backgroundImage: `url("${GRAIN_TEXTURE}")`,
                        backgroundSize: '180px 180px',
                    }}
                    aria-hidden
                />
                {/* Unión suave con columna blanca: mismo blanco final (#fff) */}
                <div
                    className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-r from-transparent from-80% via-white/40 via-[91%] to-white"
                    aria-hidden
                />
            </div>

            {/* 30% — ancho completo del panel (sin max-w-sm) para alinear logo, textos e inputs */}
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto bg-white px-5 py-8 sm:px-8 md:h-full md:w-[30%] md:flex-none md:shrink-0 md:px-8 md:py-10 lg:px-10">
                <div className="flex w-full max-w-full flex-col font-medium">
                    <div className="flex w-full flex-col items-center text-center">
                        <img
                            className="mx-auto h-24 w-auto max-w-[min(100%,260px)] object-contain drop-shadow-sm sm:h-28"
                            src="/images/logo-grupo-bacar-horizontal.png"
                            alt="Grupo BACAR"
                        />
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Bacar OS</p>
                        <h1 className="mt-6 text-2xl font-medium leading-tight text-slate-900 sm:text-3xl">Bienvenido</h1>
                        <p className="mt-2 max-w-full text-sm font-medium leading-snug text-slate-600">
                            Ingresá con tu cuenta corporativa
                        </p>
                    </div>

                    <form className="mt-10 w-full space-y-6" onSubmit={handleSubmit} noValidate style={{ fontWeight: 500 }}>
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="email-address" className="mb-1.5 block text-sm font-medium text-slate-900">
                                    Correo electrónico
                                </label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className={`${clInput} !font-medium w-full rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                    placeholder="nombre@empresa.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-900">
                                    Contraseña
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className={`${clInput} !font-medium w-full rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-xl bg-[#DC2626] px-4 py-3 text-sm !font-medium text-white shadow-sm transition-colors hover:bg-[#B91C1C] focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:ring-offset-2 disabled:bg-gray-400 disabled:hover:bg-gray-400"
                            disabled={loading}
                            style={{ fontWeight: 500 }}
                        >
                            {loading ? 'Iniciando sesión...' : 'Ingresar'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm font-medium text-slate-600">
                        ¿No tenés cuenta?{' '}
                        <Link
                            to="/register"
                            className="font-medium text-[#DC2626] underline-offset-2 hover:text-[#B91C1C] hover:underline"
                        >
                            Registrate aquí
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
