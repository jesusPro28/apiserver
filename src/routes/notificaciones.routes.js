import { Router } from 'express';
import * as ctrl from '../controllers/notificaciones.controller.js';
import { verificarToken, soloAdmin } from '../middleware/auth.js';

const router = Router();

// ─── Rutas del EMPLEADO (token propio) ─────────────────────────────────────
router.get('/',              verificarToken, ctrl.getMisNotificaciones);
router.get('/retardo',       verificarToken, ctrl.getNotificacionesRetardo);
router.put('/:id/leida',     verificarToken, ctrl.marcarLeida);
router.put('/marcar-todas',  verificarToken, ctrl.marcarTodasLeidas);

// ─── Ruta del ADMIN ────────────────────────────────────────────────────────
// POST /api/notificaciones/enviar
// Requiere token de administrador (soloAdmin verifica req.usuario.tipo === 'admin')
router.post('/enviar', verificarToken, soloAdmin, ctrl.enviarNotificacion);

export default router;
