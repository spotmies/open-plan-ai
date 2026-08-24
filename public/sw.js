// Minimal service worker for Web Push. No offline caching — this project
// isn't a PWA, this file exists purely to receive and display push
// notifications while the app isn't in the foreground.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'OpenPlan AI' };
  }

  const title = data.title || 'OpenPlan AI';
  const options = {
    body: data.content || '',
    icon: '/favicon-light.svg',
    badge: '/favicon-light.svg',
    data: { actionUrl: data.actionUrl || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.actionUrl ? event.notification.data.actionUrl : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
