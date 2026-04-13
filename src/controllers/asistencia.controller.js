// fix-v2
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
      'SELECT a.*, i.DESCRIPCION as incidencia_desc' +
      ' FROM asistencia a' +
      ' LEFT JOIN incidencias i ON a.`ID-INCIDENCIA` = i.`ID-INCIDENCIA`' +
      ' WHERE a.`NUM-TRABAJADOR` = ?' +
      ' ORDER BY a.FECHA DESC' +
      ' LIMIT ? OFFSET ?',
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
      'SELECT a.*, CONCAT(e.NOMBRE, " ", e.`A-PATERNO`) as nombre_empleado' +
      ' FROM asistencia a' +
      ' LEFT JOIN empleado e ON a.`NUM-TRABAJADOR` = e.`NUM-TRABAJADOR`' +
      ' ORDER BY a.FECHA DESC' +
      ' LIMIT ? OFFSET ?',
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

    // Verificar que el empleado existe
    const [empExiste] = await db.query(
      'SELECT COUNT(*) as c FROM empleado WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );
    if (empExiste[0].c === 0) {
      return res.status(404).json({ msg: 'Número de trabajador no encontrado.' });
    }

    // Verificar que no haya asistencia duplicada hoy
    const [existe] = await db.query(
      'SELECT COUNT(*) as c FROM asistencia WHERE `NUM-TRABAJADOR` = ? AND FECHA = ?',
      [numTrabajador, fecha]
    );
    if (existe[0].c > 0) {
      return res.status(400).json({ msg: 'Ya existe un registro de asistencia para hoy.' });
    }

    // Obtener horario del empleado
    const [horario] = await db.query(
      'SELECT * FROM horario WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );

    let horaEntradaProgramada = '08:00:00';
    if (horario.length > 0) {
      const dia = new Date(fecha + 'T12:00:00').getDay();
      // CORRECCIÓN: los nombres de columna usan guion medio (-) no guion bajo (_)
      const mapaDias = {
        1: 'LUNES-am',
        2: 'MARTES-am',
        3: 'MIERCOLES-am',
        4: 'JUEVES-am',
        5: 'VIERNES-am'
      };
      const columna = mapaDias[dia];
      if (columna && horario[0][columna]) {
        horaEntradaProgramada = horario[0][columna];
      }
    }

    const entradaMin = timeToMinutes(entrada);
    const programaMin = timeToMinutes(horaEntradaProgramada);
    const esTardanza = entradaMin > programaMin;
    const estatus = esTardanza ? 'RETARDO' : 'PUNTUAL';

    // INSERT 1: ASISTENCIA — usando concatenación para evitar problemas con backticks en Vercel
    const [resultAsis] = await db.query(
      'INSERT INTO asistencia (`NUM-TRABAJADOR`, FECHA, ENTRADA, SALIDA, `ID-INCIDENCIA`) VALUES (?, ?, ?, ?, ?)',
      [numTrabajador, fecha, entrada, salida, null]
    );

    // INSERT 2: ESTADO
    await db.query(
      'INSERT INTO estado (`NUM-TRABAJADOR`, FECHA, ESTATUS) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ESTATUS = ?',
      [numTrabajador, fecha, estatus, estatus]
    );

    // INSERT 3: NOTIFICACIÓN si hay retardo
    if (esTardanza) {
      const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX');
      const inicioMes = fecha.substring(0, 7) + '-01';

      const [conteo] = await db.query(
        'SELECT COUNT(*) as total FROM estado WHERE `NUM-TRABAJADOR` = ? AND ESTATUS = "RETARDO" AND FECHA >= ? AND FECHA <= ?',
        [numTrabajador, inicioMes, fecha]
      );
      const totalRetardosMes = conteo[0].total;

      const tipo = totalRetardosMes >= 3 ? 'INFO' : 'TARDANZA';
      const mensaje = totalRetardosMes >= 3
        ? 'Tu retardo del ' + fechaFormateada + ' fue registrado como FALTA. Acumulaste ' + totalRetardosMes + ' retardos.'
        : 'Se registro un retardo el dia ' + fechaFormateada + '. Llevas ' + totalRetardosMes + ' este mes.';

      await db.query(
        'INSERT INTO notificaciones (`NUM-TRABAJADOR`, tipo, mensaje, referencia_id) VALUES (?, ?, ?, ?)',
        [numTrabajador, tipo, mensaje, resultAsis.insertId]
      ).catch(e => logger.error('Error notif', { error: e.message }));
    }

    res.status(201).json({ msg: 'Asistencia registrada: ' + estatus, estatus });

  } catch (error) {
    logger.error('Error en registrarAsistencia', { error: error.message });
    res.status(500).json({ msg: 'Error al registrar.', error_tecnico: error.message });
  }
};

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
}
