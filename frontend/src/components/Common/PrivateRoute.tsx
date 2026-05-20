import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PermissionKey } from '../../constants/permissions';
import { hasAnyPermission, hasPermission } from '../../utils/permissions';

interface PrivateRouteProps {
    children: React.ReactElement;
    roles?: string[];
    /** Permiso requerido si el usuario es admin (RBAC) */
    permission?: PermissionKey;
    /** Cualquiera de estos permisos (admin) */
    anyPermission?: PermissionKey[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, roles, permission, anyPermission }) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Cargando...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && roles.length > 0 && user && !roles.includes(user.role)) {
        return (
            <div className="p-8 text-center text-red-500">No tenés permiso para acceder a esta página.</div>
        );
    }

    if (user?.role === 'admin') {
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
