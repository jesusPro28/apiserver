import { Router } from 'express';
import { verificarToken } from '../middleware/auth.js';
import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

const SALT_ROUNDS = 12;
const router = Router();

// ✅ Obtener perfil completo del empleado logueado
router.get('/', verificarToken, async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;

    const [rows] = await db.query(
      `SELECT e.\`ID-EMPLEADO\`, e.\`NUM-TRABAJADOR\`, e.CURP, e.NOMBRE,
              e.\`A-PATERNO\`, e.\`A-MATERNO\`, e.PUESTO, e.DEPARTAMENTO, e.foto_perfil,
              h.TURNO, h.\`LUNES-am\`, h.\`LUNES-pm\`,
              h.\`MARTES-am\`, h.\`MARTES-pm\`,
              h.\`MIÉRCOLES-am\`, h.\`MIÉRCOLES-pm\`,
              h.\`JUEVES-am\`, h.\`JUEVES-pm\`,
              h.\`VIERNES-am\`, h.\`VIERNES-pm\`
       FROM empleado e
       LEFT JOIN horario h ON e.\`NUM-TRABAJADOR\` = h.\`NUM-TRABAJADOR\`
       WHERE e.\`NUM-TRABAJADOR\` = ?`,
      [numTrabajador]
    );

    if (rows.length === 0) return res.status(404).json({ msg: 'Empleado no encontrado.' });

    const emp = rows[0];
    const horario = emp.TURNO ? {
      TURNO: emp.TURNO,
      'LUNES-am':     emp['LUNES-am'],     'LUNES-pm':     emp['LUNES-pm'],
      'MARTES-am':    emp['MARTES-am'],    'MARTES-pm':    emp['MARTES-pm'],
      'MIÉRCOLES-am': emp['MIÉRCOLES-am'], 'MIÉRCOLES-pm': emp['MIÉRCOLES-pm'],
      'JUEVES-am':    emp['JUEVES-am'],    'JUEVES-pm':    emp['JUEVES-pm'],
      'VIERNES-am':   emp['VIERNES-am'],   'VIERNES-pm':   emp['VIERNES-pm']
    } : null;

    // Últimos 10 estados para la vista rápida del perfil
    const [estados] = await db.query(
      `SELECT FECHA, ESTATUS FROM estado
       WHERE \`NUM-TRABAJADOR\` = ?
       ORDER BY FECHA DESC`,
      [numTrabajador]
    );

    // Contar retardos del mes actual
    const now = new Date();
    const primerDiaMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const [retardosMes] = await db.query(
      `SELECT COUNT(*) as total FROM estado
       WHERE \`NUM-TRABAJADOR\` = ? AND ESTATUS = 'RETARDO' AND FECHA >= ?`,
      [numTrabajador, primerDiaMes]
    );

    // Notificaciones no leídas
    const [notifNoLeidas] = await db.query(
      `SELECT COUNT(*) as total FROM notificaciones WHERE \`NUM-TRABAJADOR\` = ? AND leida = 0`,
      [numTrabajador]
    ).catch(() => [[{ total: 0 }]]);

    res.json({
      empleado: emp,
      horario,
      estados,
      retardosMes: retardosMes[0].total,
      notificacionesNoLeidas: notifNoLeidas[0]?.total || 0
    });
  } catch (error) {
    logger.error('Error en perfil GET', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener perfil.' });
  }
});

// ✅ Obtener TODAS las asistencias del empleado (sin límite, desde inicio hasta hoy)
router.get('/asistencias', verificarToken, async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    const { fechaInicio, fechaFin } = req.query;

    let query = 'SELECT FECHA, ENTRADA, SALIDA, `ID-INCIDENCIA` FROM asistencia WHERE `NUM-TRABAJADOR` = ?';
    let params = [numTrabajador];

    if (fechaInicio && fechaFin) {
      query += ' AND FECHA BETWEEN ? AND ?';
      params.push(fechaInicio, fechaFin);
    }

    // Sin LIMIT — devuelve todos los registros desde el primer día hasta hoy
    query += ' ORDER BY FECHA DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    logger.error('Error en perfil/asistencias', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener asistencias.' });
  }
});

// ✅ Obtener incidencias del empleado
router.get('/incidencias', verificarToken, async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    const [rows] = await db.query(
      'SELECT * FROM incidencias WHERE `NUM-TRABAJADOR` = ? ORDER BY FECHA DESC',
      [numTrabajador]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en perfil/incidencias', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener incidencias.' });
  }
});

// ✅ Cambiar contraseña
router.put('/password', verificarToken, async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ msg: 'Contraseña actual y nueva son obligatorias.' });
    }
    if (passwordNueva.length < 8) {
      return res.status(400).json({ msg: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    if (!/[A-Z]/.test(passwordNueva)) {
      return res.status(400).json({ msg: 'La contraseña debe tener al menos una mayúscula.' });
    }
    if (!/[0-9]/.test(passwordNueva)) {
      return res.status(400).json({ msg: 'La contraseña debe tener al menos un número.' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordNueva)) {
      return res.status(400).json({ msg: 'La contraseña debe tener al menos un carácter especial.' });
    }

    const [rows] = await db.query(
      'SELECT pws FROM empleado WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );

    if (rows.length === 0) return res.status(404).json({ msg: 'Empleado no encontrado.' });

    let valida = false;
    if (rows[0].pws && (rows[0].pws.startsWith('$2b$') || rows[0].pws.startsWith('$2a$'))) {
      valida = await bcrypt.compare(passwordActual, rows[0].pws);
    } else {
      valida = (passwordActual === rows[0].pws);
    }
    if (!valida) return res.status(401).json({ msg: 'Contraseña actual incorrecta.' });

    const hash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    await db.query(
      'UPDATE empleado SET pws = ? WHERE `NUM-TRABAJADOR` = ?',
      [hash, numTrabajador]
    );

    logger.info('Contraseña cambiada desde perfil', { numTrabajador });
    res.json({ msg: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    logger.error('Error en perfil/password', { error: error.message });
    res.status(500).json({ msg: 'Error al cambiar contraseña.' });
  }
});

// ✅ Actualizar foto de perfil
router.post('/foto', verificarToken, async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    const { foto } = req.body;

    if (!foto) return res.status(400).json({ msg: 'La foto es obligatoria.' });

    if (foto.length > 7 * 1024 * 1024) {
      return res.status(400).json({ msg: 'La foto excede el tamaño máximo de 5MB.' });
    }

    await db.query(
      'UPDATE empleado SET foto_perfil = ? WHERE `NUM-TRABAJADOR` = ?',
      [foto, numTrabajador]
    );

    res.json({ msg: 'Foto actualizada correctamente.' });
  } catch (error) {
    logger.error('Error en perfil/foto', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar foto.' });
  }
});

export default router;
