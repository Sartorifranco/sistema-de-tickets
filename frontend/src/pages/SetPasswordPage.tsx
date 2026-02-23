import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';

const SetPasswordPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);
    const [valid, setValid] = useState(false);
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (!token) {
            setValidating(false);
            setValid(false);
            return;
        }
        api.get(`/api/auth/validate-invitation/${token}`)
            .then((res) => {
                setValid(res.data?.valid === true);
                setEmail(res.data?.email || '');
            })
            .catch(() => setValid(false))
            .finally(() => setValidating(false));
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        if (password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post(`/api/auth/set-password/${token}`, { password });
            if (res.data.success) {
                toast.success('Contraseña establecida. Ya puede iniciar sesión.');
                navigate('/login');
            } else {
                toast.error(res.data.message || 'Error al establecer contraseña.');
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error. El link puede haber expirado.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-2xl text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto" />
                    <p className="mt-4 text-gray-600">Verificando link...</p>
                </div>
            </div>
        );
    }

    if (!valid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-2xl text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">Link inválido o expirado</h1>
                    <p className="text-gray-600 mb-6">
                        El link de invitación no es válido o ha expirado. Solicite uno nuevo al Encargado de Compras.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
                    >
                        Ir al Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-2xl">
                <img
                    className="mx-auto h-20 w-auto"
                    src="/images/logo-grupo-bacar-horizontal.png"
                    alt="Grupo BACAR"
                />
                <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">
                    Establecer contraseña
                </h1>
                {email && (
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Cuenta: {email}
                    </p>
                )}
                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Nueva contraseña *
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                            Confirmar contraseña *
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-red-500 focus:border-red-500"
                            placeholder="Repetir contraseña"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetPasswordPage;
