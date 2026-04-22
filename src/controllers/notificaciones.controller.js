import db from '../config/db.js';
import logger from '../utils/logger.js';

// Obtener notificaciones y reportes del empleado logueado
export const getMisNotificaciones = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    if (!numTrabajador) {
      return res.status(400).json({ msg: 'No se pudo identificar al empleado.' });
    }

    // 1. Consulta combinada con UNION ALL
    // Nota: Ajustamos los nombres de los campos para que coincidan (num-trabajador vs NUM-TRABAJADOR)
    const [rows] = await db.query(
      `
      SELECT id, mensaje, fecha, leida, 'GENERAL' AS tipo 
      FROM notificaciones 
      WHERE \`NUM-TRABAJADOR\` = ?
      
      UNION ALL
      
      SELECT id, mensaje, fecha, leida, 'REPORTE' AS tipo 
      FROM notificacionesReportes 
      WHERE \`num-trabajador\` = ?
      
      ORDER BY fecha DESC 
      LIMIT 50
      `,
      [numTrabajador, numTrabajador]
    );

    // 2. Conteo de no leídas de AMBAS tablas
    const [noLeidas] = await db.query(
      `
      SELECT (
        (SELECT COUNT(*) FROM notificaciones WHERE \`NUM-TRABAJADOR\` = ? AND leida = 0) +
        (SELECT COUNT(*) FROM notificacionesReportes WHERE \`num-trabajador\` = ? AND leida = 0)
      ) as total
      `,
      [numTrabajador, numTrabajador]
    );

    res.json({ 
      notificaciones: rows, 
      noLeidas: noLeidas[0].total 
    });
  } catch (error) {
    logger.error('Error en getMisNotificaciones', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener notificaciones.' });
  }
};

// Marcar notificación como leída (debe funcionar para ambas si comparten IDs o lógica similar)
export const marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    const numTrabajador = req.usuario.numTrabajador;

    // Intentamos actualizar en la tabla general
    const [resGen] = await db.query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ? AND `NUM-TRABAJADOR` = ?',
      [parseInt(id), numTrabajador]
    );

    // Si no se afectó ninguna fila, intentamos en la de reportes
    if (resGen.affectedRows === 0) {
      await db.query(
        'UPDATE notificacionesReportes SET leida = 1 WHERE id = ? AND `num-trabajador` = ?',
        [parseInt(id), numTrabajador]
      );
    }

    res.json({ msg: 'Notificación marcada como leída.' });
  } catch (error) {
    logger.error('Error en marcarLeida', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar notificación.' });
  }
};
