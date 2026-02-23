import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const SuccessApprovalPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const approved = searchParams.get('approved');
    const error = searchParams.get('error');

    const getContent = () => {
        if (error === 'used') {
            return {
                title: 'Este link ya fue utilizado',
                message: 'La solicitud de compra ya fue procesada anteriormente. Si desea revisar el estado, inicie sesión en el sistema.',
                icon: '⚠️',
                variant: 'warning',
            };
        }
        if (error === 'invalid') {
            return {
                title: 'Link inválido o expirado',
                message: 'El enlace de aprobación no es válido o ha expirado (7 días). Solicite que se reenvíe el correo al empleado.',
                icon: '❌',
                variant: 'error',
            };
        }
        if (error === 'notfound') {
            return {
                title: 'Solicitud no encontrada',
                message: 'No se encontró la solicitud de compra asociada a este enlace.',
                icon: '🔍',
                variant: 'error',
            };
        }
        if (error === 'unavailable' || error === 'server') {
            return {
                title: 'Error del servicio',
                message: 'No se pudo procesar su solicitud. Por favor, intente más tarde o inicie sesión en el sistema.',
                icon: '⚠️',
                variant: 'error',
            };
        }
        if (approved === 'true') {
            return {
                title: '¡Solicitud aprobada!',
                message: 'Ha aprobado la solicitud de compra correctamente. El Encargado de Compras ha sido notificado.',
                icon: '✅',
                variant: 'success',
            };
        }
        if (approved === 'false') {
            return {
                title: 'Solicitud rechazada',
                message: 'Ha rechazado la solicitud de compra. El solicitante puede ver el estado desde su panel.',
                icon: '📋',
                variant: 'info',
            };
        }
        return {
            title: 'Resultado de la aprobación',
            message: 'Si llegó aquí por error, puede iniciar sesión para gestionar sus solicitudes.',
            icon: '📩',
            variant: 'neutral',
        };
    };

    const content = getContent();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-2xl text-center">
                <span className="text-6xl block mb-4">{content.icon}</span>
                <h1 className="text-2xl font-bold text-gray-800 mb-4">{content.title}</h1>
                <p className="text-gray-600 mb-8">{content.message}</p>
                <Link
                    to="/login"
                    className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                    Ir al Login
                </Link>
                <p className="mt-4 text-sm text-gray-500">
                    <Link to="/purchases/approvals" className="text-red-600 hover:underline">
                        Ver solicitudes pendientes
                    </Link>
                    {' (requiere sesión)'}
                </p>
            </div>
        </div>
    );
};

export default SuccessApprovalPage;
