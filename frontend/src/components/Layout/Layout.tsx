import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { Home, User, Users, Building, MapPin, AlertTriangle, Ticket, BarChart3, Landmark, Monitor, ShoppingCart, FileText, CheckCircle, PlusCircle, ClipboardList } from 'lucide-react';
import NotificationBell from '../NotificationBell/NotificationBell';
import FcmTokenHandler from '../FcmTokenHandler/FcmTokenHandler';
import { canAccessPurchasingModule } from '../../config/purchasingFeatureFlag';

const iconClass = 'w-5 h-5 flex-shrink-0';

const Layout: React.FC = () => {
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                        <li><NavLink to="/admin" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/admin/users" className={getLinkClassName}><Users className={iconClass} />Usuarios</NavLink></li>
                        <li><NavLink to="/admin/companies" className={getLinkClassName}><Building className={iconClass} />Empresas</NavLink></li>
                        <li><NavLink to="/admin/depositarios" className={getLinkClassName}><Landmark className={iconClass} />Gestión de Depositarios</NavLink></li>
                        <li><NavLink to="/admin/equipos" className={getLinkClassName}><Monitor className={iconClass} />Monitoreo Equipos</NavLink></li>
                        <li><NavLink to="/admin/ubicaciones" className={getLinkClassName}><MapPin className={iconClass} />Ubicaciones</NavLink></li>
                        <li><NavLink to="/admin/problemas" className={getLinkClassName}><AlertTriangle className={iconClass} />Problemáticas</NavLink></li>
                        <li><NavLink to="/admin/tickets" className={getLinkClassName}><Ticket className={iconClass} />Tickets</NavLink></li>
                        <li><NavLink to="/admin/reports" className={getLinkClassName}><BarChart3 className={iconClass} />Reportes</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <>
                                <li><NavLink to="/purchases" end className={getLinkClassName}><ShoppingCart className={iconClass} />Compras</NavLink></li>
                                <li><NavLink to="/purchases/invoices" className={getLinkClassName}><FileText className={iconClass} />Facturas</NavLink></li>
                            </>
                        )}
                    </>
                );
            case 'agent':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Agente</li>
                        <li><NavLink to="/agent" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/agent/tickets" className={getLinkClassName}><Ticket className={iconClass} />Mis Tickets</NavLink></li>
                        <li><NavLink to="/agent/depositarios" className={getLinkClassName}><Landmark className={iconClass} />Mantenimiento Equipos</NavLink></li>
                        <li><NavLink to="/agent/equipos" className={getLinkClassName}><Monitor className={iconClass} />Monitoreo Equipos</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><ShoppingCart className={iconClass} />Compras</NavLink></li>
                        )}
                    </>
                );
            case 'client': {
                const isBacar = user?.company_name && String(user.company_name).toLowerCase().includes('bacar');
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Cliente</li>
                        <li><NavLink to="/client" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/client/tickets" className={getLinkClassName}><Ticket className={iconClass} />Mis Tickets</NavLink></li>
                        {isBacar && canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><ShoppingCart className={iconClass} />Compras</NavLink></li>
                        )}
                    </>
                );
            }
            case 'boss':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Jefe</li>
                        <li><NavLink to="/client" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/client/tickets" className={getLinkClassName}><Ticket className={iconClass} />Mis Tickets</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <>
                                <li><NavLink to="/purchases" end className={getLinkClassName}><ClipboardList className={iconClass} />Mis solicitudes</NavLink></li>
                                <li><NavLink to="/purchases/new" className={getLinkClassName}><PlusCircle className={iconClass} />Nueva solicitud</NavLink></li>
                                <li><NavLink to="/purchases/approvals" className={getLinkClassName}><CheckCircle className={iconClass} />Aprobar solicitudes</NavLink></li>
                            </>
                        )}
                    </>
                );
            case 'purchasing':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Compras</li>
                        <li><NavLink to="/client" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        <li><NavLink to="/client/tickets" className={getLinkClassName}><Ticket className={iconClass} />Mis Tickets</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <>
                                <li><NavLink to="/purchases" end className={getLinkClassName}><ClipboardList className={iconClass} />Mis solicitudes</NavLink></li>
                                <li><NavLink to="/purchases/management" className={getLinkClassName}><BarChart3 className={iconClass} />Gestión de compras</NavLink></li>
                                <li><NavLink to="/purchases/invoices" className={getLinkClassName}><FileText className={iconClass} />Facturas</NavLink></li>
                            </>
                        )}
                    </>
                );
            case 'supplier':
                return (
                    <>
                        <li className="text-xs uppercase text-gray-400 mt-2 mb-2 px-3">Proveedor</li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        {canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><ClipboardList className={iconClass} />Presupuestos</NavLink></li>
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
        <div className="flex h-screen overflow-hidden bg-gray-100 font-sans">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 h-full bg-gray-800 text-white flex flex-col shadow-lg 
                                transform transition-transform duration-300 ease-in-out 
                                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                                md:relative md:translate-x-0`}>
                <div className="flex-shrink-0 p-4 flex justify-center items-center border-b border-gray-700 h-20">
                    <img src="/images/logo-b-sola.png" alt="BACAR Logo" className="h-12 w-auto" />
                </div>
                <nav className="flex-1 min-h-0 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
                    <ul className="space-y-2">
                        {renderNavLinks()}
                    </ul>
                </nav>
                <div className="flex-shrink-0 p-4 border-t border-gray-700">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
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
                
                <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"></div>}
        </div>
        </>
    );
};

export default Layout;