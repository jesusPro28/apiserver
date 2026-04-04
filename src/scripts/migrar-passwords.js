/**
 * Script para migrar contraseñas de texto plano a bcrypt
 * Ejecutar: node src/scripts/migrar-passwords.js
 */
import bcrypt from 'bcrypt';
import db from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function migrar() {
  try {
    console.log('🔄 Iniciando migración de contraseñas...');
    
    const [empleados] = await db.query('SELECT `NUM-TRABAJADOR`, NOMBRE, pws FROM empleado');
    let migrados = 0;
    let yaEncriptados = 0;

    for (const emp of empleados) {
      if (emp.pws.startsWith('$2b$') || emp.pws.startsWith('$2a$')) {
        yaEncriptados++;
        console.log(`  ✅ ${emp['NUM-TRABAJADOR']} (${emp.NOMBRE}) - Ya tiene hash bcrypt`);
      } else {
        const hash = await bcrypt.hash(emp.pws, 10);
        await db.query(
          'UPDATE empleado SET pws = ? WHERE `NUM-TRABAJADOR` = ?',
          [hash, emp['NUM-TRABAJADOR']]
        );
        migrados++;
        console.log(`  🔒 ${emp['NUM-TRABAJADOR']} (${emp.NOMBRE}) - Contraseña encriptada`);
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   Ya encriptadas: ${yaEncriptados}`);
    console.log(`   Migradas ahora: ${migrados}`);
    console.log(`   Total: ${empleados.length}`);
    console.log('\n✅ Migración completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrar();
