import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getHorarioEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador || req.usuario.numTrabajador || '');
    const [rows] = await db.query(
      'SELECT * FROM horario WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Horario no encontrado.' });
    }
    res.json(rows[0]);
  } catch (error) {
    logger.error('Error en getHorarioEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener horario.' });
  }
};

export const getAllHorarios = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.*, CONCAT(e.NOMBRE, ' ', e.\`A-PATERNO\`, ' ', e.\`A-MATERNO\`) as nombre_completo
       FROM horario h
       LEFT JOIN empleado e ON h.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\``
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getAllHorarios', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener horarios.' });
  }
};
