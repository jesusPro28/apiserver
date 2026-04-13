// fix-v2
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import logger from '../utils/logger.js';
import { sanitizar } from '../utils/validators.js';
import dotenv from 'dotenv';
dotenv.config();

const SALT_ROUNDS = 12;

// Login para administrador
export const loginAdmin = async (req, res) => {
  try {
    const usuario = sanitizar(req.body.usuario || '');
    const password = req.body.password || '';

    if (!usuario || !password) {
      return res.status(400).json({ msg: 'Usuario y contraseña son obligatorios.' });
    }

    const [rows] = await db.query('SELECT * FROM administrador WHERE usuario = ?', [usuario]);
    if (rows.length === 0) {
      logger.warn('Intento de login admin fallido - usuario no existe', { usuario, ip: req.ip });
      return res.status(401).json({ msg: 'Credenciales incorrectas.' });
    }

    const admin = rows[0];
    const passwordValida = await bcrypt.compare(password, admin.PASSWORD);
    if (!passwordValida) {
      logger.warn('Intento de login admin fallido - password incorrecta', { usuario, ip: req.ip });
      return res.status(401).json({ msg: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      { tipo: 'admin', usuario: admin.usuario, rol: admin.TIPO },
      process.env.JWT_SECRET,
      { expiresIn: '8h', algorithm: 'HS256' }
    );

    logger.info('Login admin exitoso', { usuario, ip: req.ip });

    // Log en BD
    await db.query(
      'INSERT INTO log_sistema (usuario, tipo_usuario, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)',
      [admin.usuario, 'admin', 'LOGIN', 'Inicio de sesión exitoso', req.ip]
    ).catch(() => {});

    res.json({
      msg: 'Login exitoso',
      token,
      usuario: {
        tipo: 'admin',
        nombre: admin.usuario,
        rol: admin.TIPO
      }
    });
  } catch (error) {
    logger.error('Error en loginAdmin', { error: error.message });
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
};

// Login para empleado
export const loginEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.body.numTrabajador || '');
    const password = req.body.password || '';

    if (!numTrabajador || !password) {
      return res.status(400).json({ msg: 'Número de trabajador y contraseña son obligatorios.' });
    }

    const [rows] = await db.query(
      'SELECT * FROM empleado WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );
    if (rows.length === 0) {
      logger.warn('Intento de login empleado fallido - no existe', { numTrabajador, ip: req.ip });
      return res.status(401).json({ msg: 'Credenciales incorrectas.' });
    }

    const empleado = rows[0];
    
    // Verificar contraseña - soporta tanto bcrypt como texto plano (migración)
    let passwordValida = false;
    if (empleado.pws && (empleado.pws.startsWith('$2b$') || empleado.pws.startsWith('$2a$'))) {
      passwordValida = await bcrypt.compare(password, empleado.pws);
    } else {
      passwordValida = (password === empleado.pws);
      // Si la contraseña es correcta y está en texto plano, migrar a bcrypt
      if (passwordValida) {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await db.query('UPDATE empleado SET pws = ? WHERE `NUM-TRABAJADOR` = ?', [hash, numTrabajador]).catch(() => {});
        logger.info('Password migrada a bcrypt', { numTrabajador });
      }
    }

    if (!passwordValida) {
      logger.warn('Intento de login empleado fallido - password incorrecta', { numTrabajador, ip: req.ip });
      return res.status(401).json({ msg: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      {
        tipo: 'empleado',
        idEmpleado: empleado['ID-EMPLEADO'],
        numTrabajador: empleado['NUM-TRABAJADOR'],
        nombre: empleado.NOMBRE,
        puesto: empleado.PUESTO,
        departamento: empleado.DEPARTAMENTO
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h', algorithm: 'HS256' }
    );

    logger.info('Login empleado exitoso', { numTrabajador, ip: req.ip });

    await db.query(
      'INSERT INTO log_sistema (usuario, tipo_usuario, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)',
      [numTrabajador, 'empleado', 'LOGIN', 'Inicio de sesión exitoso', req.ip]
    ).catch(() => {});

    res.json({
      msg: 'Login exitoso',
      token,
      usuario: {
        tipo: 'empleado',
        idEmpleado: empleado['ID-EMPLEADO'],
        numTrabajador: empleado['NUM-TRABAJADOR'],
        nombre: `${empleado.NOMBRE} ${empleado['A-PATERNO']} ${empleado['A-MATERNO']}`,
        puesto: empleado.PUESTO,
        departamento: empleado.DEPARTAMENTO,
        foto: empleado.foto_perfil
      }
    });
  } catch (error) {
    logger.error('Error en loginEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
};

// Cambiar contraseña del empleado logueado
export const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    const numTrabajador = req.usuario.numTrabajador;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ msg: 'Contraseña actual y nueva son obligatorias.' });
    }

    if (passwordNueva.length < 8) {
      return res.status(400).json({ msg: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const [rows] = await db.query(
      'SELECT pws FROM empleado WHERE `NUM-TRABAJADOR` = ?',
      [numTrabajador]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Empleado no encontrado.' });
    }

    const empleado = rows[0];
    let passwordValida = false;
    if (empleado.pws && (empleado.pws.startsWith('$2b$') || empleado.pws.startsWith('$2a$'))) {
      passwordValida = await bcrypt.compare(passwordActual, empleado.pws);
    } else {
      passwordValida = (passwordActual === empleado.pws);
    }

    if (!passwordValida) {
      return res.status(401).json({ msg: 'Contraseña actual incorrecta.' });
    }

    const hash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    await db.query(
      'UPDATE empleado SET pws = ? WHERE `NUM-TRABAJADOR` = ?',
      [hash, numTrabajador]
    );

    logger.info('Contraseña cambiada', { numTrabajador });
    res.json({ msg: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    logger.error('Error en cambiarPassword', { error: error.message });
    res.status(500).json({ msg: 'Error interno del servidor.' });
  }
};
