/**
 * Service Worker para Web Push nativas del SO.
 * Solo usa self.registration.showNotification() - sin DOM ni librerías UI.
 */
self.addEventListener('push', (event) => {
    let title = 'Nueva notificación';
    let body = '';
    let icon = '/logo192.png';
    let url = '/';

    if (event.data) {
        try {
            const json = event.data.json();
            title = json.title || json.notification?.title || title;
            body = json.body || json.notification?.body || json.message || body;
            icon = json.icon || json.notification?.icon || icon;
            url = json.url || json.data?.url || json.data?.ticketId ? `/admin/tickets/${json.data.ticketId}` : url;
        } catch {
            body = event.data.text() || body;
        }
    }

    const options = {
        body,
        icon,
        data: { url },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || self.location.origin;
    const targetUrl = url.startsWith('http') ? url : `${self.location.origin}${url.startsWith('/') ? url : '/' + url}`;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
