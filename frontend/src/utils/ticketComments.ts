import axios from 'axios';
import api from '../config/axiosConfig';

/** Mensaje del backend (formato no soportado, límite de archivos, etc.) o el genérico. */
export function commentErrorMessage(err: unknown, fallback = 'Error al añadir el comentario.'): string {
    if (axios.isAxiosError(err)) {
        const serverMessage = (err.response?.data as { message?: string } | undefined)?.message;
        if (serverMessage) return serverMessage;
    }
    return fallback;
}

export async function postTicketComment(
    ticketId: number,
    commentText: string,
    isInternal: boolean,
    images: File[] = []
): Promise<void> {
    const formData = new FormData();
    formData.append('comment_text', commentText);
    formData.append('is_internal', String(isInternal));
    images.forEach((img) => formData.append('images', img));

    await api.post(`/api/tickets/${ticketId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}
