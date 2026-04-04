import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const reporteIndividual = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.query.numTrabajador || '');
    const fechaInicio = req.query.fechaInicio || '';
    const fechaFin = req.query.fechaFin || '';

    if (!numTrabajador || !fechaInicio || !fechaFin) {
      return res.status(400).json({ msg: 'Número de trabajador, fecha inicio y fecha fin son obligatorios.' });
    }

    // Validar formato de fechas
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
      return res.status(400).json({ msg: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    const [empleado] = await db.query(
      `SELECT e.\`NUM-TRABAJADOR\`, e.NOMBRE, e.\`A-PATERNO\`, e.\`A-MATERNO\`,
              e.PUESTO, e.DEPARTAMENTO, h.TURNO
       FROM empleado e
       LEFT JOIN horario h ON e.\`NUM-TRABAJADOR\` = h.\`NUM-TRABAJADOR\`
       WHERE e.\`NUM-TRABAJADOR\` = ?`,
      [numTrabajador]
    );

    if (empleado.length === 0) {
      return res.status(404).json({ msg: 'Empleado no encontrado.' });
    }

    const [asistencias] = await db.query(
      `SELECT a.\`ID-ASISTENCIA\`, a.FECHA, a.ENTRADA, a.SALIDA,
              est.ESTATUS
       FROM asistencia a
       LEFT JOIN estado est ON a.\`NUM-TRABAJADOR\` = est.\`NUM-TRABAJADOR\`
         AND a.FECHA = est.FECHA
       WHERE a.\`NUM-TRABAJADOR\` = ?
         AND a.FECHA BETWEEN ? AND ?
       ORDER BY a.FECHA ASC`,
      [numTrabajador, fechaInicio, fechaFin]
    );

    const [incidencias] = await db.query(
      `SELECT \`ID-INCIDENCIA\`, FECHA, DESCRIPCION
       FROM incidencias
       WHERE \`NUM-TRABAJADOR\` = ?
         AND FECHA BETWEEN ? AND ?
       ORDER BY FECHA ASC`,
      [numTrabajador, fechaInicio, fechaFin]
    );

    // Estadísticas
    const puntuales = asistencias.filter(a => a.ESTATUS === 'PUNTUAL').length;
    const retardos = asistencias.filter(a => a.ESTATUS === 'RETARDO').length;

    logger.info('Reporte individual generado', { numTrabajador, fechaInicio, fechaFin });

    res.json({
      empleado: empleado[0],
      asistencias,
      incidencias,
      estadisticas: {
        totalAsistencias: asistencias.length,
        puntuales,
        retardos,
        totalIncidencias: incidencias.length
      }
    });
  } catch (error) {
    logger.error('Error en reporteIndividual', { error: error.message });
    res.status(500).json({ msg: 'Error al generar reporte.' });
  }
};

export const reporteGeneral = async (req, res) => {
  try {
    const fechaInicio = req.query.fechaInicio || '';
    const fechaFin = req.query.fechaFin || '';

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ msg: 'Fecha inicio y fecha fin son obligatorios.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
      return res.status(400).json({ msg: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    const [asistencias] = await db.query(
      `SELECT a.\`ID-ASISTENCIA\`, a.\`NUM-TRABAJADOR\`, a.FECHA, a.ENTRADA, a.SALIDA,
              CONCAT(e.NOMBRE,' ',e.\`A-PATERNO\`,' ',e.\`A-MATERNO\`) AS nombre_completo,
              e.PUESTO, e.DEPARTAMENTO,
              est.ESTATUS
       FROM asistencia a
       LEFT JOIN empleado e ON a.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\`
       LEFT JOIN estado est ON a.\`NUM-TRABAJADOR\` = est.\`NUM-TRABAJADOR\`
         AND a.FECHA = est.FECHA
       WHERE a.FECHA BETWEEN ? AND ?
       ORDER BY a.\`NUM-TRABAJADOR\`, a.FECHA ASC`,
      [fechaInicio, fechaFin]
    );

    const [incidencias] = await db.query(
      `SELECT i.\`ID-INCIDENCIA\`, i.\`NUM-TRABAJADOR\`, i.FECHA, i.DESCRIPCION,
              CONCAT(e.NOMBRE,' ',e.\`A-PATERNO\`,' ',e.\`A-MATERNO\`) AS nombre_empleado
       FROM incidencias i
       LEFT JOIN empleado e ON i.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\`
       WHERE i.FECHA BETWEEN ? AND ?
       ORDER BY i.\`NUM-TRABAJADOR\`, i.FECHA ASC`,
      [fechaInicio, fechaFin]
    );

    logger.info('Reporte general generado', { fechaInicio, fechaFin });
    res.json({ asistencias, incidencias });
  } catch (error) {
    logger.error('Error en reporteGeneral', { error: error.message });
    res.status(500).json({ msg: 'Error al generar reporte.' });
  }
};
