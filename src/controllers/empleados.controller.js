import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import logger from '../utils/logger.js';
import { validarCURP, sanitizar, requerido } from '../utils/validators.js';

const SALT_ROUNDS = 12;

// ✅ Listar todos los empleados con paginación
export const getEmpleados = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = sanitizar(req.query.search || '');

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = `WHERE e.NOMBRE LIKE ? OR e.\`A-PATERNO\` LIKE ? OR e.\`NUM-TRABAJADOR\` LIKE ? OR e.CURP LIKE ?`;
      const s = `%${search}%`;
      params = [s, s, s, s];
    }

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM empleado e ${whereClause}`, params
    );

    const [rows] = await db.query(
      `SELECT e.\`ID-EMPLEADO\`, e.\`NUM-TRABAJADOR\`, e.CURP, e.NOMBRE,
              e.\`A-PATERNO\`, e.\`A-MATERNO\`, e.PUESTO, e.DEPARTAMENTO,
              h.TURNO
       FROM empleado e
       LEFT JOIN horario h ON e.\`NUM-TRABAJADOR\` = h.\`NUM-TRABAJADOR\`
       ${whereClause}
       ORDER BY e.\`ID-EMPLEADO\` DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Error en getEmpleados', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener empleados.' });
  }
};

// Obtener un empleado por número de trabajador
export const getEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador);
    const [rows] = await db.query(
      `SELECT e.*, h.TURNO, h.\`LUNES-am\`, h.\`LUNES-pm\`, 
              h.\`MARTES-am\`, h.\`MARTES-pm\`,
              h.\`MIÉRCOLES-am\`, h.\`MIÉRCOLES-pm\`,
              h.\`JUEVES-am\`, h.\`JUEVES-pm\`,
              h.\`VIERNES-am\`, h.\`VIERNES-pm\`
       FROM empleado e
       LEFT JOIN horario h ON e.\`NUM-TRABAJADOR\` = h.\`NUM-TRABAJADOR\`
       WHERE e.\`NUM-TRABAJADOR\` = ?`,
      [numTrabajador]
    );
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Empleado no encontrado.' });
    }
    const empleado = { ...rows[0] };
    delete empleado.pws;
    res.json(empleado);
  } catch (error) {
    logger.error('Error en getEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener empleado.' });
  }
};

// Obtener perfil del empleado logueado
export const getMiPerfil = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador;
    const [rows] = await db.query(
      `SELECT e.\`ID-EMPLEADO\`, e.\`NUM-TRABAJADOR\`, e.CURP, e.NOMBRE,
              e.\`A-PATERNO\`, e.\`A-MATERNO\`, e.PUESTO, e.DEPARTAMENTO, e.foto_perfil,
              h.TURNO, h.\`LUNES-am\`, h.\`LUNES-pm\`,
              h.\`MARTES-am\`, h.\`MARTES-pm\`,
              h.\`MIÉRCOLES-am\`, h.\`MIÉRCOLES-pm\`,
              h.\`JUEVES-am\`, h.\`JUEVES-pm\`,
              h.\`VIERNES-am\`, h.\`VIERNES-pm\`
       FROM empleado e
       LEFT JOIN horario h ON e.\`NUM-TRABAJADOR\` = h.\`NUM-TRABAJADOR\`
       WHERE e.\`NUM-TRABAJADOR\` = ?`,
      [numTrabajador]
    );
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Empleado no encontrado.' });
    }
    res.json(rows[0]);
  } catch (error) {
    logger.error('Error en getMiPerfil', { error: error.message });
    res.status(500).json({ msg: 'Error al obtener perfil.' });
  }
};

// ✅ Crear empleado con validación de CURP
export const createEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.body.numTrabajador || '');
    const curpRaw = (req.body.curp || '').trim().toUpperCase();
    const nombre = sanitizar(req.body.nombre || '');
    const aPaterno = sanitizar(req.body.aPaterno || '');
    const aMaterno = sanitizar(req.body.aMaterno || '');
    const puesto = sanitizar(req.body.puesto || '');
    const departamento = sanitizar(req.body.departamento || '');
    const password = req.body.password || '';

    // Validaciones
    for (const [val, nom] of [[numTrabajador, 'Número de trabajador'], [nombre, 'Nombre'], [aPaterno, 'Apellido paterno'], [aMaterno, 'Apellido materno'], [puesto, 'Puesto'], [departamento, 'Departamento']]) {
      const r = requerido(val, nom);
      if (!r.valido) return res.status(400).json({ msg: r.error });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ msg: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    // Validar CURP
    const curpResult = validarCURP(curpRaw);
    if (!curpResult.valido) {
      return res.status(400).json({ msg: curpResult.error, campo: 'curp' });
    }
    const curp = curpResult.curp;

    // Verificar duplicados
    const [existeNum] = await db.query(
      'SELECT COUNT(*) as c FROM empleado WHERE `NUM-TRABAJADOR` = ?', [numTrabajador]
    );
    if (existeNum[0].c > 0) {
      return res.status(400).json({ msg: 'Ya existe un empleado con ese número de trabajador.', campo: 'numTrabajador' });
    }

    const [existeCurp] = await db.query(
      'SELECT COUNT(*) as c FROM empleado WHERE CURP = ?', [curp]
    );
    if (existeCurp[0].c > 0) {
      return res.status(400).json({ msg: 'Ya existe un empleado con ese CURP.', campo: 'curp' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    let fotoBase64 = null;
    if (req.file) {
      // Validar tipo de imagen
      const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!tiposPermitidos.includes(req.file.mimetype)) {
        return res.status(400).json({ msg: 'Tipo de imagen no permitido. Se aceptan: JPEG, PNG, WebP, GIF.' });
      }
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ msg: 'La imagen excede el tamaño máximo de 5MB.' });
      }
      fotoBase64 = req.file.buffer.toString('base64');
    }

    const turno = sanitizar(req.body.turno || 'MATUTINO');

    await db.query(
      `INSERT INTO empleado (\`NUM-TRABAJADOR\`, CURP, NOMBRE, \`A-PATERNO\`, \`A-MATERNO\`, PUESTO, DEPARTAMENTO, pws, foto_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numTrabajador, curp, nombre, aPaterno, aMaterno, puesto, departamento, hash, fotoBase64]
    );

    await db.query(
      `INSERT INTO horario (\`NUM-TRABAJADOR\`, TURNO, \`LUNES-am\`, \`LUNES-pm\`,
        \`MARTES-am\`, \`MARTES-pm\`, \`MIÉRCOLES-am\`, \`MIÉRCOLES-pm\`,
        \`JUEVES-am\`, \`JUEVES-pm\`, \`VIERNES-am\`, \`VIERNES-pm\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numTrabajador, turno,
        req.body.lunesAm || '08:00', req.body.lunesPm || '15:00',
        req.body.martesAm || '08:00', req.body.martesPm || '15:00',
        req.body.miercolesAm || '08:00', req.body.miercolesPm || '15:00',
        req.body.juevesAm || '08:00', req.body.juevesPm || '15:00',
        req.body.viernesAm || '08:00', req.body.viernesPm || '15:00'
      ]
    );

    logger.info('Empleado creado', { numTrabajador, curp });

    await db.query(
      'INSERT INTO log_sistema (usuario, tipo_usuario, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)',
      [req.usuario?.usuario || req.usuario?.numTrabajador || 'sistema', req.usuario?.tipo || 'admin', 'CREAR_EMPLEADO', `Empleado ${numTrabajador} - ${nombre} ${aPaterno}`, req.ip]
    ).catch(() => {});

    res.status(201).json({ msg: 'Empleado registrado correctamente.' });
  } catch (error) {
    logger.error('Error en createEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al registrar empleado.' });
  }
};

// ✅ Actualizar empleado con validación de CURP
export const updateEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador);
    const curpRaw = (req.body.curp || '').trim().toUpperCase();
    const nombre = sanitizar(req.body.nombre || '');
    const aPaterno = sanitizar(req.body.aPaterno || '');
    const aMaterno = sanitizar(req.body.aMaterno || '');
    const puesto = sanitizar(req.body.puesto || '');
    const departamento = sanitizar(req.body.departamento || '');
    const password = req.body.password;

    // Validar CURP
    const curpResult = validarCURP(curpRaw);
    if (!curpResult.valido) {
      return res.status(400).json({ msg: curpResult.error, campo: 'curp' });
    }
    const curp = curpResult.curp;

    // Verificar CURP duplicado (excluyendo el empleado actual)
    const [existeCurp] = await db.query(
      'SELECT COUNT(*) as c FROM empleado WHERE CURP = ? AND `NUM-TRABAJADOR` != ?',
      [curp, numTrabajador]
    );
    if (existeCurp[0].c > 0) {
      return res.status(400).json({ msg: 'Ya existe otro empleado con ese CURP.', campo: 'curp' });
    }

    let hash = null;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ msg: 'La contraseña debe tener al menos 8 caracteres.' });
      }
      hash = await bcrypt.hash(password, SALT_ROUNDS);
    } else {
      const [current] = await db.query('SELECT pws FROM empleado WHERE `NUM-TRABAJADOR` = ?', [numTrabajador]);
      if (current.length > 0) hash = current[0].pws;
    }

    await db.query(
      `UPDATE empleado SET CURP=?, NOMBRE=?, \`A-PATERNO\`=?, \`A-MATERNO\`=?, 
       PUESTO=?, DEPARTAMENTO=?, pws=? WHERE \`NUM-TRABAJADOR\`=?`,
      [curp, nombre, aPaterno, aMaterno, puesto, departamento, hash, numTrabajador]
    );

    const turno = sanitizar(req.body.turno || 'MATUTINO');
    await db.query(
      `UPDATE horario SET TURNO=?, \`LUNES-am\`=?, \`LUNES-pm\`=?,
       \`MARTES-am\`=?, \`MARTES-pm\`=?, \`MIÉRCOLES-am\`=?, \`MIÉRCOLES-pm\`=?,
       \`JUEVES-am\`=?, \`JUEVES-pm\`=?, \`VIERNES-am\`=?, \`VIERNES-pm\`=?
       WHERE \`NUM-TRABAJADOR\`=?`,
      [
        turno,
        req.body.lunesAm || '08:00', req.body.lunesPm || '15:00',
        req.body.martesAm || '08:00', req.body.martesPm || '15:00',
        req.body.miercolesAm || '08:00', req.body.miercolesPm || '15:00',
        req.body.juevesAm || '08:00', req.body.juevesPm || '15:00',
        req.body.viernesAm || '08:00', req.body.viernesPm || '15:00',
        numTrabajador
      ]
    );

    logger.info('Empleado actualizado', { numTrabajador });
    res.json({ msg: 'Empleado actualizado correctamente.' });
  } catch (error) {
    logger.error('Error en updateEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar empleado.' });
  }
};

// ✅ Eliminar empleado
export const deleteEmpleado = async (req, res) => {
  try {
    const numTrabajador = sanitizar(req.params.numTrabajador);

    const [emp] = await db.query(
      `SELECT CONCAT(NOMBRE,' ',\`A-PATERNO\`,' ',\`A-MATERNO\`) as nombre, PUESTO, DEPARTAMENTO 
       FROM empleado WHERE \`NUM-TRABAJADOR\`=?`,
      [numTrabajador]
    );

    if (emp.length === 0) {
      return res.status(404).json({ msg: 'Empleado no encontrado.' });
    }

    // El trigger trg_auditoria_baja_empleado se encarga de la auditoría
    await db.query('DELETE FROM horario WHERE `NUM-TRABAJADOR`=?', [numTrabajador]);
    await db.query('DELETE FROM empleado WHERE `NUM-TRABAJADOR`=?', [numTrabajador]);

    logger.info('Empleado eliminado', { numTrabajador, nombre: emp[0].nombre });
    res.json({ msg: `Empleado ${emp[0].nombre} eliminado correctamente.` });
  } catch (error) {
    logger.error('Error en deleteEmpleado', { error: error.message });
    res.status(500).json({ msg: 'Error al eliminar empleado.' });
  }
};

// Actualizar foto de perfil
export const updateFoto = async (req, res) => {
  try {
    const numTrabajador = req.usuario.numTrabajador || req.params.numTrabajador;
    const { foto } = req.body;

    if (!foto) {
      return res.status(400).json({ msg: 'La foto es obligatoria.' });
    }

    await db.query(
      'UPDATE empleado SET foto_perfil = ? WHERE `NUM-TRABAJADOR` = ?',
      [foto, numTrabajador]
    );

    res.json({ msg: 'Foto de perfil actualizada.' });
  } catch (error) {
    logger.error('Error en updateFoto', { error: error.message });
    res.status(500).json({ msg: 'Error al actualizar foto.' });
  }
};

// ✅ Validar CURP (endpoint dedicado)
export const validarCurpEndpoint = async (req, res) => {
  try {
    const curpRaw = (req.query.curp || req.body.curp || '').trim().toUpperCase();
    const excluir = req.query.excluir || '';

    const curpResult = validarCURP(curpRaw);
    if (!curpResult.valido) {
      return res.json({ valido: false, error: curpResult.error });
    }

    let query = 'SELECT COUNT(*) as c FROM empleado WHERE CURP = ?';
    let params = [curpResult.curp];

    if (excluir) {
      query += ' AND `NUM-TRABAJADOR` != ?';
      params.push(excluir);
    }

    const [rows] = await db.query(query, params);
    if (rows[0].c > 0) {
      return res.json({ valido: false, error: 'Ya existe un empleado registrado con ese CURP.' });
    }

    res.json({ valido: true });
  } catch (error) {
    res.status(500).json({ valido: false, error: 'Error al validar CURP.' });
  }
};
