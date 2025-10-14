import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { ApiResponseError, TicketData } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, Chart } from 'chart.js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas'; // Importación necesaria para el PDF
import { ticketStatusTranslations, ticketPriorityTranslations } from '../utils/traslations';
import { toast } from 'react-toastify';
import { getElementAtEvent } from 'react-chartjs-2';
import autoTable from 'jspdf-autotable';

// Declaración para autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- Interfaces para los datos de reportes ---
interface ReportData {
    ticketsByStatus: { status: string; count: number }[];
    ticketsByPriority: { priority: string; count: number }[];
    ticketsByDepartment: { departmentName: string; count: number }[];
    companyReport: { companyName: string; ticketCount: number, companyId: number }[];
    agentPerformance: { username: string; assignedTickets: number; closedTickets: number, agentId: number }[];
    agentResolutionTimes: { agentName: string; resolvedTickets: number; avgResolutionTimeHours: number | null }[];
}

// --- Componente para el Modal de Detalles ---
const DetailsModal: React.FC<{ title: string; items: Partial<TicketData>[]; onClose: () => void; loading: boolean }> = ({ title, items, onClose, loading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
                <div className="max-h-96 overflow-y-auto border-t border-b py-2">
                    {loading ? (
                        <p className="text-center text-gray-500 py-4">Cargando...</p>
                    ) : items.length > 0 ? (
                        <ul className="space-y-2">
                            {items.map((ticket) => (
                                <li key={ticket.id} className="p-2 border-b flex justify-between items-center">
                                    <span>#{ticket.id} - {ticket.title} ({ticket.client_name})</span>
                                    <Link to={`/admin/tickets/${ticket.id}`} className="text-red-600 hover:underline">Ver</Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">No hay tickets para mostrar.</p>
                    )}
                </div>
                <button onClick={onClose} className="mt-6 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded w-full">Cerrar</button>
            </div>
        </div>
    );
};


const AdminReportsPage: React.FC = () => {
    const { user } = useAuth();
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Estados para el modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; items: TicketData[] }>({ title: '', items: [] });
    const [modalLoading, setModalLoading] = useState(false);

    // Referencias para los gráficos
    const reportContainerRef = useRef<HTMLDivElement>(null);
    const statusChartRef = useRef<ChartJS<'pie'>>(null);
    const priorityChartRef = useRef<ChartJS<'bar'>>(null);
    const departmentChartRef = useRef<ChartJS<'bar'>>(null);
    const companyChartRef = useRef<ChartJS<'bar'>>(null);
    const agentChartRef = useRef<ChartJS<'bar'>>(null);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/reports?startDate=${startDate}&endDate=${endDate}`);
            setReportData(res.data.data);
        } catch (err) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar los reportes.' : 'Error inesperado.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchReportData();
        }
    }, [user, fetchReportData]);

    // Función para abrir el modal con los tickets filtrados
    const showFilteredTickets = async (title: string, filters: Record<string, string | string[]>) => {
        setModalLoading(true);
        setIsModalOpen(true);

        try {
            const params = new URLSearchParams();
            params.append('startDate', startDate);
            params.append('endDate', endDate);
            Object.entries(filters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                } else {
                    params.append(key, value);
                }
            });

            const response = await api.get(`/api/tickets?${params.toString()}`);
            setModalContent({ title: `Tickets: ${title}`, items: response.data.data || [] });
        } catch (error) {
            toast.error('No se pudo cargar la lista de tickets.');
            setIsModalOpen(false);
        } finally {
            setModalLoading(false);
        }
    };

    // Manejadores de clic para cada gráfico
    const handleChartClick = (ref: React.RefObject<Chart<any>>, event: React.MouseEvent<HTMLCanvasElement>, type: 'status' | 'priority' | 'department' | 'company' | 'agentPerformance') => {
        if (!ref.current || !reportData) return;
        const element = getElementAtEvent(ref.current, event);
        if (!element.length) return;

        const { index } = element[0];
        let filters: Record<string, string> = {};
        let title = '';

        if (type === 'status') {
            const statusKey = reportData.ticketsByStatus[index].status;
            filters = { status: statusKey };
            title = ticketStatusTranslations[statusKey as keyof typeof ticketStatusTranslations] || statusKey;
        } else if (type === 'priority') {
            const priorityKey = reportData.ticketsByPriority[index].priority;
            filters = { priority: priorityKey };
            title = ticketPriorityTranslations[priorityKey as keyof typeof ticketPriorityTranslations] || priorityKey;
        } else if (type === 'department') {
            const deptName = reportData.ticketsByDepartment[index].departmentName;
            filters = { departmentName: deptName };
            title = deptName;
        } else if (type === 'company') {
            const companyId = reportData.companyReport[index].companyId;
            filters = { companyId: String(companyId) };
            title = reportData.companyReport[index].companyName;
        } else if (type === 'agentPerformance') {
             const agentId = reportData.agentPerformance[index].agentId;
             filters = { agentId: String(agentId) };
             title = reportData.agentPerformance[index].username;
        }
        
        showFilteredTickets(title, filters);
    };

    const handleGenerateReport = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReportData();
    };

    // ✅ CORRECCIÓN: Se completa la función handleDownloadPdf
    const handleDownloadPdf = async () => {
        if (!reportData || !reportContainerRef.current) return;
        setIsDownloading(true);
        toast.info("Generando PDF, por favor espera...");

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFontSize(18);
            doc.text('Reporte General del Sistema de Tickets', 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generado el: ${new Date().toLocaleString('es-AR')} | Rango: ${startDate} a ${endDate}`, 14, 30);

            // Añadir tablas
            autoTable(doc, {
                startY: 40,
                head: [['Estado del Ticket', 'Cantidad']],
                body: reportData.ticketsByStatus.map(item => [ticketStatusTranslations[item.status as keyof typeof ticketStatusTranslations] || item.status, item.count]),
            });
            autoTable(doc, {
                head: [['Agente', 'Tickets Resueltos', 'Tiempo Promedio (Horas)']],
                body: reportData.agentResolutionTimes.map(item => [item.agentName, item.resolvedTickets, item.avgResolutionTimeHours !== null ? `${item.avgResolutionTimeHours} hs` : 'N/A']),
            });

            // Añadir gráficos como imágenes
            const canvas = await html2canvas(reportContainerRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            doc.addPage();
            doc.text('Visualización Gráfica', 14, 22);
            const pdfWidth = doc.internal.pageSize.getWidth() - 28;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            doc.addImage(imgData, 'PNG', 14, 30, pdfWidth, pdfHeight);

            doc.save(`reporte-tickets-${endDate}.pdf`);
            toast.success("PDF generado exitosamente!");
        } catch (err) {
            toast.error("No se pudo generar el PDF.");
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando reportes...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!reportData) return <div className="p-8 text-center">No se encontraron datos.</div>;

    const statusChartData = {
        labels: reportData.ticketsByStatus.map(item => ticketStatusTranslations[item.status as keyof typeof ticketStatusTranslations] || item.status),
        datasets: [{ data: reportData.ticketsByStatus.map(item => item.count), backgroundColor: ['#3B82F6', '#6B7280', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'] }],
    };
    const priorityChartData = {
        labels: reportData.ticketsByPriority.map(item => ticketPriorityTranslations[item.priority as keyof typeof ticketPriorityTranslations] || item.priority),
        datasets: [{ data: reportData.ticketsByPriority.map(item => item.count), backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#DC2626'] }],
    };
    const departmentChartData = {
        labels: reportData.ticketsByDepartment.map(item => item.departmentName),
        datasets: [{ label: 'Tickets', data: reportData.ticketsByDepartment.map(item => item.count), backgroundColor: '#14B8A6' }],
    };
    const companyChartData = {
        labels: reportData.companyReport.map(item => item.companyName),
        datasets: [{ label: 'Tickets', data: reportData.companyReport.map(item => item.ticketCount), backgroundColor: '#3B82F6' }],
    };
    const agentChartData = {
        labels: reportData.agentPerformance.map(item => item.username),
        datasets: [
            { label: 'Asignados', data: reportData.agentPerformance.map(item => item.assignedTickets), backgroundColor: '#10B981' },
            { label: 'Cerrados', data: reportData.agentPerformance.map(item => item.closedTickets), backgroundColor: '#8B5CF6' },
        ],
    };

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Reportes Avanzados</h1>
                    <button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg self-start sm:self-center">
                        {isDownloading ? 'Generando...' : 'Descargar Reporte PDF'}
                    </button>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <form onSubmit={handleGenerateReport} className="flex flex-col sm:flex-row gap-4 items-end">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Desde</label>
                            <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Hasta</label>
                            <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block w-full p-2 border rounded-md"/>
                        </div>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? 'Generando...' : 'Generar Reporte'}
                        </button>
                    </form>
                </div>

                <div className="space-y-8">
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <h2 className="text-xl font-semibold p-6 border-b">Tiempo de Resolución por Agente</h2>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agente</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tickets Resueltos</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tiempo Promedio (Horas)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.agentResolutionTimes.map(agent => (
                                    <tr key={agent.agentName} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{agent.agentName}</td>
                                        <td className="px-6 py-4 text-center text-gray-700">{agent.resolvedTickets}</td>
                                        <td className="px-6 py-4 text-center text-gray-700 font-bold">
                                            {agent.avgResolutionTimeHours !== null ? `${agent.avgResolutionTimeHours} hs` : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div ref={reportContainerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-lg shadow-md cursor-pointer">
                            <h2 className="text-xl font-bold text-gray-700 mb-4 text-center">Tickets por Estado</h2>
                            <div className="h-80 flex justify-center">
                                <Pie 
                                    ref={statusChartRef}
                                    data={statusChartData} 
                                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
                                    onClick={(e) => handleChartClick(statusChartRef, e, 'status')}
                                />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md cursor-pointer">
                            <h2 className="text-xl font-bold text-gray-700 mb-4 text-center">Tickets por Prioridad</h2>
                            <div className="h-80 flex justify-center">
                                <Bar 
                                    ref={priorityChartRef}
                                    data={priorityChartData} 
                                    options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                                    onClick={(e) => handleChartClick(priorityChartRef, e, 'priority')}
                                />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md cursor-pointer">
                            <h2 className="text-xl font-bold text-gray-700 mb-4 text-center">Tickets por Departamento</h2>
                            <div className="h-80">
                                <Bar 
                                    ref={departmentChartRef}
                                    data={departmentChartData} 
                                    options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
                                    onClick={(e) => handleChartClick(departmentChartRef, e, 'department')}
                                />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md cursor-pointer">
                            <h2 className="text-xl font-bold text-gray-700 mb-4 text-center">Tickets por Empresa</h2>
                            <div className="h-80">
                                <Bar ref={companyChartRef} data={companyChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} onClick={(e) => handleChartClick(companyChartRef, e, 'company')} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-xl font-bold text-gray-700 mb-4 text-center">Rendimiento por Agente</h2>
                            <div className="h-80"><Bar ref={agentChartRef} data={agentChartData} options={{ maintainAspectRatio: false }} onClick={(e) => handleChartClick(agentChartRef, e, 'agentPerformance')} /></div>
                        </div>
                    </div>
                </div>
            </div>
            
            {isModalOpen && <DetailsModal title={modalContent.title} items={modalContent.items} onClose={() => setIsModalOpen(false)} loading={modalLoading} />}
        </>
    );
};

export default AdminReportsPage;

