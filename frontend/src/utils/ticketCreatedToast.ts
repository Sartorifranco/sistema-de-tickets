import { toast } from 'react-toastify';

interface CreateTicketResponse {
    message?: string;
    authorization?: { sent: number; total: number } | null;
}

/** Aviso tras crear un ticket; si pidió autorización, informa si el correo salió o no. */
export function toastTicketCreated(data: CreateTicketResponse | undefined) {
    const auth = data?.authorization;
    if (!auth) {
        toast.success('¡Ticket creado exitosamente!');
        return;
    }
    if (auth.sent > 0) {
        toast.success(data?.message || 'Ticket creado. Se envió el pedido de autorización por correo.', { autoClose: 7000 });
    } else {
        toast.warn(data?.message || 'Ticket creado. Queda pendiente de autorización.', { autoClose: 9000 });
    }
}
