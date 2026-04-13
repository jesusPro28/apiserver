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
       WHERE a.\`NUM-TRABAJADOR\` = ?
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
       LEFT JOIN empleado e ON a.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\`
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

    const [empExiste] = await db.query(
      'SELECT COUNT(*) as c FROM empleado WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );
    if (empExiste[0].c === 0) {
      return res.status(404).json({ msg: 'Número de trabajador no encontrado.' });
    }

    const [existe] = await db.query(
      'SELECT COUNT(*) as c FROM asistencia WHERE `NUM-TRABAJADOR` = ? AND FECHA = ?',
      [numTrabajador, fecha]
    );
    if (existe[0].c > 0) {
      return res.status(400).json({ msg: 'Ya existe un registro de asistencia para este empleado en esta fecha.' });
    }

    const [horario] = await db.query(
      'SELECT * FROM horario WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );

    let horaEntradaProgramada = '08:00:00';
    if (horario.length > 0) {
      const dia = new Date(fecha + 'T12:00:00').getDay();
      const mapaDias = {
        1: 'LUNES_am', 2: 'MARTES_am', 3: 'MIERCOLES_am',
        4: 'JUEVES_am', 5: 'VIERNES_am'
      };
      if (mapaDias[dia] && horario[0][mapaDias[dia]]) {
        horaEntradaProgramada = horario[0][mapaDias[dia]];
      }
    }

    const entradaMin  = timeToMinutes(entrada);
    const programaMin = timeToMinutes(horaEntradaProgramada);
    const esTardanza  = entradaMin > programaMin;
    let estatus       = esTardanza ? 'RETARDO' : 'PUNTUAL';

    // FIX 1: ID-INCIDENCIA como NULL
    const [resultAsis] = await db.query(
      'INSERT INTO asistencia (`NUM-TRABAJADOR`, FECHA, ENTRADA, SALIDA, `ID-INCIDENCIA`) VALUES (?, ?, ?, ?, ?)',
      [numTrabajador, fecha, entrada, salida, null]
    );

    // FIX 2: ID-ESTADO como NULL (Para que funcione, asegúrate de que sea AUTO_INCREMENT en tu BD)
    await db.query(
      `INSERT INTO estado (\`ID-ESTADO\`, \`NUM-TRABAJADOR\`, FECHA, ESTATUS) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ESTATUS = ?`,
      [null, numTrabajador, fecha, estatus, estatus]
    );

    if (esTardanza) {
      const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX');
      const inicioMes = fecha.substring(0, 7) + '-01';

      const [conteoRetardos] = await db.query(
        `SELECT COUNT(*) as total FROM estado
         WHERE \`NUM-TRABAJADOR\` = ?
           AND ESTATUS = 'RETARDO'
           AND FECHA >= ?
           AND FECHA <= ?`,
        [numTrabajador, inicioMes, fecha]
      );

      const totalRetardosMes = conteoRetardos[0].total;

      if (totalRetardosMes >= 3) {
        estatus = 'FALTA';
        await db.query(
          `UPDATE estado SET ESTATUS = 'FALTA'
           WHERE \`NUM-TRABAJADOR\` = ? AND FECHA = ?`,
          [numTrabajador, fecha]
        );

        await db.query(
          `INSERT INTO notificaciones (\`NUM-TRABAJADOR\`, tipo, mensaje, referencia_id)
           VALUES (?, 'INFO', ?, ?)`,
          [numTrabajador, `⚠ Tu retardo del ${fechaFormateada} fue registrado como FALTA. Acumulaste ${totalRetardosMes} retardos.`, resultAsis.insertId]
        ).catch(e => logger.error('Error notif FALTA', { error: e.message }));

      } else {
        const retardosRestantes = 3 - totalRetardosMes;
        await db.query(
          `INSERT INTO notificaciones (\`NUM-TRABAJADOR\`, tipo, mensaje, referencia_id)
           VALUES (?, 'TARDANZA', ?, ?)`,
          [numTrabajador, `Se registró un retardo el día ${fechaFormateada}. Llevas ${totalRetardosMes} este mes.`, resultAsis.insertId]
        ).catch(e => logger.error('Error notif tardanza', { error: e.message }));
      }
    }

    res.status(201).json({
      msg: `Asistencia registrada. Estatus: ${estatus}`,
      estatus,
      esTardanza
    });

  } catch (error) {
    logger.error('Error en registrarAsistencia', { error: error.message });
    res.status(500).json({ 
      msg: 'Error al registrar asistencia.',
      error_tecnico: error.message 
    });
  }
};

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
}
