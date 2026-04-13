// fix-v11
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
      'CALL sp_get_asistencias_empleado(?, ?, ?)',
      [numTrabajador, limit, offset]
    );
    res.json(rows[0]);
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
      'CALL sp_get_all_asistencias(?, ?)',
      [limit, offset]
    );
    res.json(rows[0]);
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
      return res.status(400).json({ msg: 'Numero de trabajador y hora de entrada son obligatorios.' });
    }

    // Todo via stored procedures - sin backticks en JS
    await db.query('CALL sp_registrar_asistencia(?, ?, ?, ?, @p_resultado, @p_es_tardanza)',
      [numTrabajador, fecha, entrada, salida]
    );

    const [[output]] = await db.query(
      'SELECT @p_resultado as resultado, @p_es_tardanza as es_tardanza'
    );

    const resultado = output.resultado || '';

    if (resultado.startsWith('ERROR')) {
      if (resultado.includes('no encontrado')) {
        return res.status(404).json({ msg: 'Numero de trabajador no encontrado.' });
      }
      if (resultado.includes('duplicado') || resultado.includes('Ya existe')) {
        return res.status(400).json({ msg: 'Ya existe un registro de asistencia para hoy.' });
      }
      return res.status(400).json({ msg: resultado });
    }

    const estatus = output.es_tardanza === 1 ? 'RETARDO' : 'PUNTUAL';

    if (output.es_tardanza === 1) {
      const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX');
      const inicioMes = fecha.substring(0, 7) + '-01';

      const [[conteo]] = await db.query(
        'CALL sp_contar_retardos_mes(?, ?, ?)',
        [numTrabajador, inicioMes, fecha]
      );

      if (conteo.total >= 3) {
        const mensaje = 'Tu retardo del ' + fechaFormateada + ' fue registrado como FALTA. Acumulaste ' + conteo.total + ' retardos.';
        await db.query('CALL sp_insertar_notificacion(?, ?)',
          [numTrabajador, mensaje]
        ).catch(e => logger.error('Error notif', { error: e.message }));
      }
    }

    logger.info('Asistencia registrada', { numTrabajador, fecha, estatus });
    res.status(201).json({ msg: 'Asistencia registrada: ' + estatus, estatus });

  } catch (error) {
    logger.error('Error en registrarAsistencia', { error: error.message });
    res.status(500).json({ msg: 'Error al registrar.', error_tecnico: error.message });
  }
};
