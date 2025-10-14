import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// ✅ RUTAS CORREGIDAS: Se usan rutas relativas validadas.
// Esta ruta asume que tu archivo está en 'src/pages/Auth/RegisterPage.tsx'.
import api from '../../config/axiosConfig';
import { Company, Department, ApiResponseError } from '../../types';
import { isAxiosErrorTypeGuard } from '../../utils/typeGuards';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
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
                setFormData(prev => ({ ...prev, department_id: '' }));
                return;
            }
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
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNextStep = () => {
        setError(null);
        if (step === 1) {
            if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) return setError('Por favor, completa todos los campos.');
            if (formData.password !== formData.confirmPassword) return setError('Las contraseñas no coinciden.');
            if (formData.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
        }
        setStep(prev => prev + 1);
    };

    const handlePrevStep = () => setStep(prev => prev - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
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
            setStep(4);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error en el registro.' : 'Ocurrió un error inesperado.';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = "w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <>
                        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Paso 1: Tus Datos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="firstName" type="text" placeholder="Nombre" value={formData.firstName} onChange={handleChange} required className={inputStyle} />
                            <input name="lastName" type="text" placeholder="Apellido" value={formData.lastName} onChange={handleChange} required className={inputStyle} />
                        </div>
                        <input name="email" type="email" placeholder="Correo Electrónico" value={formData.email} onChange={handleChange} required className={`w-full mt-4 ${inputStyle}`} />
                        <input name="password" type="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} required className={`w-full mt-4 ${inputStyle}`} />
                        <input name="confirmPassword" type="password" placeholder="Confirmar Contraseña" value={formData.confirmPassword} onChange={handleChange} required className={`w-full mt-4 ${inputStyle}`} />
                    </>
                );
            case 2:
                return (
                    <>
                        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Paso 2: Tu Empresa</h2>
                        <select name="company_id" value={formData.company_id} onChange={handleChange} required className={inputStyle}>
                            <option value="">Selecciona tu empresa</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </>
                );
            case 3:
                return (
                    <>
                        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Paso 3: Tu Departamento</h2>
                        <select name="department_id" value={formData.department_id} onChange={handleChange} required className={inputStyle} disabled={loading || departments.length === 0}>
                            <option value="">Selecciona tu departamento</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </>
                );
            case 4:
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-green-600 mb-4">¡Registro Exitoso!</h2>
                        <p className="text-gray-700">Hemos enviado un correo electrónico a <strong>{formData.email}</strong>.</p>
                        <p className="text-gray-700 mt-2">Por favor, sigue las instrucciones para activar tu cuenta.</p>
                        <button onClick={() => navigate('/login')} className="w-full bg-red-600 text-white py-3 rounded-lg mt-6 hover:bg-red-700 font-semibold">
                            Volver al Inicio de Sesión
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
                {step !== 4 ? (
                    <>
                        <img className="mx-auto h-20 sm:h-28 w-auto" src="/images/logo-grupo-bacar-horizontal.png" alt="Grupo BACAR" />
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <p className="bg-red-100 text-red-700 p-3 rounded text-center text-sm">{error}</p>}
                            
                            {renderStep()}

                            <div className="flex justify-between items-center pt-4">
                                {step > 1 && (
                                    <button type="button" onClick={handlePrevStep} className="bg-gray-200 text-gray-800 py-2 px-4 sm:px-6 rounded-lg hover:bg-gray-300 font-semibold">
                                        Anterior
                                    </button>
                                )}
                                <div className="ml-auto">
                                    {step < 3 && (
                                        <button type="button" onClick={handleNextStep} className="bg-red-600 text-white py-2 px-4 sm:px-6 rounded-lg hover:bg-red-700 font-semibold">
                                            Siguiente
                                        </button>
                                    )}
                                    {step === 3 && (
                                        <button type="submit" className="bg-green-600 text-white py-2 px-4 sm:px-6 rounded-lg hover:bg-green-700 font-semibold" disabled={loading}>
                                            {loading ? 'Registrando...' : 'Finalizar Registro'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </>
                ) : renderStep()}
                
                <p className="text-center text-sm text-gray-600 pt-4">
                    ¿Ya tienes una cuenta?{' '}
                    <Link to="/login" className="font-medium text-red-600 hover:text-red-500">
                        Inicia Sesión aquí
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;

