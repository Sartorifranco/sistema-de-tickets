# Configuración Completa - Sistema de Tickets Bacar

Guía para dejar todos los servicios funcionando correctamente.

---

## 1. Backend - Archivo `.env`

Ubicación: `backend/.env` (copiar desde `backend/.env.example`).

### 1.1 Base de datos (obligatorio)

```env
DB_HOST=192.168.0.9
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=ticket_system
DB_PORT=3316
```

### 1.2 Seguridad (obligatorio)

```env
JWT_SECRET=generar_un_secreto_largo_y_aleatorio
JWT_EXPIRES_IN=1d
NODE_ENV=production
```

### 1.3 Puerto y URLs (obligatorio)

```env
PORT=5040
FRONTEND_URL=http://bacarsa.dyndns.org:8001
# Opcional: si los Magic Links de aprobación fallan, defina la URL pública del backend
# API_URL=http://bacarsa.dyndns.org:5040
```

### 1.4 Correo / SMTP (obligatorio para notificaciones)

Gmail con contraseña de aplicación:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=sistemas.ti@bacarsa.com.ar
EMAIL_PASS="xxxx xxxx xxxx xxxx"
```

**Gmail:** [Configuración de Google → Seguridad → Contraseñas de aplicaciones](https://myaccount.google.com/apppasswords). Si `EMAIL_PASS` tiene espacios, póngalo entre comillas.

### 1.5 Firebase - Módulo de Compras + Push (obligatorio para Compras)

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar el proyecto (ej. `bacar-compras-tkt` o `devbac-42d14`)
3. **Configuración del proyecto** (ícono engranaje) → **Cuentas de servicio**
4. **Generar nueva clave privada** → descargar JSON
5. Renombrar el archivo a `firebase-service-account.json`
6. Copiar en `backend/firebase-service-account.json` (nunca subir a Git)

```env
FIREBASE_CREDENTIALS=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=bacar-compras-tkt.firebasestorage.app
```

- `FIREBASE_CREDENTIALS`: ruta relativa al JSON (desde `backend/`)
- `FIREBASE_STORAGE_BUCKET`: en Firebase Console → Storage → ver bucket (ej. `proyecto.firebasestorage.app`)

**En el servidor:** asegurarse de que el archivo exista en `C:\ST - Bacar\backend\firebase-service-account.json` y que `.env` tenga `FIREBASE_CREDENTIALS=./firebase-service-account.json`.

### 1.6 WhatsApp - Twilio (opcional)

1. Crear cuenta en [Twilio Console](https://console.twilio.com)
2. Copiar Account SID y Auth Token

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_SANDBOX_JOIN_CODE=tu_codigo
```

**Sandbox:** cada destinatario debe enviar `join TU_CODIGO` al número de Twilio para recibir mensajes. El código aparece en Twilio Console → Messaging → Try it out → Send a WhatsApp message.

---

## 2. Frontend - Archivo `.env`

Ubicación: `frontend/.env`.

### 2.1 URL del backend (obligatorio)

```env
REACT_APP_BACKEND_URL=http://bacarsa.dyndns.org:5040
```

Para desarrollo local: `REACT_APP_BACKEND_URL=http://localhost:5040`

### 2.2 Push Notifications - VAPID Key (opcional, para FCM)

1. Firebase Console → **Configuración del proyecto** → **Cloud Messaging**
2. En **Web Push certificates**, generar nuevo par de claves
3. Copiar la **Clave pública**

```env
REACT_APP_FIREBASE_VAPID_KEY=BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Si no se configura, las notificaciones push no funcionarán, pero el resto del sistema sí.

### 2.3 Firebase Client (Monitoreo de equipos)

Si usás otro proyecto Firebase para el monitoreo:

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_VAPID_KEY=...
```

---

## 3. Validar la configuración

### Script de verificación (backend)

```powershell
cd backend
node scripts/check-config.js
```

### Endpoint (requiere estar logueado como admin)

```
GET /api/notifications/config-status
```

Muestra: Email ✅/❌, Push ✅/❌, WhatsApp ✅/❌.

---

## 4. Checklist rápido

| Componente      | Verificar |
|----------------|-----------|
| Base de datos  | `npm run dev` conecta sin errores |
| Email          | Enviar email de prueba desde el sistema |
| Firebase       | No aparece "[Firebase] FIREBASE_CREDENTIALS no está definido" |
| Archivo JSON   | `backend/firebase-service-account.json` existe en el servidor |
| Twilio         | (Opcional) WhatsApp sandbox: `join CODIGO` al número From |
| Frontend build | `npm run build` y desplegar `frontend/build` |

---

## 5. Problemas frecuentes

### "FIREBASE_CREDENTIALS no está definido"

1. Confirmar que `backend/.env` tiene `FIREBASE_CREDENTIALS=./firebase-service-account.json`
2. Confirmar que `backend/firebase-service-account.json` existe
3. Reiniciar el backend tras modificar `.env`

### "El Módulo de Compras no estará disponible"

El backend necesita Firebase (Service Account) para el módulo de Compras. Sin él, las rutas de compras devolverán error.

### Email no envía

- Gmail: usar **contraseña de aplicación**, no la contraseña habitual
- Si hay espacios en `EMAIL_PASS`, usar comillas: `EMAIL_PASS="xxxx xxxx xxxx xxxx"`

### git pull falla por cambios en build

```powershell
git checkout -- frontend/build
git pull origin main
cd frontend
npm run build
```
