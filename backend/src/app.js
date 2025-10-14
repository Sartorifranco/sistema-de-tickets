console.log('--- app.js: Iniciando carga del archivo ---');

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const server = http.createServer(app);

// --- CONFIGURACIÓN DE CORS ---
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://bacarsa.dyndns.org:3020',
  'http://localhost:3020'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política de CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization"
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const io = new Server(server, {
  cors: corsOptions
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// --- Importar Rutas ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const bacarKeyRoutes = require('./routes/bacarKeyRoutes');
const companyRoutes = require('./routes/companyRoutes');
const publicRoutes = require('./routes/publicRoutes');
const noteRoutes = require('./routes/noteRoutes');
const problemRoutes = require('./routes/problemRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const locationRoutes = require('./routes/locationRoutes');
const { startCronJobs } = require('./services/cronJobs');
// --- Conectar Rutas ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/bacar-keys', bacarKeyRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/admin', require('./routes/problemAdminRoutes'));


// --- Lógica de Socket.IO (sin cambios) ---
io.on('connection', (socket) => {
  console.log(`[Socket.IO Server] Usuario conectado: ${socket.id}`);
  
  const token = socket.handshake.auth.token;
  if (token) {
      try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = decoded;
          console.log(`[Socket.IO Server] Socket ${socket.id} autenticado como usuario ${decoded.id} (${decoded.role})`);

          socket.join(`user-${decoded.id}`);
          console.log(`[Socket.IO Server] Socket ${socket.id} se unió a la sala 'user-${decoded.id}'.`);
          
          if (decoded.role) {
              socket.join(decoded.role);
              console.log(`[Socket.IO Server] Socket ${socket.id} se unió a la sala de rol '${decoded.role}'.`);
          }

      } catch (error) {
          console.error('[Socket.IO Server] Error de autenticación de token:', error.message);
          socket.disconnect(true);
      }
  } else {
      console.warn(`[Socket.IO Server] Conexión de Socket ${socket.id} sin token de autenticación.`);
  }

  socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO Server] Usuario desconectado: ${socket.id}. Razón: ${reason}`);
  });
});

// --- SERVIR EL FRONTEND EN PRODUCCIÓN (sin cambios) ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/build')));
  app.get('*', (req, res) =>
      res.sendFile(path.resolve(__dirname, '../../frontend', 'build', 'index.html'))
  );
} else {
  app.get('/', (req, res) => res.send('API is running...'));
}



const PORT = process.env.PORT || 5040;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado en http://0.0.0.0:${PORT}`);
  startCronJobs(); // ✅ CORRECCIÓN: Se inicia la tarea programada aquí.
});