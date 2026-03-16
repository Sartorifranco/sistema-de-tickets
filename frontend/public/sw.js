// Notificación NATIVA de Windows/OS: se superpone a todas las ventanas
self.addEventListener('push', function(event) {
  let title = 'Nueva notificación';
  let body = '';
  let url = '/';
  let icon = '/logo192.png';

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || data.message || body;
      url = data.url || (data.data && data.data.ticketId ? '/admin/tickets/' + data.data.ticketId : '/') || url;
      icon = data.icon || icon;
    } catch (e) {
      body = event.data.text() || 'Tienes una nueva actualización.';
    }
  }

  const options = {
    body: body || 'Revisa el sistema de tickets.',
    icon: icon,
    badge: icon,
    requireInteraction: true,
    data: { url: url }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  const fullUrl = url.startsWith('http') ? url : (self.location.origin + (url.startsWith('/') ? url : '/' + url));
  event.waitUntil(clients.openWindow(fullUrl));
});
