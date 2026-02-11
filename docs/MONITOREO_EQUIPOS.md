# Monitoreo de Equipos (HWAgente)

Esta sección integra el sistema de tickets con el agente [HWAgente](https://github.com/surlymeyer24/HWAgente) para monitorear el hardware de las PCs de la empresa.

## Arquitectura

```
[PC Windows] → HWAgente (servicio) → Firebase Firestore ← Sistema de Tickets (frontend)
```

- **HWAgente**: Ejecutable que corre como servicio en cada PC. Recolecta CPU, RAM, discos, errores del sistema, aplicaciones activas, AnyDesk ID, etc.
- **Firebase Firestore**: Almacena los datos en la colección `computadoras`. Cada documento es un equipo (document ID = UUID del equipo).
- **Sistema de Tickets**: Lee Firestore desde el frontend y muestra el estado de todos los equipos.

## Configuración

### 1. Firebase (ya configurado)

Las credenciales están en `frontend/src/config/firebaseConfig.ts`. Proyecto: `devbac-42d14`.

### 2. Reglas de Firestore

En [Firebase Console](https://console.firebase.google.com) → Firestore → Reglas, asegurate que permita lectura:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /computadoras/{document} {
      allow read: if true;
      allow write: if false;
    }
    match /tareas/{document} {
      allow read, write: if false;  // Solo el agente (con service account)
    }
  }
}
```

**Nota**: El HWAgente usa `serviceAccountKey.json` (Firebase Admin) para escribir. El sistema de tickets usa la config web para leer. La regla `allow read: if true` permite que el frontend lea sin autenticación Firebase (el sistema de tickets tiene su propia auth).

### 3. HWAgente en cada PC

1. Clonar o descargar [HWAgente](https://github.com/surlymeyer24/HWAgente)
2. En `config/config.py` o dentro del build, el agente debe apuntar al mismo proyecto Firebase (`devbac-42d14`)
3. Colocar `serviceAccountKey.json` en `auth/serviceAccountKey.json` (descargar desde Firebase Console → Configuración del proyecto → Cuentas de servicio)
4. Ejecutar el agente (o instalarlo como servicio). Se auto-instala como "Agente de Monitoreo IT"

### 4. Estructura de datos en Firestore

Cada documento en `computadoras` tiene (ejemplo):

- `uuid`, `hostname`, `sistema_operativo`, `procesador`, `ram_total_gb`
- `cpu_uso_porcentaje`, `ram_uso_porcentaje`
- `discos`, `servicios_criticos`, `errores_recientes`, `aplicaciones_activas`
- `ip_publica`, `anydesk_id`
- `ultima_sincronizacion` (timestamp)

## Uso en el sistema de tickets

- **Admin** y **Agente** ven el menú "🖥️ Monitoreo Equipos"
- Tarjetas por equipo: hostname, CPU, RAM, última sync, indicador de estado (verde/amarillo/rojo según antigüedad)
- Clic en una tarjeta abre el detalle: discos, servicios críticos, errores, apps activas, AnyDesk ID

## Variables de entorno (opcional)

Si querés sobrescribir la config de Firebase:

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_MEASUREMENT_ID=...
```
