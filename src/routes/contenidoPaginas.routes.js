import { Router } from 'express';
import * as ctrl from '../controllers/contenidoPaginas.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/', ctrl.getAllPaginas);
router.get('/:pagina', ctrl.getContenidoPagina);
router.put('/:pagina', verificarToken, ctrl.updateContenidoPagina);

export default router;
