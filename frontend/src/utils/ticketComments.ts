import api from '../config/axiosConfig';

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
