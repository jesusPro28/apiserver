import { Router } from 'express';
import * as ctrl from '../controllers/horario.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/mi-horario', verificarToken, ctrl.getHorarioEmpleado);
router.get('/', verificarToken, ctrl.getAllHorarios);
router.get('/:numTrabajador', verificarToken, ctrl.getHorarioEmpleado);

export default router;
