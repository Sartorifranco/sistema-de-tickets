/**
 * Stepper visual estilo MercadoLibre para tracking de solicitudes de compra.
 * Responsive: horizontal en desktop, adaptado en móvil.
 */
import React from 'react';

const STEPS = [
    { id: 'solicitado', label: 'Solicitado' },
    { id: 'aprobado', label: 'Aprobado' },
    { id: 'cotizando', label: 'Cotizando' },
    { id: 'compra', label: 'Compra Aprobada' },
    { id: 'entregado', label: 'Entregado' }
];

const STATUS_TO_STEP: Record<string, number> = {
    'Pendiente de Aprobación': 0,
    'Rechazado': 0,
    'Aprobado': 1,
    'Recibido': 1,
    'Esperando presupuesto': 2,
    'Compra Aprobada': 3,
    'Esperando entrega': 3,
    'Entregado': 4,
    'Conforme / Cerrado': 4
};

interface PurchaseStepperProps {
    status: string;
    className?: string;
}

const PurchaseStepper: React.FC<PurchaseStepperProps> = ({ status, className = '' }) => {
    const currentStep = STATUS_TO_STEP[status] ?? 0;

    return (
        <div className={`${className}`}>
            {/* Desktop: barra horizontal */}
            <div className="hidden sm:block">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => {
                        const isCompleted = index < currentStep;
                        const isCurrent = index === currentStep;
                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center flex-1 min-w-0">
                                    <div
                                        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                                            isCompleted
                                                ? 'bg-green-600 text-white'
                                                : isCurrent
                                                ? 'bg-red-600 text-white ring-2 ring-red-300'
                                                : 'bg-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {isCompleted ? '✓' : index + 1}
                                    </div>
                                    <span
                                        className={`mt-1.5 text-xs font-medium text-center truncate max-w-full px-0.5 ${
                                            isCurrent ? 'text-red-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                                        }`}
                                        title={step.label}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className={`flex-1 h-0.5 mx-0.5 min-w-[12px] ${
                                            isCompleted ? 'bg-green-500' : 'bg-gray-200'
                                        }`}
                                        aria-hidden
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Mobile: fila compacta con scroll horizontal */}
            <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {STEPS.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    return (
                        <React.Fragment key={step.id}>
                            <div
                                className={`flex items-center gap-1 shrink-0 py-1 px-2 rounded-lg ${
                                    isCurrent ? 'bg-red-50 text-red-700 font-semibold' : isCompleted ? 'text-green-700 bg-green-50' : 'text-gray-400'
                                }`}
                            >
                                <span
                                    className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                                        isCompleted ? 'bg-green-600 text-white' : isCurrent ? 'bg-red-600 text-white' : 'bg-gray-200'
                                    }`}
                                >
                                    {isCompleted ? '✓' : index + 1}
                                </span>
                                <span className="text-xs whitespace-nowrap">{step.label}</span>
                            </div>
                            {index < STEPS.length - 1 && (
                                <span className="text-gray-300 shrink-0 text-xs">→</span>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default PurchaseStepper;
