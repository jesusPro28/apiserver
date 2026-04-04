import { Router } from 'express';
import * as ctrl from '../controllers/justificaciones.controller.js';
import { verificarToken, soloAdmin } from '../middleware/auth.js';

const router = Router();

// Empleado
router.post('/', verificarToken, ctrl.enviarJustificacion);
router.get('/mis-justificaciones', verificarToken, ctrl.getMisJustificaciones);

// Admin
router.get('/pendientes', verificarToken, soloAdmin, ctrl.getJustificacionesPendientes);
router.get('/:id/pdf', verificarToken, ctrl.descargarPdfJustificacion);
router.put('/:id/resolver', verificarToken, soloAdmin, ctrl.resolverJustificacion);

export default router;
