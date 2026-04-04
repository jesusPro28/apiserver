/**
 * Validadores y sanitizadores centralizados
 */

// Patrón oficial del CURP mexicano
const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/;

/**
 * Valida el formato del CURP mexicano (18 caracteres, patrón oficial)
 */
export function validarCURP(curp) {
  if (!curp || typeof curp !== 'string') return { valido: false, error: 'El CURP es obligatorio.' };
  const c = curp.trim().toUpperCase();
  if (c.length !== 18) return { valido: false, error: 'El CURP debe tener exactamente 18 caracteres.' };
  if (!CURP_REGEX.test(c)) return { valido: false, error: 'El formato del CURP no es válido. Verifica que siga el patrón oficial mexicano.' };
  return { valido: true, curp: c };
}

/**
 * Sanitiza una cadena eliminando caracteres peligrosos
 */
export function sanitizar(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'`;]/g, '').trim();
}

/**
 * Valida que un string no esté vacío
 */
export function requerido(valor, nombre) {
  if (!valor || (typeof valor === 'string' && !valor.trim())) {
    return { valido: false, error: `El campo ${nombre} es obligatorio.` };
  }
  return { valido: true };
}

/**
 * Valida contraseña segura
 */
export function validarPassword(pw) {
  if (!pw) return { valido: false, error: 'La contraseña es obligatoria.' };
  if (pw.length < 8) return { valido: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  if (!/[A-Z]/.test(pw)) return { valido: false, error: 'La contraseña debe tener al menos una mayúscula.' };
  if (!/[0-9]/.test(pw)) return { valido: false, error: 'La contraseña debe tener al menos un número.' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return { valido: false, error: 'La contraseña debe tener al menos un carácter especial.' };
  return { valido: true };
}

/**
 * Valida tipos de archivo permitidos
 */
export function validarTipoArchivo(mimetype, permitidos = ['application/pdf']) {
  if (!permitidos.includes(mimetype)) {
    return { valido: false, error: `Tipo de archivo no permitido. Se aceptan: ${permitidos.join(', ')}` };
  }
  return { valido: true };
}

/**
 * Valida tamaño de archivo
 */
export function validarTamanoArchivo(size, maxMB = 10) {
  const maxBytes = maxMB * 1024 * 1024;
  if (size > maxBytes) {
    return { valido: false, error: `El archivo excede el tamaño máximo de ${maxMB}MB.` };
  }
  return { valido: true };
}
