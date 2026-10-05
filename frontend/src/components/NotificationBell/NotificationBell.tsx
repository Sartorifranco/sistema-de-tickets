import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    CheckCheck,
    MessageSquare,
    RefreshCw,
    ShoppingBag,
    Star,
    Ticket,
    Trash2,
    UserCheck,
    X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Notification } from '../../types';

type Filter = 'unread' | 'all';
type DayGroup = 'hoy' | 'ayer' | 'antes';

function isUnread(n: Notification): boolean {
    const value = n.is_read as unknown;
    return value === false || value === 0 || value === '0' || value == null;
}

function relativeTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ayer';
    if (days < 30) return `Hace ${days} d`;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function dayGroup(iso: string): DayGroup {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'antes';
    const start = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const diff = start(new Date()) - start(d);
    if (diff <= 0) return 'hoy';
    if (diff === 86400000) return 'ayer';
    return 'antes';
}

function kindOf(n: Notification): { label: string; icon: React.ReactNode; tone: string } {
    const type = (n.type || '').toLowerCase();
    const related = (n.related_type || '').toLowerCase();
    const icon = 'h-4 w-4';
    if (type.includes('comment')) {
        return { label: 'Comentario', icon: <MessageSquare className={icon} />, tone: 'bg-sky-50 text-sky-600' };
    }
    if (type.includes('assign')) {
        return { label: 'Asignación', icon: <UserCheck className={icon} />, tone: 'bg-indigo-50 text-indigo-600' };
    }
    if (type.includes('status')) {
        return { label: 'Estado', icon: <RefreshCw className={icon} />, tone: 'bg-amber-50 text-amber-700' };
    }
    if (type.includes('feedback')) {
        return { label: 'Valoración', icon: <Star className={icon} />, tone: 'bg-amber-50 text-amber-600' };
    }
    if (related === 'purchase' || type.includes('purchase') || type.includes('order')) {
        return { label: 'Compra', icon: <ShoppingBag className={icon} />, tone: 'bg-teal-50 text-teal-700' };
    }
    if (related === 'ticket' || type.includes('ticket')) {
        return { label: 'Ticket', icon: <Ticket className={icon} />, tone: 'bg-red-50 text-red-600' };
    }
    return { label: 'Aviso', icon: <Bell className={icon} />, tone: 'bg-gray-100 text-gray-600' };
}

const GROUP_LABEL: Record<DayGroup, string> = {
    hoy: 'Hoy',
    ayer: 'Ayer',
    antes: 'Anteriores',
};

/** El historial puede ser largo; el panel muestra solo las más recientes. */
const VISIBLE_LIMIT = 40;

const NotificationBell: React.FC = () => {
    const { user } = useAuth();
    const { notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } =
        useNotification();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<Filter>('unread');
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const onPointer = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [isOpen]);

    const openPanel = () => {
        setFilter(unreadCount > 0 ? 'unread' : 'all');
        setIsOpen((prev) => !prev);
    };

    const handleNotificationClick = (notification: Notification) => {
        if (isUnread(notification)) {
            markNotificationAsRead(notification.id);
        }
        if (notification.related_type === 'ticket' && notification.related_id) {
            const basePath = user?.role === 'admin' ? '/admin' : user?.role === 'agent' ? '/agent' : '/client';
            navigate(`${basePath}/tickets/${notification.related_id}`);
        } else if (notification.related_type === 'purchase') {
            switch (user?.role) {
                case 'boss':
                    navigate('/purchases/approvals');
                    break;
                case 'purchasing':
                    navigate(
                        notification.related_id ? `/purchases/management/${notification.related_id}` : '/purchases/management'
                    );
                    break;
                default:
                    navigate('/purchases');
                    break;
            }
        }
        setIsOpen(false);
    };

    const visible = useMemo(
        () => (filter === 'unread' ? notifications.filter(isUnread) : notifications),
        [notifications, filter]
    );

    const hiddenCount = Math.max(0, visible.length - VISIBLE_LIMIT);

    const groups = useMemo(() => {
        const buckets: Record<DayGroup, Notification[]> = { hoy: [], ayer: [], antes: [] };
        visible.slice(0, VISIBLE_LIMIT).forEach((n) => buckets[dayGroup(n.created_at)].push(n));
        return (['hoy', 'ayer', 'antes'] as DayGroup[])
            .map((key) => ({ key, label: GROUP_LABEL[key], items: buckets[key] }))
            .filter((g) => g.items.length > 0);
    }, [visible]);

    if (!user) return null;

    const badge = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={openPanel}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${
                    isOpen ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
                aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
                aria-expanded={isOpen}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                        {badge}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 mt-2 flex w-[min(24rem,calc(100vw-1.25rem))] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                    <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
                        <div>
                            <p className="text-sm font-bold text-gray-900">Notificaciones</p>
                            <p className="text-xs text-gray-500">
                                {unreadCount > 0
                                    ? `${unreadCount} sin leer`
                                    : 'Estás al día'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={markAllNotificationsAsRead}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    Marcar leídas
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                aria-label="Cerrar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-1 px-3 py-2">
                        <button
                            type="button"
                            onClick={() => setFilter('unread')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                filter === 'unread' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Sin leer{unreadCount > 0 ? ` · ${unreadCount}` : ''}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                filter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Todas · {notifications.length}
                        </button>
                    </div>

                    <div className="max-h-[min(70vh,26rem)] overflow-y-auto">
                        {groups.length === 0 ? (
                            <div className="px-6 py-10 text-center">
                                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                    <Bell className="h-5 w-5" />
                                </span>
                                <p className="mt-3 text-sm font-semibold text-gray-800">
                                    {filter === 'unread' ? 'No tenés avisos sin leer' : 'Todavía no hay notificaciones'}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    {filter === 'unread'
                                        ? 'Cuando llegue un ticket, un comentario o una compra, aparece acá.'
                                        : 'Los avisos del sistema se van a listar en este panel.'}
                                </p>
                                {filter === 'unread' && notifications.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setFilter('all')}
                                        className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700"
                                    >
                                        Ver historial
                                    </button>
                                )}
                            </div>
                        ) : (
                            groups.map((group) => (
                                <section key={group.key}>
                                    <p className="sticky top-0 bg-gray-50/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 backdrop-blur">
                                        {group.label}
                                    </p>
                                    <ul>
                                        {group.items.map((notification) => {
                                            const kind = kindOf(notification);
                                            const unread = isUnread(notification);
                                            return (
                                                <li key={notification.id} className="group border-b border-gray-50 last:border-b-0">
                                                    <div className={`flex gap-3 px-3 py-3 ${unread ? 'bg-red-50/40' : 'bg-white'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleNotificationClick(notification)}
                                                            className="flex min-w-0 flex-1 gap-3 text-left"
                                                        >
                                                            <span
                                                                className={`relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kind.tone}`}
                                                            >
                                                                {kind.icon}
                                                                {unread && (
                                                                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                                                                )}
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                                                        {kind.label}
                                                                    </span>
                                                                    <span className="ml-auto shrink-0 text-[11px] text-gray-400">
                                                                        {relativeTime(notification.created_at)}
                                                                    </span>
                                                                </span>
                                                                <span
                                                                    title={notification.message}
                                                                    className={`mt-0.5 block text-sm leading-snug break-words line-clamp-3 ${
                                                                        unread ? 'font-semibold text-gray-900' : 'text-gray-600'
                                                                    }`}
                                                                >
                                                                    {notification.message}
                                                                </span>
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Eliminar"
                                                            aria-label="Eliminar notificación"
                                                            onClick={() => deleteNotification(notification.id)}
                                                            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-300 opacity-100 transition-colors hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            ))
                        )}
                        {hiddenCount > 0 && (
                            <p className="px-4 py-3 text-center text-xs text-gray-400">
                                Mostrando las {VISIBLE_LIMIT} más recientes. Hay {hiddenCount} más antiguas.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
