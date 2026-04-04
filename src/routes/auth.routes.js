import { Router } from 'express';
import { loginAdmin, loginEmpleado, cambiarPassword } from '../controllers/auth.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.post('/login-admin', loginAdmin);
router.post('/login-empleado', loginEmpleado);
router.put('/cambiar-password', verificarToken, cambiarPassword);

export default router;
