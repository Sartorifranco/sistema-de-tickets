console.log('--- app.js: Iniciando carga del sistema ---');

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// 1. Cargar variables de entorno
dotenv.config();

const app = express();
const server = http.createServer(app);

// --- 2. CONFIGURACIÓN ROBUSTA DE CORS ---
const allowedOrigins = [
  process.env.FRONTEND_URL,          // Del .env
  'http://bacarsa.dyndns.org:8001',  // Producción externa Frontend
  'http://192.168.0.9:8001',         // Producción interna Frontend
  'http://localhost:3020',           // Desarrollo local React
  'http://localhost:8001',           
  'http://192.168.0.9:5040',         
  'http://localhost:5040',           // Acceso local al backend
  'http://bacarsa.dyndns.org:5040'   // Acceso externo directo al backend
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('bacarsa.dyndns.org')) {
      callback(null, true);
    } else {
      console.log(`[CORS] Bloqueado: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  credentials: true, 
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- 3. CONFIGURACIÓN SOCKET.IO ---
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// --- 4. IMPORTACIÓN DE RUTAS ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const companyRoutes = require('./routes/companyRoutes');
const depositarioRoutes = require('./routes/depositarioRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { startCronJobs } = require('./services/cronJobs');

// --- 5. DEFINICIÓN DE ENDPOINTS (API) ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/depositarios', depositarioRoutes);
app.use('/api/ai', aiRoutes);

// ✅ RUTAS PÚBLICAS (Para registro sin token)
app.use('/api/public', require('./routes/publicDataRoutes'));

// ✅ RUTAS DE ADMINISTRACIÓN (Problemáticas y Ubicaciones)
app.use('/api/admin', require('./routes/problemAdminRoutes'));

// ✅ RUTAS DE DATOS GENERALES (Para tickets y perfiles)
app.use('/api', require('./routes/dataRoutes'));

// --- 6. SOCKET.IO EVENTOS ---
io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  if (token) {
      try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.join(`user-${decoded.id}`);
          console.log(`✅ Socket conectado: ${decoded.username} (${socket.id})`);
          
          if (decoded.role) {
              socket.join(decoded.role);
          }
      } catch (error) {
          // Token inválido o expirado
      }
  }
  
  socket.on('disconnect', () => {
      // console.log('Socket desconectado');
  });
});

// --- 7. SERVIR FRONTEND (PRODUCCIÓN) ---
app.use(express.static(path.join(__dirname, '../../frontend/build')));
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
      return res.status(404).json({ success: false, message: 'API Endpoint no encontrado' });
  }
  res.sendFile(path.resolve(__dirname, '../../frontend/build', 'index.html'));
});

// --- 8. INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 5040;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  startCronJobs();
});