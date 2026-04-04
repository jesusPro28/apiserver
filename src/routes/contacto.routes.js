import { Router } from 'express';
import * as ctrl from '../controllers/contacto.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.post('/', ctrl.createContacto);
router.get('/', verificarToken, ctrl.getContactos);

export default router;
