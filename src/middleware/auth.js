import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
dotenv.config();

/**
 * Middleware para verificar token JWT
 */
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ msg: 'Token requerido. Inicia sesión para continuar.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ msg: 'Formato de token inválido.' });
  }

  const token = parts[1];
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ msg: 'Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    req.usuario = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ msg: 'Tu sesión ha expirado. Inicia sesión de nuevo.' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn('Token JWT inválido', { ip: req.ip, error: err.message });
      return res.status(403).json({ msg: 'Token inválido.' });
    }
    return res.status(403).json({ msg: 'Error de autenticación.' });
  }
};

/**
 * Middleware para verificar roles específicos
 */
export const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ msg: 'No autenticado.' });
    
    // Administrador siempre tiene acceso
    if (req.usuario.tipo === 'admin') return next();
    
    const rolUsuario = req.usuario.rol || req.usuario.puesto;
    if (!rolesPermitidos.includes(rolUsuario)) {
      logger.warn('Acceso denegado por rol', { usuario: req.usuario.numTrabajador, rol: rolUsuario });
      return res.status(403).json({ msg: 'No tienes permisos para esta acción.' });
    }
    next();
  };
};

/**
 * Middleware para verificar que es admin
 */
export const soloAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.tipo !== 'admin') {
    return res.status(403).json({ msg: 'Acceso restringido a administradores.' });
  }
  next();
};
