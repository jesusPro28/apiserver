// fix-v4
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

    // Verificar duplicado
    const [[dupCheck]] = await db.query(
      'SELECT COUNT(*) as c FROM asistencia WHERE FECHA = ? AND `NUM-TRABAJADOR` = ?',
      [fecha, numTrabajador]
    );
    if (dupCheck.c > 0) {
      return res.status(400).json({ msg: 'Ya existe un registro de asistencia para hoy.' });
    }

    // Usar stored procedure — evita el problema de backticks en Vercel
    await db.query(
      'CALL sp_registrar_asistencia(?, ?, ?, ?, @p_resultado, @p_es_tardanza)',
      [numTrabajador, fecha, entrada, salida]
    );

    const [[output]] = await db.query(
      'SELECT @p_resultado as resultado, @p_es_tardanza as es_tardanza'
    );

    const resultado = output.resultado || '';

    if (resultado.startsWith('ERROR')) {
      if (resultado.includes('no encontrado')) {
        return res.status(404).json({ msg: 'Número de trabajador no encontrado.' });
      }
      return res.status(400).json({ msg: resultado });
    }

    const estatus = output.es_tardanza === 1 ? 'RETARDO' : 'PUNTUAL';

    // Notificación extra si acumuló 3+ retardos en el mes
    if (output.es_tardanza === 1) {
      const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX');
      const inicioMes = fecha.substring(0, 7) + '-01';

      const [[conteo]] = await db.query(
        'SELECT COUNT(*) as total FROM estado WHERE `NUM-TRABAJADOR` = ? AND ESTATUS = "RETARDO" AND FECHA >= ? AND FECHA <= ?',
        [numTrabajador, inicioMes, fecha]
      );

      if (conteo.total >= 3) {
        const mensaje = 'Tu retardo del ' + fechaFormateada + ' fue registrado como FALTA. Acumulaste ' + conteo.total + ' retardos.';
        await db.query(
          'INSERT INTO notificaciones (`NUM-TRABAJADOR`, tipo, mensaje, referencia_id) VALUES (?, "INFO", ?, 0)',
          [numTrabajador, mensaje]
        ).catch(e => logger.error('Error notif', { error: e.message }));
      }
    }

    logger.info('Asistencia registrada via SP', { numTrabajador, fecha, estatus });
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
