import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';

export const createContacto = async (req, res) => {
  try {
    const correo = sanitizar(req.body.correo || '');
    const mensaje = sanitizar(req.body.mensaje || '');

    if (!correo || !mensaje) {
      return res.status(400).json({ msg: 'Correo y mensaje son obligatorios.' });
    }

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      return res.status(400).json({ msg: 'El formato del correo no es válido.' });
    }

    if (mensaje.length > 2000) {
      return res.status(400).json({ msg: 'El mensaje no puede exceder 2000 caracteres.' });
    }

    const [result] = await db.query(
      'INSERT INTO contacto (correo, mensaje) VALUES (?, ?)',
      [correo, mensaje]
    );

    logger.info('Mensaje de contacto recibido', { correo });
    res.status(201).json({ msg: 'Mensaje enviado correctamente.', id: result.insertId });
  } catch (error) {
    logger.error('Error en createContacto', { error: error.message });
    res.status(500).json({ msg: 'Error al enviar mensaje.' });
  }
};

export const getContactos = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const offset = (page - 1) * limit;

    const [rows] = await db.query('SELECT * FROM contacto ORDER BY fecha DESC LIMIT ? OFFSET ?', [limit, offset]);
    res.json(rows);
  } catch (error) {
    logger.error('Error en getContactos', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener mensajes.' });
  }
};
