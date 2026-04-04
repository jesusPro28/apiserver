import { Router } from 'express';
import * as ctrl from '../controllers/empleados.controller.js';
import { verificarToken } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Se aceptan: JPEG, PNG, WebP, GIF.'));
    }
  }
});

const router = Router();

router.get('/', verificarToken, ctrl.getEmpleados);
router.get('/mi-perfil', verificarToken, ctrl.getMiPerfil);
router.get('/validar-curp', verificarToken, ctrl.validarCurpEndpoint);
router.get('/:numTrabajador', verificarToken, ctrl.getEmpleado);
router.post('/', verificarToken, upload.single('foto'), ctrl.createEmpleado);
router.put('/foto', verificarToken, ctrl.updateFoto);
router.put('/:numTrabajador', verificarToken, ctrl.updateEmpleado);
router.delete('/:numTrabajador', verificarToken, ctrl.deleteEmpleado);

export default router;
