import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PurchaseRequestForm from '../components/Purchases/PurchaseRequestForm';

const PurchaseRequestPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isBacar = ['admin', 'agent', 'boss', 'purchasing'].includes(user?.role || '') ||
        (user?.role === 'client' && user?.company_name && String(user.company_name).toLowerCase().includes('bacar'));
    if (user && !isBacar) {
        const backTo = user.role === 'supplier' ? '/purchases' : '/client';
        return (
            <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600 mb-4">Solo empleados de Bacar pueden crear solicitudes de compra.</p>
                <Link to={backTo} className="text-red-600 hover:underline font-medium">Volver</Link>
            </div>
        );
    }
    return (
        <div className="max-w-2xl mx-auto">
            <Link to="/purchases" className="text-gray-600 hover:text-red-600 mb-4 inline-block">
                ← Volver a mis solicitudes
            </Link>
            <PurchaseRequestForm onSuccess={() => navigate('/purchases')} />
        </div>
    );
};

export default PurchaseRequestPage;
