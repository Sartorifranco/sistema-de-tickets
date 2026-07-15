import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PermissionKey } from '../../constants/permissions';
import { hasAnyPermission, hasPermission } from '../../utils/permissions';
import { SystemModuleKey } from '../../constants/systemModules';
import { useModuleEnabled } from '../../context/SystemModulesContext';

interface PrivateRouteProps {
    children: React.ReactElement;
    roles?: string[];
    /** Permiso requerido para admin o agente (RBAC) */
    permission?: PermissionKey;
    /** Cualquiera de estos permisos (admin/agente) */
    anyPermission?: PermissionKey[];
    /** Módulo opcional: si está deshabilitado globalmente, bloquea la ruta */
    module?: SystemModuleKey;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({
    children,
    roles,
    permission,
    anyPermission,
    module,
}) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();
    const moduleEnabled = useModuleEnabled(module);

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Cargando...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!moduleEnabled) {
        return (
            <div className="p-8 text-center text-red-500">
                Este módulo está desactivado en Configuración.
            </div>
        );
    }

    if (roles && roles.length > 0 && user && !roles.includes(user.role)) {
        return (
            <div className="p-8 text-center text-red-500">No tenés permiso para acceder a esta página.</div>
        );
    }

    if (user?.role === 'admin' || user?.role === 'agent') {
        if (permission && !hasPermission(user, permission)) {
            return (
                <div className="p-8 text-center text-red-500">
                    No tenés permiso para acceder a esta sección.
                </div>
            );
        }
        if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(user, anyPermission)) {
            return (
                <div className="p-8 text-center text-red-500">
                    No tenés permiso para acceder a esta sección.
                </div>
            );
        }
    }

    return children;
};

export default PrivateRoute;
