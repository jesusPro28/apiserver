import { Router } from 'express';
import * as ctrl from '../controllers/asistencia.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/mis-asistencias', verificarToken, ctrl.getAsistenciasEmpleado);
router.get('/', verificarToken, ctrl.getAllAsistencias);
router.post('/', verificarToken, ctrl.registrarAsistencia);
router.get('/:numTrabajador', verificarToken, ctrl.getAsistenciasEmpleado);

export default router;
