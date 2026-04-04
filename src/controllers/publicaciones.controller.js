import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getPublicaciones = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT id, titulo, contenido, fecha, tipo_imagen, nombre_imagen, created_at, updated_at,
              CASE WHEN imagen IS NOT NULL THEN 1 ELSE 0 END as tiene_imagen
       FROM publicaciones ORDER BY fecha DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getPublicaciones', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener publicaciones.' });
  }
};

export const getPublicacionImagen = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT imagen, tipo_imagen, nombre_imagen FROM publicaciones WHERE id = ?',
      [parseInt(id)]
    );
    if (rows.length === 0 || !rows[0].imagen) {
      return res.status(404).json({ msg: 'Imagen no encontrada.' });
    }
    const tipo = rows[0].tipo_imagen || 'image/jpeg';
    res.set('Content-Type', tipo);
    res.send(rows[0].imagen);
  } catch (error) {
    logger.error('Error en getPublicacionImagen', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener imagen.' });
  }
};

export const createPublicacion = async (req, res) => {
  try {
    const titulo = sanitizar(req.body.titulo || '');
    const contenido = req.body.contenido || '';
    const fecha = req.body.fecha;

    if (!titulo || !contenido) {
      return res.status(400).json({ msg: 'Título y contenido son obligatorios.' });
    }

    let imagenBuffer = null;
    let tipoImagen = null;
    let nombreImagen = null;

    if (req.body.imagen) {
      const matches = req.body.imagen.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        tipoImagen = matches[1];
        if (!tipoImagen.startsWith('image/')) {
          return res.status(400).json({ msg: 'Solo se permiten archivos de imagen.' });
        }
        imagenBuffer = Buffer.from(matches[2], 'base64');
        if (imagenBuffer.length > 10 * 1024 * 1024) {
          return res.status(400).json({ msg: 'La imagen excede el tamaño máximo de 10MB.' });
        }
        nombreImagen = sanitizar(req.body.nombreImagen || 'imagen.jpg');
      }
    }

    const [result] = await db.query(
      `INSERT INTO publicaciones (titulo, contenido, fecha, imagen, tipo_imagen, nombre_imagen)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [titulo, contenido, fecha || new Date(), imagenBuffer, tipoImagen, nombreImagen]
    );

    logger.info('Publicación creada', { id: result.insertId, titulo });
    res.status(201).json({ msg: 'Publicación creada correctamente.', id: result.insertId });
  } catch (error) {
    logger.error('Error en createPublicacion', { error: error.message });
    res.status(500).json({ msg: 'Error al crear publicación.' });
  }
};

export const updatePublicacion = async (req, res) => {
  try {
    const { id } = req.params;
    const titulo = sanitizar(req.body.titulo || '');
    const contenido = req.body.contenido || '';
    const fecha = req.body.fecha;

    let imagenBuffer = null;
    if (req.body.imagen) {
      const matches = req.body.imagen.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        imagenBuffer = Buffer.from(matches[2], 'base64');
        const tipoImagen = matches[1];
        const nombreImagen = sanitizar(req.body.nombreImagen || 'imagen.jpg');
        await db.query(
          'UPDATE publicaciones SET tipo_imagen = ?, nombre_imagen = ? WHERE id = ?',
          [tipoImagen, nombreImagen, parseInt(id)]
        );
      }
    }

    await db.query(
      'CALL sp_actualizar_publicacion(?, ?, ?, ?, ?, @resultado)',
      [parseInt(id), titulo, contenido, fecha || new Date(), imagenBuffer]
    );

    const [result] = await db.query('SELECT @resultado AS resultado');
    logger.info('Publicación actualizada', { id });
    res.json({ msg: result[0].resultado });
  } catch (error) {
    logger.error('Error en updatePublicacion', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar publicación.' });
  }
};

export const deletePublicacion = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [pub] = await db.query('SELECT titulo FROM publicaciones WHERE id = ?', [parseInt(id)]);
    if (pub.length === 0) {
      return res.status(404).json({ msg: 'Publicación no encontrada.' });
    }

    // El trigger trg_auditoria_baja_publicacion se encarga de la auditoría
    await db.query('DELETE FROM publicaciones WHERE id = ?', [parseInt(id)]);
    
    logger.info('Publicación eliminada', { id, titulo: pub[0].titulo });
    res.json({ msg: 'Publicación eliminada correctamente.' });
  } catch (error) {
    logger.error('Error en deletePublicacion', { error: error.message });
    res.status(500).json({ msg: 'Error al eliminar publicación.' });
  }
};
