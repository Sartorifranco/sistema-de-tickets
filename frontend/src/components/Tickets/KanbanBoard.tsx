/**
 * Tablero Kanban para gestión de tickets con @dnd-kit
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
import { TicketData, TicketStatus } from '../../types';
import { ticketPriorityTranslations } from '../../utils/traslations';
import { InternalTaskBadge, isTicketInternalTask } from './InternalTaskBadge';

const KANBAN_COLUMNS: { id: TicketStatus; label: string }[] = [
    { id: 'open', label: 'Abierto' },
    { id: 'in-progress', label: 'En Progreso' },
    { id: 'resolved', label: 'Resuelto' },
    { id: 'closed', label: 'Cerrado' },
];

// "reopened" se agrupa con "open"
const COLUMN_STATUSES: Record<TicketStatus, TicketStatus> = {
    open: 'open',
    'in-progress': 'in-progress',
    resolved: 'resolved',
    closed: 'closed',
    reopened: 'open',
};

const getPriorityBadgeClass = (priority: string): string => {
    switch (priority) {
        case 'urgent':
        case 'high':
            return 'bg-red-100 text-red-800';
        case 'medium':
            return 'bg-amber-100 text-amber-800';
        case 'low':
        default:
            return 'bg-green-100 text-green-800';
    }
};

const formatShortDate = (dateString: string): string => {
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch {
        return '—';
    }
};

interface KanbanBoardProps {
    tickets: TicketData[];
    onUpdateTicketStatus: (ticketId: number, newStatus: TicketStatus) => Promise<void>;
}

const KanbanCard: React.FC<{
    ticket: TicketData;
    onUpdateTicketStatus: (ticketId: number, newStatus: TicketStatus) => Promise<void>;
}> = ({ ticket }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `ticket-${ticket.id}`,
        data: { ticket },
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          }
        : undefined;

    const priority = ticket.priority || 'low';
    const priorityLabel = ticketPriorityTranslations[priority as keyof typeof ticketPriorityTranslations] || priority;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                isDragging ? 'opacity-90 shadow-lg ring-2 ring-blue-100 z-50' : ''
            }`}
        >
            <Link to={`/admin/tickets/${ticket.id}`} className="block" onClick={(e) => isDragging && e.preventDefault()}>
                <h4 className="font-bold text-gray-800 truncate mb-2" title={ticket.title}>
                    {ticket.title}
                </h4>
                <div className="flex flex-wrap gap-1 mb-2 items-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeClass(priority)}`}>
                        {priorityLabel}
                    </span>
                    {isTicketInternalTask(ticket) && <InternalTaskBadge />}
                </div>
                <p className="text-sm text-gray-500 truncate mb-1">{ticket.client_name || '—'}</p>
                <p className="text-xs text-gray-400">{formatShortDate(ticket.created_at)}</p>
            </Link>
        </div>
    );
};

const DroppableColumn: React.FC<{
    id: string;
    label: string;
    tickets: TicketData[];
    onUpdateTicketStatus: (ticketId: number, newStatus: TicketStatus) => Promise<void>;
}> = ({ id, label, tickets, onUpdateTicketStatus }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-72 rounded-2xl border border-gray-100 bg-gray-50/90 p-4 min-h-[200px] transition-colors shadow-sm ${
                isOver ? 'ring-2 ring-blue-200 bg-blue-50/60' : ''
            }`}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800 tracking-tight">{label}</h3>
                <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {tickets.length}
                </span>
            </div>
            <div className="space-y-3">
                {tickets.map((ticket) => (
                    <KanbanCard
                        key={ticket.id}
                        ticket={ticket}
                        onUpdateTicketStatus={onUpdateTicketStatus}
                    />
                ))}
            </div>
        </div>
    );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tickets, onUpdateTicketStatus }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor)
    );

    const getTicketsByColumn = (statusId: TicketStatus): TicketData[] => {
        return tickets.filter((t) => {
            const s = t.status as TicketStatus;
            const mapped = COLUMN_STATUSES[s] ?? s;
            return mapped === statusId;
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const ticketId = parseInt(String(active.id).replace('ticket-', ''), 10);
        const newStatus = over.id as TicketStatus;

        if (!KANBAN_COLUMNS.some((c) => c.id === newStatus)) return;

        const ticket = tickets.find((t) => t.id === ticketId);
        if (!ticket || ticket.status === newStatus) return;

        onUpdateTicketStatus(ticketId, newStatus);
    };

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
                {KANBAN_COLUMNS.map((col) => (
                    <DroppableColumn
                        key={col.id}
                        id={col.id}
                        label={col.label}
                        tickets={getTicketsByColumn(col.id)}
                        onUpdateTicketStatus={onUpdateTicketStatus}
                    />
                ))}
            </div>
        </DndContext>
    );
};

export default KanbanBoard;
