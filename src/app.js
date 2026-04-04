import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';

import authRoutes from './routes/auth.routes.js';
import empleadosRoutes from './routes/empleados.routes.js';
import publicacionesRoutes from './routes/publicaciones.routes.js';
import horarioRoutes from './routes/horario.routes.js';
import asistenciaRoutes from './routes/asistencia.routes.js';
import incidenciasRoutes from './routes/incidencias.routes.js';
import estadoRoutes from './routes/estado.routes.js';
import contenidoRoutes from './routes/contenido.routes.js';
import contactoRoutes from './routes/contacto.routes.js';
import reportesRoutes from './routes/reportes.routes.js';
import contenidoPaginasRoutes from './routes/contenidoPaginas.routes.js';
import perfilRoutes from './routes/perfil.routes.js';
import notificacionesRoutes from './routes/notificaciones.routes.js';
import justificacionesRoutes from './routes/justificaciones.routes.js';

const app = express();
const port = process.env.PORT || 3000;

// ─── Seguridad: Helmet headers (MODIFICADO PARA PDF) ───
app.use(helmet({
  // Permite cargar recursos desde otros orígenes
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Desactivado para evitar que el visor de PDF del navegador se bloquee
  contentSecurityPolicy: false,
  // ESTO CORRIGE EL ERROR 'SAMEORIGIN': permite que el navegador muestre PDFs en iframes/marcos
  frameguard: false 
}));

// ─── CORS ───
app.use(cors());

// ─── Rate Limiting global ───
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,
  message: { msg: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// ─── Rate Limiting para login (más estricto) ───
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { msg: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ─── Body parsers ───
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ─── Logging de requests ───
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

// ─── Rutas ───
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/publicaciones', publicacionesRoutes);
app.use('/api/horario', horarioRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/incidencias', incidenciasRoutes);
app.use('/api/estado', estadoRoutes);
app.use('/api/contenido', contenidoRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/contenido-paginas', contenidoPaginasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/justificaciones', justificacionesRoutes);

app.get('/', (req, res) => {
  res.send('API UTHH - Sistema de Gestión de Empleados funcionando correctamente');
});

// ─── Manejo de errores global ───
app.use((err, req, res, next) => {
  logger.error('Error no manejado', { error: err.message, stack: err.stack, url: req.originalUrl });
  res.status(500).json({ msg: 'Error interno del servidor. Contacta al administrador.' });
});

// ─── 404 ───
app.use((req, res) => {
  res.status(404).json({ msg: 'Ruta no encontrada.' });
});

// ✅ Solo corre localmente, Vercel no necesita listen
if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    logger.info('La aplicación está funcionando desde el puerto ' + port);
  });
}

export default app;
