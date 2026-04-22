notificaciones import db from '../config/db.js';

import logger from '../utils/logger.js';



// Obtener notificaciones del empleado logueado

export const getMisNotificaciones = async (req, res) => {

  try {

    const numTrabajador = req.usuario.numTrabajador;

    if (!numTrabajador) {

      return res.status(400).json({ msg: 'No se pudo identificar al empleado.' });

    }



    const [rows] = await db.query(

      `SELECT * FROM notificaciones WHERE \`NUM-TRABAJADOR\` = ? ORDER BY fecha DESC LIMIT 50`,

      [numTrabajador]

    );



    const [noLeidas] = await db.query(

      `SELECT COUNT(*) as total FROM notificaciones WHERE \`NUM-TRABAJADOR\` = ? AND leida = 0`,

      [numTrabajador]

    );



    res.json({ notificaciones: rows, noLeidas: noLeidas[0].total });

  } catch (error) {

    logger.error('Error en getMisNotificaciones', { error: error.message });

    res.status(500).json({ msg: 'Error al obtener notificaciones.' });

  }

};



// Marcar notificación como leída

export const marcarLeida = async (req, res) => {

  try {

    const { id } = req.params;

    const numTrabajador = req.usuario.numTrabajador;



    await db.query(

      'UPDATE notificaciones SET leida = 1 WHERE id = ? AND `NUM-TRABAJADOR` = ?',

      [parseInt(id), numTrabajador]

    );



    res.json({ msg: 'Notificación marcada como leída.' });

  } catch (error) {

    logger.error('Error en marcarLeida', { error: error.message });

    res.status(500).json({ msg: 'Error al actualizar notificación.' });

  }

};



// Marcar todas como leídas

export const marcarTodasLeidas = async (req, res) => {

  try {

    const numTrabajador = req.usuario.numTrabajador;

    await db.query(

      'UPDATE notificaciones SET leida = 1 WHERE `NUM-TRABAJADOR` = ? AND leida = 0',

      [numTrabajador]

    );

    res.json({ msg: 'Todas las notificaciones marcadas como leídas.' });

  } catch (error) {

    logger.error('Error en marcarTodasLeidas', { error: error.message });

    res.status(500).json({ msg: 'Error al actualizar notificaciones.' });

  }

};
