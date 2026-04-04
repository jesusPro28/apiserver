import { Router } from 'express';
import * as ctrl from '../controllers/estado.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/mi-estado', verificarToken, ctrl.getEstadoEmpleado);
router.get('/', verificarToken, ctrl.getAllEstados);
router.get('/:numTrabajador', verificarToken, ctrl.getEstadoEmpleado);

export default router;
