# Guía de Despliegue - Sistema de Tickets

## Arquitectura

- **Frontend**: React (build estático en `frontend/build`)
- **Backend**: Node.js/Express (puerto 5040)
- **Base de datos**: MySQL
- **Proxy reverso**: Nginx o similar en `https://bacarsa.dyndns.org`

---

## 1. Requisitos en el servidor

- Node.js 18+
- MySQL 8+
- Nginx (o Apache) con SSL

---

## 2. Backend (Node.js)

### 2.1 Clonar e instalar

```bash
cd /ruta/del/servidor
git clone https://github.com/Sartorifranco/sistema-de-tickets.git
cd sistema-de-tickets/backend
npm install --production
```

### 2.2 Variables de entorno

Crear `backend/.env`:

```env
# Base de datos
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=ticket_system
DB_PORT=3306

# JWT
JWT_SECRET=tu_secreto_muy_largo_y_seguro
JWT_REFRESH_SECRET=otro_secreto_para_refresh
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# URL del frontend (para CORS)
FRONTEND_URL=https://bacarsa.dyndns.org

# Firebase (opcional - Push, Compras)
FIREBASE_CREDENTIALS=./firebase-service-account.json

# Puerto del backend (detrás del proxy)
PORT=5040
```

### 2.3 Ejecutar migraciones

```bash
cd backend

# RBAC (permisos granulares para admins) — obligatorio desde mayo 2026
node scripts/run-rbac-migration.js

# Máquinas de tesorería
node scripts/run-treasury-machines-migration.js

# Multi-agentes en tickets + ticket automático de mantenimiento depositarios
node scripts/run-ticket-assignees-migration.js

# Problemáticas: orden, ocultar sin borrar y prioridad sugerida (idempotente)
node scripts/run-problems-customization-migration.js

# Otras migraciones (si aún no se aplicaron)
# mysql -u root -p ticket_system < migrations/create_user_fcm_tokens.sql
# node run-migration-fcm.js
```

La migración RBAC crea `user_permissions`, agrega `users.is_super_admin` y marca como **super admin** a todos los admins existentes (no cambia el acceso actual hasta que edites permisos en la UI).

La migración de Problemáticas agrega `is_active`, `sort_order` y `default_priority` a `predefined_problems` y `is_active`, `sort_order` a `ticket_categories`. Sin ella el módulo funciona igual, pero sin ordenar, ocultar ni prioridad sugerida (la pantalla lo avisa). El backend detecta las columnas solo; si corrés la migración con el backend levantado, reinicialo o esperá 5 minutos.

### 2.4 Iniciar con PM2 (recomendado)

```bash
npm install -g pm2
pm2 start src/app.js --name "backend"
pm2 save
pm2 startup  # Para que inicie al reiniciar el servidor
```

O sin PM2:

```bash
node src/app.js
# O en background: nohup node src/app.js &
```

---

## 3. Frontend (React)

### 3.1 Build de producción

```bash
cd sistema-de-tickets/frontend

# Configurar URL del backend para producción
export REACT_APP_BACKEND_URL=https://bacarsa.dyndns.org

npm install
npm run build
```

El build genera la carpeta `frontend/build/` con archivos estáticos.

### 3.2 Servir con Nginx

Copiar el contenido de `frontend/build/` al directorio que sirve Nginx, o configurar Nginx para apuntar a esa ruta.

---

## 4. Nginx (Proxy reverso)

Ejemplo de configuración para `https://bacarsa.dyndns.org`:

```nginx
server {
    listen 443 ssl http2;
    server_name bacarsa.dyndns.org;

    ssl_certificate     /etc/letsencrypt/live/bacarsa.dyndns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bacarsa.dyndns.org/privkey.pem;

    # Frontend (archivos estáticos)
    root /var/www/sistema-tickets/frontend/build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API y WebSocket (proxy al backend)
    location /api/ {
        proxy_pass http://127.0.0.1:5040;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5040;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5040;
    }
}
```

### Caddy (servidor actual, puerto 8001)

El frontend usa el **mismo origen** para la API y para Socket.IO, así que el proxy tiene que
pasar `/api/*`, `/socket.io/*` y `/uploads/*` al backend. Si falta `/socket.io/*`, las
notificaciones en tiempo real no llegan (en la consola del navegador aparece
`WebSocket connection to ws://.../socket.io failed`).

```caddyfile
:8001 {
    root * "C:/ST - Bacar/frontend/build"
    encode gzip

    # API, WebSocket (Caddy negocia el upgrade solo) y archivos subidos
    handle /api/* {
        reverse_proxy 127.0.0.1:5040
    }
    handle /socket.io/* {
        reverse_proxy 127.0.0.1:5040
    }
    handle /uploads/* {
        reverse_proxy 127.0.0.1:5040
    }

    # SPA: cualquier otra ruta devuelve index.html
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Después de editar el Caddyfile: `pm2 restart Caddy-HTTPS` (o `caddy reload --config <ruta>`).

### Correo (Gmail)

Si en los logs aparece `Invalid login: 535 ... BadCredentials`, Gmail está rechazando la
contraseña normal. Hay que usar una **contraseña de aplicación**:

1. En la cuenta de Google que envía los mails: Seguridad → Verificación en dos pasos (activarla).
2. Seguridad → Contraseñas de aplicaciones → crear una para "Correo" / "Otro".
3. En `backend/.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=cuenta@gmail.com
EMAIL_PASS="abcd efgh ijkl mnop"   # la de 16 caracteres, entre comillas si tiene espacios
```

4. `pm2 restart backend` y probar desde **Mi Perfil → Enviar correo de prueba**.

---

## 5. CORS en el backend

Asegurarse de que `backend/src/app.js` incluya en `allowedOrigins`:

```javascript
'https://bacarsa.dyndns.org'
```

---

## 6. Checklist de despliegue

- [ ] MySQL corriendo y base de datos creada
- [ ] `backend/.env` configurado
- [ ] Migraciones ejecutadas
- [ ] Backend corriendo (PM2 o similar)
- [ ] Frontend build con `REACT_APP_BACKEND_URL=https://bacarsa.dyndns.org`
- [ ] Archivos de `frontend/build` en el directorio de Nginx
- [ ] Nginx configurado con SSL y proxy al backend
- [ ] CORS actualizado con la URL HTTPS del frontend

---

## 7. Actualizar después de cambios

```bash
cd sistema-de-tickets
git pull origin main

# Backend
cd backend
npm install --production
node scripts/run-rbac-migration.js
node scripts/run-problems-customization-migration.js
pm2 restart backend

# Frontend
cd ../frontend
set REACT_APP_BACKEND_URL=https://bacarsa.dyndns.org
npm install
npm run build
# Copiar frontend/build/* al directorio que sirve Nginx (o IIS)
```

### Windows (servidor en `C:\ST - Bacar`)

```cmd
cd C:\ST - Bacar
git pull origin main
cd backend
npm install --production
node scripts\run-rbac-migration.js
node scripts\run-problems-customization-migration.js
cd ..\frontend
set REACT_APP_BACKEND_URL=https://bacarsa.dyndns.org
npm install
npm run build
```

Reiniciar el proceso Node (PM2, servicio de Windows o la consola donde corre `node src/app.js`).
