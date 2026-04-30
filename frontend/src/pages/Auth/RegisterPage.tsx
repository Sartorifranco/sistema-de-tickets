import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../config/axiosConfig';
import { Company, Department, ApiResponseError } from '../../types';
import { isAxiosErrorTypeGuard } from '../../utils/typeGuards';
import { clCard, clInput } from '../../utils/cleanLightUi';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        company_id: '',
        department_id: '',
    });

    const [companies, setCompanies] = useState<Company[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await api.get('/api/public/companies');
                setCompanies(response.data.data || []);
            } catch (err) {
                toast.error('No se pudieron cargar las empresas.');
            }
        };
        fetchCompanies();
    }, []);

    useEffect(() => {
        const fetchDepartments = async () => {
            if (!formData.company_id) {
                setDepartments([]);
                setFormData((prev) => ({ ...prev, department_id: '' }));
                return;
            }
            setFormData((prev) => ({ ...prev, department_id: '' }));
            try {
                const response = await api.get(`/api/public/departments?company_id=${formData.company_id}`);
                setDepartments(response.data.data || []);
            } catch (err) {
                toast.error('No se pudieron cargar los departamentos.');
            }
        };
        fetchDepartments();
    }, [formData.company_id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const validateForm = (): string | null => {
        if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
            return 'Por favor, completá nombre y apellido.';
        }
        if (!formData.email?.trim()) return 'Por favor, ingresá tu correo electrónico.';
        if (!formData.password) return 'Por favor, ingresá una contraseña.';
        if (formData.password !== formData.confirmPassword) return 'Las contraseñas no coinciden.';
        if (formData.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
        if (!formData.company_id) return 'Seleccioná tu empresa.';
        if (!formData.department_id) return 'Seleccioná tu departamento.';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }
        setLoading(true);
        try {
            await api.post('/api/auth/register', {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                company_id: formData.company_id,
                department_id: formData.department_id,
            });
            setRegistrationSuccess(true);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err)
                ? (err.response?.data as ApiResponseError)?.message || 'Error en el registro.'
                : 'Ocurrió un error inesperado.';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const selectBase = `${clInput} rounded-xl text-slate-900`;

    return (
        <div
            className="min-h-screen bg-gray-50 px-4 py-10 font-medium sm:px-6 lg:px-8"
            style={{ fontFamily: "'Urbanist', ui-sans-serif, system-ui, sans-serif" }}
        >
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center">
                <div className={`${clCard} w-full p-6 shadow-sm sm:p-8`}>
                    <div className="mb-8 flex flex-col items-center text-center">
                        <img
                            className="h-20 w-auto max-w-full object-contain sm:h-28"
                            src="/images/logo-grupo-bacar-horizontal.png"
                            alt="Grupo BACAR"
                        />
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bacar OS</p>
                        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Crear cuenta</h1>
                        <p className="mt-2 text-sm text-slate-600">Completá todos los datos para registrarte</p>
                    </div>

                    {registrationSuccess ? (
                        <div className="text-center">
                            <h2 className="mb-4 text-2xl font-bold text-emerald-600">¡Registro exitoso!</h2>
                            <p className="text-slate-700">
                                Hemos enviado un correo electrónico a <strong>{formData.email}</strong>.
                            </p>
                            <p className="mt-2 text-slate-700">Por favor, seguí las instrucciones para activar tu cuenta.</p>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="mt-8 w-full rounded-xl bg-red-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                            >
                                Volver al inicio de sesión
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-center text-sm font-medium text-red-800">
                                    {error}
                                </p>
                            )}

                            <section className="space-y-4 border-b border-gray-100 pb-6">
                                <h2 className="text-lg font-bold text-slate-900">Datos personales</h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="firstName" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                            Nombre
                                        </label>
                                        <input
                                            id="firstName"
                                            name="firstName"
                                            type="text"
                                            autoComplete="given-name"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            required
                                            className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                            placeholder="Tu nombre"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="lastName" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                            Apellido
                                        </label>
                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            autoComplete="family-name"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            required
                                            className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                            placeholder="Tu apellido"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                        placeholder="nombre@empresa.com"
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
                                        autoComplete="new-password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                        Confirmar contraseña
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                        className={`${clInput} rounded-xl border-gray-200 text-slate-900 placeholder:text-slate-400`}
                                        placeholder="Repetí la contraseña"
                                    />
                                </div>
                            </section>

                            <section className="space-y-4 border-b border-gray-100 pb-6">
                                <h2 className="text-lg font-bold text-slate-900">Empresa y departamento</h2>
                                <div>
                                    <label htmlFor="company_id" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                        Empresa
                                    </label>
                                    <select
                                        id="company_id"
                                        name="company_id"
                                        value={formData.company_id}
                                        onChange={handleChange}
                                        required
                                        className={selectBase}
                                    >
                                        <option value="">Seleccioná tu empresa</option>
                                        {companies.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="department_id" className="mb-1.5 block text-sm font-semibold text-slate-900">
                                        Departamento
                                    </label>
                                    <select
                                        id="department_id"
                                        name="department_id"
                                        value={formData.department_id}
                                        onChange={handleChange}
                                        required
                                        disabled={!formData.company_id || departments.length === 0}
                                        className={`${selectBase} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-slate-500`}
                                    >
                                        <option value="">
                                            {!formData.company_id
                                                ? 'Primero elegí una empresa'
                                                : departments.length === 0
                                                  ? 'No hay departamentos para esta empresa'
                                                  : 'Seleccioná tu departamento'}
                                        </option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </section>

                            <button
                                type="submit"
                                className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:bg-gray-400"
                                disabled={loading}
                            >
                                {loading ? 'Registrando...' : 'Finalizar registro'}
                            </button>
                        </form>
                    )}

                    {!registrationSuccess && (
                        <p className="mt-8 text-center text-sm text-slate-600">
                            ¿Ya tenés cuenta?{' '}
                            <Link
                                to="/login"
                                className="font-semibold text-red-600 underline-offset-2 hover:text-red-700 hover:underline"
                            >
                                Iniciá sesión aquí
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
