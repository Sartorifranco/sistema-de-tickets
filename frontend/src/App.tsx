import React, { useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import io from 'socket.io-client';

import { AuthProvider, AuthContext } from './context/AuthContext';
import { SystemModulesProvider } from './context/SystemModulesContext';
import { getSocketUrl } from './config/axiosConfig';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout/Layout';
import AdminModuleSettingsPage from './pages/AdminModuleSettingsPage';

// Importaciones de páginas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ActivateAccountPage from './pages/ActivateAccountPage';
import SetPasswordPage from './pages/SetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUserPage';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import AdminCompanyDepartmentsPage from './pages/AdminCompanyDeparmentsPage';
import AdminTicketsPage from './pages/AdminTicketsPage';
import AdminTicketDetailPage from './pages/AdminTicketDetailPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AgentDashboard from './pages/AgentDashboard';
import AgentTicketsPage from './pages/AgentTicketPage';
import AgentTicketDetailPage from './pages/AgentTicketDetailPage';
import ClientDashboard from './pages/ClientDashboard';
import ClientTicketsPage from './pages/ClientMyTicketsPage';
import ClientTicketDetailPage from './pages/ClientTicketDetailPage';
import PrivateRoute from './components/Common/PrivateRoute';
import { PERMISSION_KEYS as P } from './constants/permissions';
import PurchasingRouteGuard from './components/Common/PurchasingRouteGuard';
import ReportsPage from './pages/ReportsPage';
import AdminProblemsPage from './pages/AdminProblemsPage'; 
import AdminLocationsPage from './pages/AdminLocationPage';
// ✅ NUEVO: Importar la página de depositarios
import DepositariosPage from './pages/DepositariosPage';
import EquipmentMonitoringPage from './pages/EquipmentMonitoringPage';
import MonitoringPage from './pages/MonitoringPage';
import TreasuryMachinesDashboard from './pages/TreasuryMachinesDashboard';
import MyPurchasesPage from './pages/MyPurchasesPage';
import PurchaseRequestPage from './pages/PurchaseRequestPage';
import BossApprovalPage from './pages/BossApprovalPage';
import PurchasingAgentPage from './pages/PurchasingAgentPage';
import PurchasingMetricsPage from './pages/PurchasingMetricsPage';
import PurchaseDetailPage from './pages/PurchaseDetailPage';
import InvoicesPage from './pages/InvoicesPage';
import SuccessApprovalPage from './pages/SuccessApprovalPage';
import MockEmailPage from './pages/MockEmailPage';


export type SocketInstance = ReturnType<typeof io>;

const SocketConnectionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, token } = useContext(AuthContext)!;
    const [socket, setSocket] = useState<SocketInstance | null>(null);

    useEffect(() => {
        if (isAuthenticated && token) {
            const socketUrl = getSocketUrl();

            const newSocket = io(socketUrl, {
                auth: { token },
                transports: ['websocket', 'polling']
            });
            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
                setSocket(null);
            };
        } else {
            setSocket(null);
        }
    }, [isAuthenticated, token]);

    return (
        // @ts-ignore
        <NotificationProvider socket={socket}>
            {children}
        </NotificationProvider>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <SystemModulesProvider>
                <SocketConnectionManager>
                    <Routes>
                        {/* Redirección raíz a login */}
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        {/* Rutas públicas sin Layout */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/activate-account" element={<ActivateAccountPage />} />
                        <Route path="/set-password/:token" element={<SetPasswordPage />} />
                        <Route path="/success-approval" element={<SuccessApprovalPage />} />
                        <Route path="/mock-email" element={<MockEmailPage />} />

                        {/* Rutas privadas que usan el Layout */}
                        <Route element={<Layout />}>
                            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

                            {/* Rutas de Admin */}
                            <Route path="/admin" element={<PrivateRoute roles={['admin']} permission={P.DASHBOARD_VIEW}><AdminDashboard /></PrivateRoute>} />
                            <Route path="/admin/users" element={<PrivateRoute roles={['admin']} permission={P.USERS_VIEW}><AdminUsersPage /></PrivateRoute>} />
                            <Route path="/admin/configuracion" element={<PrivateRoute roles={['admin']}><AdminModuleSettingsPage /></PrivateRoute>} />
                            <Route path="/admin/companies" element={<PrivateRoute roles={['admin']} permission={P.COMPANIES_VIEW} module="companies"><AdminCompaniesPage /></PrivateRoute>} />
                            <Route path="/admin/companies/:companyId/departments" element={<PrivateRoute roles={['admin']} permission={P.COMPANIES_MANAGE} module="companies"><AdminCompanyDepartmentsPage /></PrivateRoute>} />
                            <Route path="/admin/tickets" element={<PrivateRoute roles={['admin']} permission={P.TICKETS_VIEW}><AdminTicketsPage /></PrivateRoute>} />
                            <Route path="/admin/tickets/:id" element={<PrivateRoute roles={['admin']} permission={P.TICKETS_VIEW}><AdminTicketDetailPage /></PrivateRoute>} />
                            <Route path="/admin/reports" element={<PrivateRoute roles={['admin']} permission={P.REPORTS_VIEW} module="reports"><AdminReportsPage /></PrivateRoute>} />
                            <Route path="/admin/problemas" element={<PrivateRoute roles={['admin']} permission={P.PROBLEMS_MANAGE} module="problems"><AdminProblemsPage /></PrivateRoute>} />
                            <Route path="/admin/ubicaciones" element={<PrivateRoute roles={['admin']} permission={P.LOCATIONS_MANAGE} module="locations"><AdminLocationsPage /></PrivateRoute>} />
                            <Route path="/admin/depositarios" element={<PrivateRoute roles={['admin']} permission={P.DEPOSITARIOS_VIEW} module="depositarios"><DepositariosPage /></PrivateRoute>} />
                            <Route path="/admin/equipos" element={<PrivateRoute roles={['admin']} permission={P.MONITORING_EQUIPOS} module="monitoring"><EquipmentMonitoringPage /></PrivateRoute>} />
                            <Route path="/admin/monitoreo" element={<PrivateRoute roles={['admin']} permission={P.MONITORING_REALTIME} module="monitoring"><MonitoringPage /></PrivateRoute>} />
                            <Route path="/admin/tesoreria-maquinas" element={<PrivateRoute roles={['admin']} permission={P.TREASURY_MACHINES_VIEW} module="treasury"><TreasuryMachinesDashboard /></PrivateRoute>} />

                            {/* Rutas de Agente */}
                            <Route path="/agent" element={<PrivateRoute roles={['agent']}><AgentDashboard /></PrivateRoute>} />
                            <Route path="/agent/tickets" element={<PrivateRoute roles={['agent']} permission={P.TICKETS_VIEW}><AgentTicketsPage /></PrivateRoute>} />
                            <Route path="/agent/tickets/:id" element={<PrivateRoute roles={['agent']} permission={P.TICKETS_VIEW}><AgentTicketDetailPage /></PrivateRoute>} />
                            <Route path="/reports" element={<PrivateRoute roles={['admin', 'agent']} permission={P.REPORTS_VIEW} module="reports"><ReportsPage /></PrivateRoute>} />
                            <Route path="/agent/depositarios" element={<PrivateRoute roles={['agent']} permission={P.DEPOSITARIOS_VIEW} module="depositarios"><DepositariosPage /></PrivateRoute>} />
                            <Route path="/agent/equipos" element={<PrivateRoute roles={['agent']} permission={P.MONITORING_EQUIPOS} module="monitoring"><EquipmentMonitoringPage /></PrivateRoute>} />
                            <Route path="/agent/monitoreo" element={<PrivateRoute roles={['agent']} permission={P.MONITORING_REALTIME} module="monitoring"><MonitoringPage /></PrivateRoute>} />
                            <Route path="/agent/tesoreria-maquinas" element={<PrivateRoute roles={['agent']} permission={P.TREASURY_MACHINES_VIEW} module="treasury"><TreasuryMachinesDashboard /></PrivateRoute>} />
                            
                            {/* Rutas de Cliente (también para Jefe y Compras - empleados Bacar) */}
                            <Route path="/client" element={<PrivateRoute roles={['client', 'boss', 'purchasing']}><ClientDashboard /></PrivateRoute>} />
                            <Route path="/client/tickets" element={<PrivateRoute roles={['client', 'boss', 'purchasing']}><ClientTicketsPage /></PrivateRoute>} />
                            <Route path="/client/tickets/:id" element={<PrivateRoute roles={['client', 'boss', 'purchasing']}><ClientTicketDetailPage /></PrivateRoute>} />

                            {/* Módulo de Compras - Deploy Oculto: solo correos en PURCHASING_ALLOWED_EMAILS */}
                            <Route path="/purchases" element={<PrivateRoute module="purchases"><PurchasingRouteGuard><MyPurchasesPage /></PurchasingRouteGuard></PrivateRoute>} />
                            <Route path="/purchases/new" element={<PrivateRoute module="purchases"><PurchasingRouteGuard><PurchaseRequestPage /></PurchasingRouteGuard></PrivateRoute>} />
                            <Route path="/purchases/approvals" element={<PrivateRoute roles={['boss']} module="purchases"><PurchasingRouteGuard><BossApprovalPage /></PurchasingRouteGuard></PrivateRoute>} />
                            <Route path="/purchases/management" element={<PrivateRoute roles={['purchasing']} module="purchases"><PurchasingRouteGuard><PurchasingAgentPage /></PurchasingRouteGuard></PrivateRoute>} />
                            <Route path="/purchases/metrics" element={<PrivateRoute roles={['purchasing', 'admin']} permission={P.PURCHASES_VIEW} module="purchases"><PurchasingRouteGuard><PurchasingMetricsPage /></PurchasingRouteGuard></PrivateRoute>} />
                            <Route path="/purchases/management/:purchaseId" element={<PrivateRoute roles={['purchasing']} module="purchases"><PurchasingRouteGuard><PurchaseDetailPage /></PurchasingRouteGuard></PrivateRoute>} />
                            <Route path="/purchases/invoices" element={<PrivateRoute roles={['purchasing', 'admin']} permission={P.PURCHASES_INVOICES} module="purchases"><PurchasingRouteGuard><InvoicesPage /></PurchasingRouteGuard></PrivateRoute>} />
                        </Route>

                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} />
                </SocketConnectionManager>
                </SystemModulesProvider>
            </AuthProvider>
        </Router>
    );
};

export default App;