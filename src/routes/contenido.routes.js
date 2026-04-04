import { Router } from 'express';
import * as ctrl from '../controllers/contenido.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/', ctrl.getContenido);
router.get('/:id/pdf', ctrl.getContenidoPdf);
router.post('/', verificarToken, ctrl.createContenido);      
router.put('/:id', verificarToken, ctrl.updateContenido);    
router.delete('/:id', verificarToken, ctrl.deleteContenido); 

export default router;