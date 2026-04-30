/**
 * Service Worker para Web Push nativas
 * Escucha el evento 'push' y muestra notificaciones.
 */
self.addEventListener('push', (event) => {
    let data = { title: 'Nueva notificación', body: '', icon: '/logo192.png', url: '/' };
    if (event.data) {
        try {
            const json = event.data.json();
            data = {
                title: json.title || json.notification?.title || data.title,
                body: json.body || json.notification?.body || json.message || data.body,
                icon: json.icon || json.notification?.icon || data.icon,
                url: json.url || json.data?.url || data.url,
            };
        } catch {
            data.body = event.data.text() || data.body;
        }
    }
    const options = {
        body: data.body,
        icon: data.icon,
        data: { url: data.url },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
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
