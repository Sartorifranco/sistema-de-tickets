import React, { useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import io from 'socket.io-client';

import { AuthProvider, AuthContext } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout/Layout';

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
import ReportsPage from './pages/ReportsPage';
import AdminProblemsPage from './pages/AdminProblemsPage'; 
import AdminLocationsPage from './pages/AdminLocationPage';
// ✅ NUEVO: Importar la página de depositarios
import DepositariosPage from './pages/DepositariosPage';
import EquipmentMonitoringPage from './pages/EquipmentMonitoringPage';
import MyPurchasesPage from './pages/MyPurchasesPage';
import PurchaseRequestPage from './pages/PurchaseRequestPage';
import BossApprovalPage from './pages/BossApprovalPage';
import PurchasingAgentPage from './pages/PurchasingAgentPage';
import PurchasingMetricsPage from './pages/PurchasingMetricsPage';
import PurchaseDetailPage from './pages/PurchaseDetailPage';
import InvoicesPage from './pages/InvoicesPage';
import SuccessApprovalPage from './pages/SuccessApprovalPage';


export type SocketInstance = ReturnType<typeof io>;

const SocketConnectionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, token } = useContext(AuthContext)!;
    const [socket, setSocket] = useState<SocketInstance | null>(null);

    useEffect(() => {
        if (isAuthenticated && token) {
            const apiPort = process.env.REACT_APP_API_PORT || '5040';
            const explicitUrl = process.env.REACT_APP_BACKEND_URL;
            const currentHost = window.location.hostname;
            const socketUrl = explicitUrl || `http://${currentHost}:${apiPort}`;

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
                <SocketConnectionManager>
                    <Routes>
                        {/* Rutas públicas sin Layout */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/activate-account" element={<ActivateAccountPage />} />
                        <Route path="/set-password/:token" element={<SetPasswordPage />} />
                        <Route path="/success-approval" element={<SuccessApprovalPage />} />

                        {/* Rutas privadas que usan el Layout */}
                        <Route element={<Layout />}>
                            <Route path="/" element={<Navigate to="/profile" replace />} />
                            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

                            {/* Rutas de Admin */}
                            <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
                            <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><AdminUsersPage /></PrivateRoute>} />
                            <Route path="/admin/companies" element={<PrivateRoute roles={['admin']}><AdminCompaniesPage /></PrivateRoute>} />
                            <Route path="/admin/companies/:companyId/departments" element={<PrivateRoute roles={['admin']}><AdminCompanyDepartmentsPage /></PrivateRoute>} />
                            <Route path="/admin/tickets" element={<PrivateRoute roles={['admin']}><AdminTicketsPage /></PrivateRoute>} />
                            <Route path="/admin/tickets/:id" element={<PrivateRoute roles={['admin']}><AdminTicketDetailPage /></PrivateRoute>} />
                            <Route path="/admin/reports" element={<PrivateRoute roles={['admin']}><AdminReportsPage /></PrivateRoute>} />
                            <Route path="/admin/problemas" element={<PrivateRoute roles={['admin']}><AdminProblemsPage /></PrivateRoute>} />
                            <Route path="/admin/ubicaciones" element={<PrivateRoute roles={['admin']}><AdminLocationsPage /></PrivateRoute>} />
                            
                            {/* ✅ NUEVO: Ruta para Depositarios (Admin) */}
                            <Route path="/admin/depositarios" element={<PrivateRoute roles={['admin']}><DepositariosPage /></PrivateRoute>} />
                            <Route path="/admin/equipos" element={<PrivateRoute roles={['admin']}><EquipmentMonitoringPage /></PrivateRoute>} />

                            {/* Rutas de Agente */}
                            <Route path="/agent" element={<PrivateRoute roles={['agent']}><AgentDashboard /></PrivateRoute>} />
                            <Route path="/agent/tickets" element={<PrivateRoute roles={['agent']}><AgentTicketsPage /></PrivateRoute>} />
                            <Route path="/agent/tickets/:id" element={<PrivateRoute roles={['agent']}><AgentTicketDetailPage /></PrivateRoute>} />
                            <Route path="/reports" element={<PrivateRoute roles={['admin', 'agent']}><ReportsPage /></PrivateRoute>} />
                            
                            {/* ✅ NUEVO: Ruta para Depositarios (Agente) - Usamos el mismo componente */}
                            <Route path="/agent/depositarios" element={<PrivateRoute roles={['agent']}><DepositariosPage /></PrivateRoute>} />
                            <Route path="/agent/equipos" element={<PrivateRoute roles={['agent']}><EquipmentMonitoringPage /></PrivateRoute>} />
                            
                            {/* Rutas de Cliente (también para Jefe y Compras - empleados Bacar) */}
                            <Route path="/client" element={<PrivateRoute roles={['client', 'boss', 'purchasing']}><ClientDashboard /></PrivateRoute>} />
                            <Route path="/client/tickets" element={<PrivateRoute roles={['client', 'boss', 'purchasing']}><ClientTicketsPage /></PrivateRoute>} />
                            <Route path="/client/tickets/:id" element={<PrivateRoute roles={['client', 'boss', 'purchasing']}><ClientTicketDetailPage /></PrivateRoute>} />

                            {/* Módulo de Compras - disponible para todos los roles */}
                            <Route path="/purchases" element={<PrivateRoute><MyPurchasesPage /></PrivateRoute>} />
                            <Route path="/purchases/new" element={<PrivateRoute><PurchaseRequestPage /></PrivateRoute>} />
                            <Route path="/purchases/approvals" element={<PrivateRoute roles={['boss']}><BossApprovalPage /></PrivateRoute>} />
                            <Route path="/purchases/management" element={<PrivateRoute roles={['purchasing']}><PurchasingAgentPage /></PrivateRoute>} />
                            <Route path="/purchases/metrics" element={<PrivateRoute roles={['purchasing', 'admin']}><PurchasingMetricsPage /></PrivateRoute>} />
                            <Route path="/purchases/management/:purchaseId" element={<PrivateRoute roles={['purchasing']}><PurchaseDetailPage /></PrivateRoute>} />
                            <Route path="/purchases/invoices" element={<PrivateRoute roles={['purchasing', 'admin']}><InvoicesPage /></PrivateRoute>} />
                        </Route>

                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} />
                </SocketConnectionManager>
            </AuthProvider>
        </Router>
    );
};

export default App;