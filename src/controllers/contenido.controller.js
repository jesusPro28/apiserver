import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const getContenido = async (req, res) => {
  try {
    const seccion = sanitizar(req.query.seccion || '');
    let query = 'SELECT id, seccion, titulo, archivo, fecha FROM contenido';
    let params = [];
    if (seccion) {
      query += ' WHERE seccion = ?';
      params.push(seccion);
    }
    query += ' ORDER BY fecha DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    logger.error('Error en getContenido', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener contenido.' });
  }
};

export const getContenidoPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT archivo_pdf, tipo_pdf, titulo FROM contenido WHERE id = ?',
      [parseInt(id)]
    );
    if (rows.length === 0 || !rows[0].archivo_pdf) {
      return res.status(404).json({ msg: 'PDF no encontrado.' });
    }
    res.set('Content-Type', rows[0].tipo_pdf || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${rows[0].titulo}.pdf"`);
    res.send(rows[0].archivo_pdf);
  } catch (error) {
    logger.error('Error en getContenidoPdf', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener PDF.' });
  }
};

export const createContenido = async (req, res) => {
  try {
    const seccion = sanitizar(req.body.seccion || '');
    const titulo = sanitizar(req.body.titulo || '');
    const { pdfBase64 } = req.body;

    if (!seccion || !titulo || !pdfBase64) {
      return res.status(400).json({ msg: 'Sección, título y PDF son obligatorios.' });
    }

    const matches = pdfBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ msg: 'Formato de PDF inválido.' });
    }

    const tipoPdf = matches[1];
    if (!tipoPdf.includes('pdf')) {
      return res.status(400).json({ msg: 'Solo se permiten archivos PDF.' });
    }

    const pdfBuffer = Buffer.from(matches[2], 'base64');
    if (pdfBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ msg: 'El archivo excede el tamaño máximo de 10MB.' });
    }

    await db.query(
      `INSERT INTO contenido (seccion, titulo, archivo, archivo_pdf, tipo_pdf, fecha)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [seccion, titulo, titulo + '.pdf', pdfBuffer, tipoPdf]
    );

    logger.info('Contenido creado', { seccion, titulo });
    res.status(201).json({ msg: 'Archivo subido correctamente.' });
  } catch (error) {
    logger.error('Error en createContenido', { error: error.message });
    res.status(500).json({ msg: 'Error al subir archivo.' });
  }
};

export const updateContenido = async (req, res) => {
  try {
    const { id } = req.params;
    const seccion = sanitizar(req.body.seccion || '');
    const titulo = sanitizar(req.body.titulo || '');
    const { pdfBase64 } = req.body;

    if (pdfBase64) {
      const matches = pdfBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const tipoPdf = matches[1];
        const pdfBuffer = Buffer.from(matches[2], 'base64');
        if (pdfBuffer.length > 10 * 1024 * 1024) {
          return res.status(400).json({ msg: 'El archivo excede el tamaño máximo de 10MB.' });
        }
        await db.query(
          'UPDATE contenido SET seccion=?, titulo=?, archivo=?, archivo_pdf=?, tipo_pdf=? WHERE id=?',
          [seccion, titulo, titulo + '.pdf', pdfBuffer, tipoPdf, parseInt(id)]
        );
      }
    } else {
      await db.query(
        'UPDATE contenido SET seccion=?, titulo=? WHERE id=?',
        [seccion, titulo, parseInt(id)]
      );
    }

    logger.info('Contenido actualizado', { id });
    res.json({ msg: 'Archivo actualizado correctamente.' });
  } catch (error) {
    logger.error('Error en updateContenido', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar archivo.' });
  }
};

export const deleteContenido = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM contenido WHERE id = ?', [parseInt(id)]);
    logger.info('Contenido eliminado', { id });
    res.json({ msg: 'Archivo eliminado correctamente.' });
  } catch (error) {
    logger.error('Error en deleteContenido', { error: error.message });
    res.status(500).json({ msg: 'Error al eliminar archivo.' });
  }
};
