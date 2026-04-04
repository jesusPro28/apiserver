import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getEstadoEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador || req.usuario.numTrabajador || '');
    const [rows] = await db.query(
      'SELECT * FROM estado WHERE `NUM-TRABAJADOR` = ? ORDER BY FECHA DESC LIMIT 1',
      [numTrabajador]
    );
    if (rows.length === 0) {
      return res.json({ estatus: 'Sin registro de estado' });
    }
    res.json(rows[0]);
  } catch (error) {
    logger.error('Error en getEstadoEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener estado.' });
  }
};

export const getAllEstados = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT es.*, CONCAT(e.NOMBRE, ' ', e.\`A-PATERNO\`) as nombre_empleado
       FROM estado es
       LEFT JOIN empleado e ON es.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\`
       ORDER BY es.FECHA DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getAllEstados', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener estados.' });
  }
};
