import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

// Empleado: Enviar justificación de tardanza
export const enviarJustificacion = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    if (!numTrabajador) {
      return res.status(400).json({ msg: 'No se pudo identificar al empleado.' });
    }

    const { fechaTardanza, motivo, pdfBase64 } = req.body;

    if (!fechaTardanza || !motivo) {
      return res.status(400).json({ msg: 'La fecha de tardanza y el motivo son obligatorios.' });
    }

    if (motivo.length > 2000) {
      return res.status(400).json({ msg: 'El motivo no puede exceder 2000 caracteres.' });
    }

    let pdfBuffer = null;
    let nombreArchivo = null;
    let tipoArchivo = null;

    if (pdfBase64) {
      const matches = pdfBase64.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ msg: 'Formato de archivo inválido.' });
      }
      tipoArchivo = matches[1];
      if (!tipoArchivo.includes('pdf')) {
        return res.status(400).json({ msg: 'Solo se permiten archivos PDF.' });
      }
      pdfBuffer = Buffer.from(matches[2], 'base64');
      if (pdfBuffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ msg: 'El archivo excede el tamaño máximo de 10MB.' });
      }
      nombreArchivo = `justificacion_${numTrabajador}_${fechaTardanza}.pdf`;
    }

    // Verificar que no exista ya una justificación para esa fecha
    const [existe] = await db.query(
      'SELECT COUNT(*) as c FROM justificaciones WHERE `NUM-TRABAJADOR` = ? AND fecha_tardanza = ? AND estado != ?',
      [numTrabajador, fechaTardanza, 'RECHAZADA']
    );
    if (existe[0].c > 0) {
      return res.status(400).json({ msg: 'Ya existe una justificación para esta fecha.' });
    }

    const [result] = await db.query(
      `INSERT INTO justificaciones (\`NUM-TRABAJADOR\`, fecha_tardanza, motivo, archivo_pdf, nombre_archivo, tipo_archivo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [numTrabajador, fechaTardanza, motivo, pdfBuffer, nombreArchivo, tipoArchivo]
    );

    logger.info('Justificación enviada', { numTrabajador, fechaTardanza });
    res.status(201).json({ msg: 'Justificación enviada correctamente. El administrador revisará tu solicitud.', id: result.insertId });
  } catch (error) {
    logger.error('Error en enviarJustificacion', { error: error.message });
    res.status(500).json({ msg: 'Error al enviar justificación.' });
  }
};

// Empleado: Ver mis justificaciones
export const getMisJustificaciones = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    const [rows] = await db.query(
      `SELECT id, fecha_tardanza, motivo, nombre_archivo, estado, comentario_admin, fecha_envio, fecha_resolucion
       FROM justificaciones WHERE \`NUM-TRABAJADOR\` = ? ORDER BY fecha_envio DESC`,
      [numTrabajador]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Error en getMisJustificaciones', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener justificaciones.' });
  }
};

// Admin: Ver todas las justificaciones pendientes
export const getJustificacionesPendientes = async (req, res) => {
  try {
    const estado = req.query.estado || 'PENDIENTE';
    const [rows] = await db.query(
      `SELECT j.*, CONCAT(e.NOMBRE, ' ', e.\`A-PATERNO\`, ' ', e.\`A-MATERNO\`) as nombre_empleado,
              e.DEPARTAMENTO, e.PUESTO
       FROM justificaciones j
       LEFT JOIN empleado e ON j.\`NUM-TRABAJADOR\` = e.\`NUM-TRABAJADOR\`
       WHERE j.estado = ?
       ORDER BY j.fecha_envio DESC`,
      [estado]
    );

    // No enviar el blob del PDF en el listado
    const resultado = rows.map(r => {
      const { archivo_pdf, ...rest } = r;
      return { ...rest, tieneArchivo: !!archivo_pdf };
    });

    res.json(resultado);
  } catch (error) {
    logger.error('Error en getJustificacionesPendientes', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener justificaciones.' });
  }
};

// Admin: Descargar PDF de justificación
export const descargarPdfJustificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT archivo_pdf, tipo_archivo, nombre_archivo FROM justificaciones WHERE id = ?',
      [parseInt(id)]
    );
    if (rows.length === 0 || !rows[0].archivo_pdf) {
      return res.status(404).json({ msg: 'Archivo no encontrado.' });
    }
    res.set('Content-Type', rows[0].tipo_archivo || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${rows[0].nombre_archivo || 'justificacion.pdf'}"`);
    res.send(rows[0].archivo_pdf);
  } catch (error) {
    logger.error('Error en descargarPdfJustificacion', { error: error.message });
    res.status(500).json({ msg: 'Error al descargar archivo.' });
  }
};

// Admin: Aprobar o rechazar justificación
export const resolverJustificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, comentario } = req.body;

    if (!estado || !['APROBADA', 'RECHAZADA'].includes(estado)) {
      return res.status(400).json({ msg: 'Estado debe ser APROBADA o RECHAZADA.' });
    }

    const [just] = await db.query('SELECT * FROM justificaciones WHERE id = ?', [parseInt(id)]);
    if (just.length === 0) {
      return res.status(404).json({ msg: 'Justificación no encontrada.' });
    }
    if (just[0].estado !== 'PENDIENTE') {
      return res.status(400).json({ msg: 'Esta justificación ya fue resuelta.' });
    }

    await db.query(
      `UPDATE justificaciones SET estado = ?, comentario_admin = ?, fecha_resolucion = NOW() WHERE id = ?`,
      [estado, sanitizar(comentario || ''), parseInt(id)]
    );

    // El trigger trg_justificacion_resuelta creará la notificación automáticamente

    // Si se aprueba, actualizar el estado de ese día a PUNTUAL
    if (estado === 'APROBADA') {
      await db.query(
        `UPDATE estado SET ESTATUS = 'JUSTIFICADO' WHERE \`NUM-TRABAJADOR\` = ? AND FECHA = ?`,
        [just[0]['NUM-TRABAJADOR'], just[0].fecha_tardanza]
      ).catch(() => {});
    }

    logger.info('Justificación resuelta', { id, estado, admin: req.usuario?.usuario });
    res.json({ msg: `Justificación ${estado.toLowerCase()} correctamente.` });
  } catch (error) {
    logger.error('Error en resolverJustificacion', { error: error.message });
    res.status(500).json({ msg: 'Error al resolver justificación.' });
  }
};
