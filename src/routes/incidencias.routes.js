import { Router } from 'express';
import * as ctrl from '../controllers/incidencias.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/mis-incidencias', verificarToken, ctrl.getIncidenciasEmpleado);
router.get('/', verificarToken, ctrl.getAllIncidencias);
router.get('/:numTrabajador', verificarToken, ctrl.getIncidenciasEmpleado);
router.post('/', verificarToken, ctrl.createIncidencia);

export default router;
