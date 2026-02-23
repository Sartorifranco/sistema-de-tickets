/**
 * Service Worker para Firebase Cloud Messaging (Push Notifications)
 * Módulo de Compras - Fase 3
 *
 * Usa la misma configuración que firebaseConfig.ts (proyecto devbac-42d14).
 * Si usas otro proyecto para compras, actualiza el objeto de configuración.
 */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyCPsHnnh9aCsMG1W2ML5Vz-doZzQg1I__s',
    authDomain: 'devbac-42d14.firebaseapp.com',
    projectId: 'devbac-42d14',
    storageBucket: 'devbac-42d14.firebasestorage.app',
    messagingSenderId: '317393322844',
    appId: '1:317393322844:web:6215892f4779db5447f799',
    measurementId: 'G-C5LLHPJYXP',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || 'Nueva notificación';
    const options = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: '/logo192.png',
        data: payload.data || {},
    };
    self.registration.showNotification(title, options);
});
