import React, { useEffect, useState } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';
import { formatLocalDate } from '../../utils/dateFormatter';
import { clCard } from '../../utils/cleanLightUi';

interface DepositaryReport {
    id: number;
    alias: string;
    serial_number: string;
    company_name: string;
    current_counter: number;
    monthly_usage: number;
    total_errors: number;
    recent_error_types: string;
}

interface AnalysisData {
    depositario: { alias: string; serial_number: string; company_name: string };
    tickets: any[];
    analysis: {
        summary: string;
        risk_level: string;
        total_analyzed: number;
        dominant_issue: string | null;
    };
}

interface Props { onClose: () => void; }

const DepositaryReportModal: React.FC<Props> = ({ onClose }) => {
    const [data, setData] = useState<DepositaryReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await api.get('/api/depositarios/reports');
                setData(res.data.data);
            } catch (error) {
                toast.error("Error cargando reportes");
            } finally { setLoading(false); }
        };
        fetchReports();
    }, []);

    const handleRowClick = async (id: number) => {
        setSelectedId(id);
        setAnalyzing(true);
        try {
            const res = await api.get(`/api/depositarios/${id}/analysis`);
            setAnalysisData(res.data.data);
        } catch (error) {
            toast.error("Error al analizar el equipo");
            setSelectedId(null);
        } finally { setAnalyzing(false); }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className={`${clCard} shadow-xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden transition-all`}>
                <div className="bg-indigo-900 text-white p-4 shadow-md flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {selectedId && <button onClick={() => setSelectedId(null)} className="hover:bg-indigo-700 p-1 rounded-full bg-indigo-800 px-3 text-sm">⬅ Volver</button>}
                        <h2 className="text-xl font-bold"> {selectedId ? `🧠 Análisis Inteligente` : '📊 Reporte de Rendimiento'} </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-xl">✕</button>
                </div>

                <div className="flex-grow overflow-auto p-6 bg-slate-50/90">
                    {loading ? ( <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-900"></div></div> ) : selectedId ? (
                        <div className="animate-fade-in space-y-6">
                            {analyzing || !analysisData ? (
                                <div className="text-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-4"></div><p className="text-indigo-800 font-bold animate-pulse">Analizando...</p></div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-end border-b pb-2">
                                        <div>
                                            <h3 className="text-2xl font-bold text-gray-800">{analysisData.depositario.alias}</h3>
                                            <p className="text-gray-500 text-sm">{analysisData.depositario.company_name} • S/N: {analysisData.depositario.serial_number}</p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white relative overflow-hidden">
                                        <div className="absolute top-0 right-0 opacity-10 text-9xl">🤖</div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-xl font-bold">DIAGNÓSTICO ALGORÍTMICO</h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${analysisData.analysis.risk_level === 'Crítico' ? 'bg-red-500' : 'bg-green-500'}`}>Riesgo: {analysisData.analysis.risk_level}</span>
                                            </div>
                                            <p className="text-lg font-medium leading-relaxed bg-white bg-opacity-20 p-4 rounded-md">"{analysisData.analysis.summary}"</p>
                                            <p className="text-xs mt-2 opacity-80 text-right">Basado en {analysisData.analysis.total_analyzed} tickets técnicos filtrados.</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-gray-700 font-bold text-lg mb-3">📂 Historial de Reclamos Técnicos (Filtrado)</h4>
                                        <div className={`${clCard} overflow-hidden`}>
                                            {analysisData.tickets.length === 0 ? <p className="p-5 text-gray-500 text-center">Sin tickets técnicos relevantes.</p> : (
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                                                        <tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Asunto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Reportado Por</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {analysisData.tickets.map(t => (
                                                            <tr key={t.id} className="border-b hover:bg-gray-50">
                                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">#{t.id}</td>
                                                                <td className="px-4 py-3">{formatLocalDate(t.created_at)}</td>
                                                                <td className="px-4 py-3 font-medium text-gray-800">{t.title}</td>
                                                                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${t.status === 'closed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t.status === 'closed' ? 'Cerrado' : 'Abierto'}</span></td>
                                                                <td className="px-4 py-3 text-gray-500">{t.created_by || 'Sistema'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <p className="text-sm text-gray-500 mb-4 italic flex items-center gap-2"><span className="bg-blue-100 text-blue-800 px-2 rounded text-xs font-bold">INFO</span> Haz clic en cualquier fila para ver el análisis detallado.</p>
                            <div className={`${clCard} overflow-hidden shadow-sm`}>
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-white uppercase bg-indigo-800">
                                    <tr><th className="px-6 py-3">Equipo / Empresa</th><th className="px-6 py-3 text-center">Contador</th><th className="px-6 py-3 text-center">Uso Mes</th><th className="px-6 py-3 text-center">Tickets</th><th className="px-6 py-3">Último Problema</th><th className="px-6 py-3 text-center">Estado</th></tr>
                                </thead>
                                <tbody>
                                    {data.map((row) => (
                                        <tr key={row.id} onClick={() => handleRowClick(row.id)} className="bg-white border-b hover:bg-indigo-50 transition-colors cursor-pointer group">
                                            <td className="px-6 py-4"><div className="font-bold text-gray-800 group-hover:text-indigo-700">{row.alias}</div><div className="text-xs text-gray-500">{row.company_name} • S/N: {row.serial_number}</div></td>
                                            <td className="px-6 py-4 text-center font-mono text-blue-600 font-bold">{row.current_counter ? row.current_counter.toLocaleString() : 'N/A'}</td>
                                            <td className="px-6 py-4 text-center">{row.monthly_usage ? <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">+{row.monthly_usage.toLocaleString()}</span> : <span className="text-gray-400">-</span>}</td>
                                            <td className="px-6 py-4 text-center">{row.total_errors > 0 ? <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded border border-red-200">{row.total_errors}</span> : <span className="text-green-600 font-bold">0</span>}</td>
                                            <td className="px-6 py-4 text-xs italic text-gray-600 truncate max-w-[200px]">{row.recent_error_types || '-'}</td>
                                            <td className="px-6 py-4 text-center">{row.total_errors > 5 ? <span className="text-red-600 font-bold">🔴 Crítico</span> : row.monthly_usage > 50000 ? <span className="text-yellow-600 font-bold">🟡 Alto Uso</span> : <span className="text-green-600 font-bold">🟢 OK</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
                </div>
                <div className="bg-gray-50 p-4 flex justify-end border-t border-gray-100"><button type="button" onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2.5 px-6 rounded-xl shadow-sm">Cerrar</button></div>
            </div>
        </div>
    );
};

export default DepositaryReportModal;