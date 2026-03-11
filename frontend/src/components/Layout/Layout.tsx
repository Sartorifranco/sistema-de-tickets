import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { FaHome, FaUser, FaUsers, FaBuilding, FaMapMarkerAlt, FaExclamationTriangle, FaTicketAlt, FaChartBar, FaCashRegister, FaDesktop, FaShoppingCart, FaFileInvoice, FaCheckCircle, FaPlusCircle, FaClipboardList } from 'react-icons/fa';
import NotificationBell from '../NotificationBell/NotificationBell';
import FcmTokenHandler from '../FcmTokenHandler/FcmTokenHandler';
import { canAccessPurchasingModule } from '../../config/purchasingFeatureFlag';

const iconClass = 'w-5 h-5 flex-shrink-0';

const Layout: React.FC = () => {
    const { user, logout, refreshSession } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefreshSession = async () => {
        setIsRefreshing(true);
        const ok = await refreshSession();
        setIsRefreshing(false);
        if (ok) toast.success('Sesión renovada correctamente.');
        else toast.error('No se pudo renovar. Iniciá sesión nuevamente.');
    };

    const handleLogout = () => {
        logout();
        toast.info('Sesión cerrada exitosamente.');
    };

    const getLinkClassName = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 ${
            isActive ? 'bg-red-600 text-white shadow-md' : 'hover:bg-gray-700 text-gray-300'
        }`;

    const renderNavLinks = () => {
        switch (user?.role) {
            case 'admin':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Admin</li>
                        <li><NavLink to="/admin" end className={getLinkClassName}><FaHome className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><FaUser className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/admin/users" className={getLinkClassName}><FaUsers className={iconClass} />Usuarios</NavLink></li>
                        <li><NavLink to="/admin/companies" className={getLinkClassName}><FaBuilding className={iconClass} />Empresas</NavLink></li>
                        <li><NavLink to="/admin/depositarios" className={getLinkClassName}><FaCashRegister className={iconClass} />Gestión de Depositarios</NavLink></li>
                        <li><NavLink to="/admin/equipos" className={getLinkClassName}><FaDesktop className={iconClass} />Monitoreo Equipos</NavLink></li>
                        <li><NavLink to="/admin/ubicaciones" className={getLinkClassName}><FaMapMarkerAlt className={iconClass} />Ubicaciones</NavLink></li>
                        <li><NavLink to="/admin/problemas" className={getLinkClassName}><FaExclamationTriangle className={iconClass} />Problemáticas</NavLink></li>
                        <li><NavLink to="/admin/tickets" className={getLinkClassName}><FaTicketAlt className={iconClass} />Tickets</NavLink></li>
                        <li><NavLink to="/admin/reports" className={getLinkClassName}><FaChartBar className={iconClass} />Reportes</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <>
                                <li><NavLink to="/purchases" end className={getLinkClassName}><FaShoppingCart className={iconClass} />Compras</NavLink></li>
                                <li><NavLink to="/purchases/invoices" className={getLinkClassName}><FaFileInvoice className={iconClass} />Facturas</NavLink></li>
                            </>
                        )}
                    </>
                );
            case 'agent':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Agente</li>
                        <li><NavLink to="/agent" end className={getLinkClassName}><FaHome className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><FaUser className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/agent/tickets" className={getLinkClassName}><FaTicketAlt className={iconClass} />Mis Tickets</NavLink></li>
                        <li><NavLink to="/agent/depositarios" className={getLinkClassName}><FaCashRegister className={iconClass} />Mantenimiento Equipos</NavLink></li>
                        <li><NavLink to="/agent/equipos" className={getLinkClassName}><FaDesktop className={iconClass} />Monitoreo Equipos</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><FaShoppingCart className={iconClass} />Compras</NavLink></li>
                        )}
                    </>
                );
            case 'client': {
                const isBacar = user?.company_name && String(user.company_name).toLowerCase().includes('bacar');
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Cliente</li>
                        <li><NavLink to="/client" end className={getLinkClassName}><FaHome className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><FaUser className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/client/tickets" className={getLinkClassName}><FaTicketAlt className={iconClass} />Mis Tickets</NavLink></li>
                        {isBacar && canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><FaShoppingCart className={iconClass} />Compras</NavLink></li>
                        )}
                    </>
                );
            }
            case 'boss':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Jefe</li>
                        <li><NavLink to="/client" end className={getLinkClassName}><FaHome className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><FaUser className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/client/tickets" className={getLinkClassName}><FaTicketAlt className={iconClass} />Mis Tickets</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <>
                                <li><NavLink to="/purchases" end className={getLinkClassName}><FaClipboardList className={iconClass} />Mis solicitudes</NavLink></li>
                                <li><NavLink to="/purchases/new" className={getLinkClassName}><FaPlusCircle className={iconClass} />Nueva solicitud</NavLink></li>
                                <li><NavLink to="/purchases/approvals" className={getLinkClassName}><FaCheckCircle className={iconClass} />Aprobar solicitudes</NavLink></li>
                            </>
                        )}
                    </>
                );
            case 'purchasing':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Compras</li>
                        <li><NavLink to="/client" end className={getLinkClassName}><FaHome className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><FaUser className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/client/tickets" className={getLinkClassName}><FaTicketAlt className={iconClass} />Mis Tickets</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <>
                                <li><NavLink to="/purchases" end className={getLinkClassName}><FaClipboardList className={iconClass} />Mis solicitudes</NavLink></li>
                                <li><NavLink to="/purchases/management" className={getLinkClassName}><FaChartBar className={iconClass} />Gestión de compras</NavLink></li>
                                <li><NavLink to="/purchases/invoices" className={getLinkClassName}><FaFileInvoice className={iconClass} />Facturas</NavLink></li>
                            </>
                        )}
                    </>
                );
            case 'supplier':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Proveedor</li>
                        <li><NavLink to="/profile" className={getLinkClassName}><FaUser className={iconClass} />Mi Perfil</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><FaClipboardList className={iconClass} />Presupuestos</NavLink></li>
                        )}
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <FcmTokenHandler />
        <div className="flex h-screen bg-gray-100 font-sans">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 text-white flex flex-col shadow-lg 
                                transform transition-transform duration-300 ease-in-out 
                                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                                md:relative md:translate-x-0`}>
                <div className="p-4 flex justify-center items-center border-b border-gray-700 h-20">
                    <img src="/images/logo-b-sola.png" alt="BACAR Logo" className="h-12 w-auto" />
                </div>
                <nav className="flex-grow p-4">
                    <ul className="space-y-2">
                        {renderNavLinks()}
                    </ul>
                </nav>
                <div className="p-4 border-t border-gray-700 space-y-2">
                    <button
                        onClick={handleRefreshSession}
                        disabled={isRefreshing}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium"
                    >
                        {isRefreshing ? (
                            <>
                                <span className="animate-spin">⟳</span> Renovando...
                            </>
                        ) : (
                            <>⟳ Renovar sesión</>
                        )}
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 rounded-lg bg-red-600 hover:bg-red-700">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-500 focus:outline-none">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>

                    <div className="flex items-center space-x-4 ml-auto">
                        <span className="text-md font-semibold text-gray-700 hidden sm:block">
                            Bienvenido, {user?.username || 'Invitado'}!
                        </span>
                        <NotificationBell />
                    </div>
                </header>
                
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"></div>}
        </div>
        </>
    );
};

export default Layout;