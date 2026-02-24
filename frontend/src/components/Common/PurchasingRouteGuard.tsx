import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessPurchasingModule } from '../../config/purchasingFeatureFlag';

interface PurchasingRouteGuardProps {
    children: React.ReactNode;
    fallbackTo?: string;
}

/**
 * Protege las rutas del módulo de compras.
 * Solo usuarios con correo en PURCHASING_ALLOWED_EMAILS pueden acceder.
 */
const PurchasingRouteGuard: React.FC<PurchasingRouteGuardProps> = ({
    children,
    fallbackTo = '/client'
}) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!canAccessPurchasingModule(user.email)) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center bg-gray-100 p-6">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h1>
                    <p className="text-gray-600 mb-6">
                        El Módulo de Compras no está disponible para su usuario en este momento.
                    </p>
                    <button
                        onClick={() => navigate(fallbackTo)}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default PurchasingRouteGuard;
