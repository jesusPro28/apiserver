import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getIncidenciasEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador || req.usuario.numTrabajador || '');
    const [rows] = await db.query(
      'SELECT * FROM incidencias WHERE `NUM-TRABAJADOR` = ? ORDER BY FECHA DESC',
      [numTrabajador]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getIncidenciasEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener incidencias.' });
  }
};

export const getAllIncidencias = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT i.*, CONCAT(e.NOMBRE, ' ', e.\`A-PATERNO\`) as nombre_empleado
       FROM incidencias i
       LEFT JOIN empleado e ON i.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\`
       ORDER BY i.FECHA DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getAllIncidencias', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener incidencias.' });
  }
};

export const createIncidencia = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.body.numTrabajador || '');
    const curp = sanitizar(req.body.curp || '');
    const fecha = req.body.fecha || '';
    const descripcion = sanitizar(req.body.descripcion || '');

    if (!numTrabajador || !curp || !fecha || !descripcion) {
      return res.status(400).json({ msg: 'Todos los campos son obligatorios (Núm. trabajador, CURP, fecha, descripción).' });
    }

    if (descripcion.length > 2000) {
      return res.status(400).json({ msg: 'La descripción no puede exceder 2000 caracteres.' });
    }

    const [result] = await db.query(
      'INSERT INTO incidencias (`NUM-TRABAJADOR`, CURP, FECHA, DESCRIPCION) VALUES (?, ?, ?, ?)',
      [numTrabajador, curp, fecha, descripcion]
    );

    logger.info('Incidencia registrada', { numTrabajador, fecha });
    res.status(201).json({ msg: 'Incidencia registrada correctamente.', id: result.insertId });
  } catch (error) {
    logger.error('Error en createIncidencia', { error: error.message });
    res.status(500).json({ msg: 'Error al registrar incidencia.' });
  }
};
