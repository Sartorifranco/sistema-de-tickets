import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { toast } from 'react-toastify';
import { clInput } from '../utils/cleanLightUi';

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
        <div className="flex h-screen min-h-0 w-full flex-col lg:flex-row font-medium">
            {/* Video — mitad izquierda (desktop); arriba en móvil */}
            <div className="relative h-[38vh] w-full shrink-0 overflow-hidden bg-slate-900 lg:h-full lg:w-1/2">
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                    src="/assets/video/it-systems.mp4"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/20" />
            </div>

            {/* Formulario — mitad derecha */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-gray-100 via-white to-gray-50 px-4 py-10 sm:px-8 lg:w-1/2 lg:py-12">
                <div className="w-full max-w-md">
                    <div
                        className="rounded-2xl border border-white/60 bg-white/75 px-8 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.08)] backdrop-blur-md sm:px-10 sm:py-12"
                        style={{ fontFamily: "'Urbanist', ui-sans-serif, system-ui, sans-serif" }}
                    >
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
                                        className={`${clInput} rounded-xl border-gray-200/90 text-slate-900 placeholder:text-slate-400`}
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
                                        className={`${clInput} rounded-xl border-gray-200/90 text-slate-900 placeholder:text-slate-400`}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:bg-gray-400"
                                disabled={loading}
                            >
                                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                            </button>
                        </form>

                        <p className="mt-8 text-center text-sm text-slate-600">
                            ¿No tenés cuenta?{' '}
                            <Link
                                to="/register"
                                className="font-semibold text-red-600 underline-offset-2 hover:text-red-700 hover:underline"
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
