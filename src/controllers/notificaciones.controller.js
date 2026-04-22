import db from '../config/db.js';
import logger from '../utils/logger.js';

// ─── Empleado: obtener sus notificaciones ───────────────────────────────────
export const getMisNotificaciones = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    if (!numTrabajador) {
      return res.status(400).json({ msg: 'No se pudo identificar al empleado.' });
    }

    const [rows] = await db.query(
      `SELECT * FROM notificaciones WHERE \`NUM-TRABAJADOR\` = ? ORDER BY fecha DESC LIMIT 50`,
      [numTrabajador]
    );

    const [noLeidas] = await db.query(
      `SELECT COUNT(*) as total FROM notificaciones WHERE \`NUM-TRABAJADOR\` = ? AND leida = 0`,
      [numTrabajador]
    );

    res.json({ notificaciones: rows, noLeidas: noLeidas[0].total });
  } catch (error) {
    logger.error('Error en getMisNotificaciones', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener notificaciones.' });
  }
};

// ─── Empleado: marcar una notificación como leída ──────────────────────────
export const marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    const numTrabajador = req.usuario.numTrabajador;

    await db.query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ? AND `NUM-TRABAJADOR` = ?',
      [parseInt(id), numTrabajador]
    );

    res.json({ msg: 'Notificación marcada como leída.' });
  } catch (error) {
    logger.error('Error en marcarLeida', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar notificación.' });
  }
};

// ─── Empleado: marcar todas como leídas ────────────────────────────────────
export const marcarTodasLeidas = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    await db.query(
      'UPDATE notificaciones SET leida = 1 WHERE `NUM-TRABAJADOR` = ? AND leida = 0',
      [numTrabajador]
    );
    res.json({ msg: 'Todas las notificaciones marcadas como leídas.' });
  } catch (error) {
    logger.error('Error en marcarTodasLeidas', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar notificaciones.' });
  }
};

// ─── ADMIN: enviar notificación a un empleado ──────────────────────────────
// POST /api/notificaciones/enviar
// Body: { numTrabajador: "12345", mensaje: "Texto..." }
export const enviarNotificacion = async (req, res) => {
  try {
    // Solo admins pueden usar este endpoint (verificado con soloAdmin en rutas)
    const { numTrabajador, mensaje } = req.body;

    if (!numTrabajador || !mensaje || !mensaje.trim()) {
      return res.status(400).json({ msg: 'numTrabajador y mensaje son obligatorios.' });
    }

    if (mensaje.trim().length > 1000) {
      return res.status(400).json({ msg: 'El mensaje no puede superar 1000 caracteres.' });
    }

    // Verificar que el empleado existe
    const [empleado] = await db.query(
      'SELECT `NUM-TRABAJADOR` FROM empleados WHERE `NUM-TRABAJADOR` = ? LIMIT 1',
      [numTrabajador]
    );

    if (empleado.length === 0) {
      return res.status(404).json({ msg: `No existe el empleado con número ${numTrabajador}.` });
    }

    // Insertar la notificación
    const [result] = await db.query(
      'INSERT INTO notificaciones (`NUM-TRABAJADOR`, mensaje, leida, fecha) VALUES (?, ?, 0, NOW())',
      [numTrabajador, mensaje.trim()]
    );

    logger.info('Notificación enviada por admin', {
      admin: req.usuario.numTrabajador || req.usuario.id,
      destinatario: numTrabajador,
      id: result.insertId,
    });

    res.status(201).json({
      ok: true,
      msg: 'Notificación enviada correctamente.',
      id: result.insertId,
    });
  } catch (error) {
    logger.error('Error en enviarNotificacion', { error: error.message });
    res.status(500).json({ msg: 'Error al enviar la notificación.' });
  }
};

// ─── Empleado: obtener notificaciones de retardo ───────────────────────────
export const getNotificacionesRetardo = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    if (!numTrabajador) {
      return res.status(400).json({ msg: 'No se pudo identificar al empleado.' });
    }

    const [rows] = await db.query(
      `SELECT id, \`num-trabajador\` AS numTrabajador, mensaje, fecha_registro
       FROM notificacionRetardo
       WHERE \`num-trabajador\` = ?
       ORDER BY fecha_registro DESC
       LIMIT 50`,
      [numTrabajador]
    );

    res.json({ notificacionesRetardo: rows });
  } catch (error) {
    logger.error('Error en getNotificacionesRetardo', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener notificaciones de retardo.' });
  }
};
