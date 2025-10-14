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
// ✅ 1. Importa la nueva página de ubicaciones
import AdminLocationsPage from './pages/AdminLocationPage';


export type SocketInstance = ReturnType<typeof io>;

const SocketConnectionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, token } = useContext(AuthContext)!;
    const [socket, setSocket] = useState<SocketInstance | null>(null);

    useEffect(() => {
        if (isAuthenticated && token) {
            const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
                auth: { token }
            });
            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [isAuthenticated, token]);

    return (
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
                            {/* ✅ 2. Añade la nueva ruta para el panel de ubicaciones */}
                            <Route path="/admin/ubicaciones" element={<PrivateRoute roles={['admin']}><AdminLocationsPage /></PrivateRoute>} />

                            {/* Rutas de Agente */}
                            <Route path="/agent" element={<PrivateRoute roles={['agent']}><AgentDashboard /></PrivateRoute>} />
                            <Route path="/agent/tickets" element={<PrivateRoute roles={['agent']}><AgentTicketsPage /></PrivateRoute>} />
                            <Route path="/agent/tickets/:id" element={<PrivateRoute roles={['agent']}><AgentTicketDetailPage /></PrivateRoute>} />
                            <Route path="/reports" element={<PrivateRoute roles={['admin', 'agent']}><ReportsPage /></PrivateRoute>} />
                            
                            {/* Rutas de Cliente */}
                            <Route path="/client" element={<PrivateRoute roles={['client']}><ClientDashboard /></PrivateRoute>} />
                            <Route path="/client/tickets" element={<PrivateRoute roles={['client']}><ClientTicketsPage /></PrivateRoute>} />
                            <Route path="/client/tickets/:id" element={<PrivateRoute roles={['client']}><ClientTicketDetailPage /></PrivateRoute>} />
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