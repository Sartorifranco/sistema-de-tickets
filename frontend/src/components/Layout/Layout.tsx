import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { Home, User, Users, Building, MapPin, AlertTriangle, Ticket, BarChart3, Landmark, Monitor, Activity, ShoppingCart, FileText, CheckCircle, PlusCircle, ClipboardList, Banknote } from 'lucide-react';
import NotificationBell from '../NotificationBell/NotificationBell';
import FcmTokenHandler from '../FcmTokenHandler/FcmTokenHandler';
import PushNotificationButton from '../PushNotificationButton/PushNotificationButton';
import { canAccessPurchasingModule } from '../../config/purchasingFeatureFlag';
import { PERMISSION_KEYS as P } from '../../constants/permissions';
import { hasPermission } from '../../utils/permissions';
import { isWorldCupThemeActive } from '../../config/worldCupTheme';
import {
    WorldCupAppConfetti,
    WorldCupAppCornerFlags,
    WorldCupHeaderRibbon,
    WorldCupSidebarFestive,
} from '../Common/WorldCupArgentinaTheme';

const iconClass = 'w-5 h-5 flex-shrink-0';

const Layout: React.FC = () => {
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const worldCup = isWorldCupThemeActive();

    const handleLogout = () => {
        logout();
        toast.info('Sesión cerrada exitosamente.');
    };

    const getLinkClassName = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200 font-medium ${
            isActive
                ? 'bg-red-50 text-red-800 shadow-sm border border-red-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`;

    const renderNavLinks = () => {
        switch (user?.role) {
            case 'admin':
                return (
                    <>
                        <li className="text-xs uppercase tracking-wider font-bold text-slate-900 mt-2 mb-2 px-3">Admin</li>
                        {hasPermission(user, P.DASHBOARD_VIEW) && (
                            <li><NavLink to="/admin" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        )}
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        {hasPermission(user, P.USERS_VIEW) && (
                            <li><NavLink to="/admin/users" className={getLinkClassName}><Users className={iconClass} />Usuarios</NavLink></li>
                        )}
                        {hasPermission(user, P.COMPANIES_VIEW) && (
                            <li><NavLink to="/admin/companies" className={getLinkClassName}><Building className={iconClass} />Empresas</NavLink></li>
                        )}
                        {hasPermission(user, P.DEPOSITARIOS_VIEW) && (
                            <li><NavLink to="/admin/depositarios" className={getLinkClassName}><Landmark className={iconClass} />Gestión de Depositarios</NavLink></li>
                        )}
                        {hasPermission(user, P.TREASURY_MACHINES_VIEW) && (
                            <li><NavLink to="/admin/tesoreria-maquinas" className={getLinkClassName}><Banknote className={iconClass} />Máquinas Tesorería</NavLink></li>
                        )}
                        {hasPermission(user, P.MONITORING_EQUIPOS) && (
                            <li><NavLink to="/admin/equipos" className={getLinkClassName}><Monitor className={iconClass} />Monitoreo Equipos</NavLink></li>
                        )}
                        {hasPermission(user, P.MONITORING_REALTIME) && (
                            <li><NavLink to="/admin/monitoreo" className={getLinkClassName}><Activity className={iconClass} />Monitoreo en Tiempo Real</NavLink></li>
                        )}
                        {hasPermission(user, P.LOCATIONS_MANAGE) && (
                            <li><NavLink to="/admin/ubicaciones" className={getLinkClassName}><MapPin className={iconClass} />Ubicaciones</NavLink></li>
                        )}
                        {hasPermission(user, P.PROBLEMS_MANAGE) && (
                            <li><NavLink to="/admin/problemas" className={getLinkClassName}><AlertTriangle className={iconClass} />Problemáticas</NavLink></li>
                        )}
                        {hasPermission(user, P.TICKETS_VIEW) && (
                            <li><NavLink to="/admin/tickets" className={getLinkClassName}><Ticket className={iconClass} />Tickets</NavLink></li>
                        )}
                        {hasPermission(user, P.REPORTS_VIEW) && (
                            <li><NavLink to="/admin/reports" className={getLinkClassName}><BarChart3 className={iconClass} />Reportes</NavLink></li>
                        )}
                        {canAccessPurchasingModule(user?.email) && hasPermission(user, P.PURCHASES_VIEW) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><ShoppingCart className={iconClass} />Compras</NavLink></li>
                        )}
                        {canAccessPurchasingModule(user?.email) && hasPermission(user, P.PURCHASES_INVOICES) && (
                            <li><NavLink to="/purchases/invoices" className={getLinkClassName}><FileText className={iconClass} />Facturas</NavLink></li>
                        )}
                    </>
                );
            case 'agent':
                return (
                    <>
                        <li className="text-xs uppercase tracking-wider font-bold text-slate-900 mt-2 mb-2 px-3">Agente</li>
                        <li><NavLink to="/agent" end className={getLinkClassName}><Home className={iconClass} />Dashboard</NavLink></li>
                        <li><NavLink to="/profile" className={getLinkClassName}><User className={iconClass} />Mi Perfil</NavLink></li>
                        {hasPermission(user, P.TICKETS_VIEW) && (
                            <li><NavLink to="/agent/tickets" className={getLinkClassName}><Ticket className={iconClass} />Mis Tickets</NavLink></li>
                        )}
                        {hasPermission(user, P.DEPOSITARIOS_VIEW) && (
                            <li><NavLink to="/agent/depositarios" className={getLinkClassName}><Landmark className={iconClass} />Mantenimiento Equipos</NavLink></li>
                        )}
                        {hasPermission(user, P.TREASURY_MACHINES_VIEW) && (
                            <li><NavLink to="/agent/tesoreria-maquinas" className={getLinkClassName}><Banknote className={iconClass} />Máquinas Tesorería</NavLink></li>
                        )}
                        {hasPermission(user, P.MONITORING_EQUIPOS) && (
                            <li><NavLink to="/agent/equipos" className={getLinkClassName}><Monitor className={iconClass} />Monitoreo Equipos</NavLink></li>
                        )}
                        {hasPermission(user, P.MONITORING_REALTIME) && (
                            <li><NavLink to="/agent/monitoreo" className={getLinkClassName}><Activity className={iconClass} />Monitoreo en Tiempo Real</NavLink></li>
                        )}
                        {hasPermission(user, P.REPORTS_VIEW) && (
                            <li><NavLink to="/reports" className={getLinkClassName}><BarChart3 className={iconClass} />Reportes</NavLink></li>
                        )}
                        {canAccessPurchasingModule(user?.email) && (
                            <li><NavLink to="/purchases" end className={getLinkClassName}><ShoppingCart className={iconClass} />Compras</NavLink></li>
                        )}
                    </>
                );
            case 'client': {
                const isBacar = user?.company_name && String(user.company_name).toLowerCase().includes('bacar');
                return (
                    <>
                        <li className="text-xs uppercase tracking-wider font-bold text-slate-900 mt-2 mb-2 px-3">Cliente</li>
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
                        <li className="text-xs uppercase tracking-wider font-bold text-slate-900 mt-2 mb-2 px-3">Jefe</li>
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
                        <li className="text-xs uppercase tracking-wider font-bold text-slate-900 mt-2 mb-2 px-3">Compras</li>
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
                        <li className="text-xs uppercase tracking-wider font-bold text-slate-900 mt-2 mb-2 px-3">Proveedor</li>
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
        <div className={`flex h-screen overflow-hidden bg-slate-50 font-sans antialiased ${worldCup ? 'wc-layout-festive wc-argentina-root' : ''}`}>
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 h-full bg-white border-r border-gray-100 text-gray-800 flex flex-col shadow-sm 
                                transform transition-transform duration-300 ease-in-out 
                                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                                md:relative md:translate-x-0`}>
                <div className="flex-shrink-0 p-4 flex flex-col justify-center items-center border-b border-gray-100 min-h-[5rem] bg-white">
                    {worldCup && <WorldCupSidebarFestive />}
                    <img src="/images/logo-b-sola.png" alt="BACAR Logo" className="h-12 w-auto" />
                </div>
                <nav className="flex-1 min-h-0 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
                    <ul className="space-y-2">
                        {renderNavLinks()}
                    </ul>
                </nav>
                <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden min-w-0">
                <header className="flex-shrink-0 flex items-center justify-between px-5 md:px-6 py-4 bg-white border-b border-gray-100 shadow-sm gap-2">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-500 focus:outline-none flex-shrink-0">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>

                    {worldCup && <WorldCupHeaderRibbon userName={user?.username} />}

                    <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                        <PushNotificationButton />
                        <span className="text-md font-semibold text-gray-700 hidden sm:block">
                            Bienvenido, {user?.username || 'Invitado'}!
                        </span>
                        <NotificationBell />
                    </div>
                </header>
                
                <main className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50 p-4 md:p-6">
                    {worldCup && (
                        <>
                            <WorldCupAppConfetti />
                            <WorldCupAppCornerFlags />
                        </>
                    )}
                    <div className="relative z-10">
                        <Outlet />
                    </div>
                </main>
            </div>
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"></div>}
        </div>
        </>
    );
};

export default Layout;