// fix-v7
import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getAsistenciasEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador || req.usuario.numTrabajador || '');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT a.*, i.DESCRIPCION as incidencia_desc
       FROM asistencia a
       LEFT JOIN incidencias i ON a.\`ID-INCIDENCIA\` = i.\`ID-INCIDENCIA\`
       WHERE CONVERT(a.\`NUM-TRABAJADOR\` USING utf8mb4) = CONVERT(? USING utf8mb4)
       ORDER BY a.FECHA DESC
       LIMIT ? OFFSET ?`,
      [numTrabajador, limit, offset]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getAsistenciasEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener asistencias.' });
  }
};

export const getAllAsistencias = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT a.*, CONCAT(e.NOMBRE, ' ', e.\`A-PATERNO\`) as nombre_empleado
       FROM asistencia a
       LEFT JOIN empleado e ON CONVERT(a.\`NUM-TRABAJADOR\` USING utf8mb4) = CONVERT(e.\`NUM-TRABAJADOR\` USING utf8mb4)
       ORDER BY a.FECHA DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getAllAsistencias', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener asistencias.' });
  }
};

export const registrarAsistencia = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.body.numTrabajador || '');
    const fecha = req.body.fecha || new Date().toISOString().split('T')[0];
    const entrada = req.body.entrada || '';
    const salida = req.body.salida || null;

    if (!numTrabajador || !entrada) {
      return res.status(400).json({ msg: 'Número de trabajador y hora de entrada son obligatorios.' });
    }

    // Verificar duplicado
    const [[dupCheck]] = await db.query(
      `SELECT COUNT(*) as c FROM asistencia 
       WHERE FECHA = ? AND CONVERT(\`NUM-TRABAJADOR\` USING utf8mb4) = CONVERT(? USING utf8mb4)`,
      [fecha, numTrabajador]
    );
    if (dupCheck.c > 0) {
      return res.status(400).json({ msg: 'Ya existe un registro de asistencia para hoy.' });
    }

    // Verificar empleado existe
    const [[empCheck]] = await db.query(
      `SELECT COUNT(*) as c FROM empleado 
       WHERE CONVERT(\`NUM-TRABAJADOR\` USING utf8mb4) = CONVERT(? USING utf8mb4)`,
      [numTrabajador]
    );
    if (empCheck.c === 0) {
      return res.status(404).json({ msg: 'Número de trabajador no encontrado.' });
    }

    // Obtener hora de entrada del horario
    const [[horario]] = await db.query(
      `SELECT 
        CASE UPPER(DAYNAME(?))
          WHEN 'MONDAY' THEN \`LUNES-am\`
          WHEN 'TUESDAY' THEN \`MARTES-am\`
          WHEN 'WEDNESDAY' THEN \`MIÉRCOLES-am\`
          WHEN 'THURSDAY' THEN \`JUEVES-am\`
          WHEN 'FRIDAY' THEN \`VIERNES-am\`
          ELSE '08:00:00'
        END as hora_entrada
       FROM horario
       WHERE CONVERT(\`NUM-TRABAJADOR\` USING utf8mb4) = CONVERT(? USING utf8mb4)`,
      [fecha, numTrabajador]
    );

    const horaEntrada = horario?.hora_entrada || '08:00:00';
    const esTardanza = entrada > horaEntrada ? 1 : 0;
    const estatus = esTardanza ? 'RETARDO' : 'PUNTUAL';

    // Insertar asistencia
    await db.query(
      `INSERT INTO asistencia (\`NUM-TRABAJADOR\`, FECHA, ENTRADA, SALIDA) VALUES (?, ?, ?, ?)`,
      [numTrabajador, fecha, entrada, salida]
    );

    // Insertar estado
    await db.query(
      `INSERT INTO estado (\`NUM-TRABAJADOR\`, FECHA, ESTATUS) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE ESTATUS = ?`,
      [numTrabajador, fecha, estatus, estatus]
    );

    // Notificación de tardanza
    if (esTardanza) {
      const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX');

      await db.query(
        `INSERT INTO notificaciones (\`NUM-TRABAJADOR\`, tipo, mensaje, referencia_id)
         VALUES (?, 'TARDANZA', ?, 0)`,
        [numTrabajador, `Retardo el dia ${fechaFormateada}`]
      );

      // Contar retardos del mes
      const inicioMes = fecha.substring(0, 7) + '-01';
      const [[conteo]] = await db.query(
        `SELECT COUNT(*) as total FROM estado
         WHERE CONVERT(\`NUM-TRABAJADOR\` USING utf8mb4) = CONVERT(? USING utf8mb4)
         AND ESTATUS = 'RETARDO' AND FECHA >= ? AND FECHA <= ?`,
        [numTrabajador, inicioMes, fecha]
      );

      if (conteo.total >= 3) {
        const mensaje = `Tu retardo del ${fechaFormateada} fue registrado como FALTA. Acumulaste ${conteo.total} retardos.`;
        await db.query(
          `INSERT INTO notificaciones (\`NUM-TRABAJADOR\`, tipo, mensaje, referencia_id)
           VALUES (?, 'INFO', ?, 0)`,
          [numTrabajador, mensaje]
        ).catch(e => logger.error('Error notif', { error: e.message }));
      }
    }

    logger.info('Asistencia registrada', { numTrabajador, fecha, estatus });
    res.status(201).json({ msg: `Asistencia registrada: ${estatus}`, estatus });

  } catch (error) {
    logger.error('Error en registrarAsistencia', { error: error.message });
    res.status(500).json({ msg: 'Error al registrar.', error_tecnico: error.message });
  }
};
