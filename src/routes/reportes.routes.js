import { Router } from 'express';
import * as ctrl from '../controllers/reportes.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/individual', verificarToken, ctrl.reporteIndividual);
router.get('/general', verificarToken, ctrl.reporteGeneral);

export default router;
