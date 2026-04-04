import { Router } from 'express';
import * as ctrl from '../controllers/publicaciones.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

// Públicas
router.get('/', ctrl.getPublicaciones);
router.get('/:id/imagen', ctrl.getPublicacionImagen);

// Protegidas (admin)
router.post('/', verificarToken, ctrl.createPublicacion);
router.put('/:id', verificarToken, ctrl.updatePublicacion);
router.delete('/:id', verificarToken, ctrl.deletePublicacion);

export default router;
