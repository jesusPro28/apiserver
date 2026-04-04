import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getContenidoPagina = async (req, res) => {
  try {
    const pagina = sanitizar(req.params.pagina);
    const [rows] = await db.query(
      'SELECT * FROM contenido_paginas WHERE pagina = ?',
      [pagina]
    );
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Página no encontrada.' });
    }
    res.json(rows[0]);
  } catch (error) {
    logger.error('Error en getContenidoPagina', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener contenido de página.' });
  }
};

export const updateContenidoPagina = async (req, res) => {
  try {
    const pagina = sanitizar(req.params.pagina);
    const titulo = sanitizar(req.body.titulo || '');
    const contenido = req.body.contenido || '';

    await db.query(
      'CALL sp_actualizar_contenido_pagina(?, ?, ?, @resultado)',
      [pagina, titulo, contenido]
    );

    const [result] = await db.query('SELECT @resultado AS resultado');
    logger.info('Contenido de página actualizado', { pagina });
    res.json({ msg: result[0].resultado });
  } catch (error) {
    logger.error('Error en updateContenidoPagina', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar contenido.' });
  }
};

export const getAllPaginas = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM contenido_paginas');
    res.json(rows);
  } catch (error) {
    logger.error('Error en getAllPaginas', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener páginas.' });
  }
};
