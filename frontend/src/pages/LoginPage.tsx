import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { toast } from 'react-toastify';
import { clInput } from '../utils/cleanLightUi';

/** Video local en `public/assets/video/` (People Technology 4K). */
const LOGIN_VIDEO = '/assets/video/login-video.mp4';

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
            {/* 70% — video + contraste + degradado hacia blanco (encaje con columna derecha) */}
            <div className="relative h-[38vh] w-full min-h-0 shrink-0 overflow-hidden bg-slate-900 md:h-full md:w-[70%] md:min-w-0 md:shrink-0">
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="relative z-0 h-full w-full object-cover"
                    src={LOGIN_VIDEO}
                />
                {/* Contraste muy suave: el video sigue siendo protagonista */}
                <div className="pointer-events-none absolute inset-0 z-[1] bg-black/10" aria-hidden />
                {/* Difuminado solo en el último ~20% antes del formulario */}
                <div
                    className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-transparent from-80% via-white/50 via-90% to-white"
                    aria-hidden
                />
            </div>

            {/* 30% — bg-white alineado al final del degradado */}
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto bg-white px-4 py-8 sm:px-6 md:h-full md:w-[30%] md:flex-none md:shrink-0 md:py-10">
                <div className="w-full max-w-sm px-6 py-4 font-medium sm:px-8 sm:py-6">
                    <div className="flex flex-col items-center text-center">
                        <img
                            className="h-24 w-auto max-w-full object-contain drop-shadow-sm sm:h-28"
                            src="/images/logo-grupo-bacar-horizontal.png"
                            alt="Grupo BACAR"
                        />
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Bacar OS</p>
                        <h1 className="mt-6 text-2xl font-medium leading-tight text-slate-900 sm:text-3xl">Bienvenido</h1>
                        <p className="mt-2 text-sm font-medium text-slate-600">Ingresá con tu cuenta corporativa</p>
                    </div>

                    <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate style={{ fontWeight: 500 }}>
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
                                    className={`${clInput} !font-medium rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
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
                                    className={`${clInput} !font-medium rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
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
