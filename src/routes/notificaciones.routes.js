import { Router } from 'express';
import * as ctrl from '../controllers/notificaciones.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, ctrl.getMisNotificaciones);
router.put('/:id/leida', verificarToken, ctrl.marcarLeida);
router.put('/marcar-todas', verificarToken, ctrl.marcarTodasLeidas);

export default router;
