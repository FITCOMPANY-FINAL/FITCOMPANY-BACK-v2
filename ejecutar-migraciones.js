// ejecutar-migraciones.js
// Script para ejecutar migraciones SQL desde la carpeta database/migrations

import 'dotenv/config';
import knex from 'knex';
import knexConfig from './knexfile.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

console.log('🚀 Ejecutando migraciones...\n');
console.log(`📊 Base de datos: ${config.connection.database || 'desde DATABASE_URL'}`);
console.log(`🔌 Host: ${config.connection.host || 'desde DATABASE_URL'}\n`);

// Crear instancia de Knex
const db = knex(config);

try {
  // Leer archivos de migración
  const migrationsDir = join(__dirname, 'database', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📁 Encontradas ${files.length} migraciones:\n`);

  // Ejecutar cada migración
  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf8');

    console.log(`⏳ Ejecutando: ${file}`);
    try {
      await db.raw(sql);
      console.log(`✅ ${file} - OK\n`);
    } catch (error) {
      console.error(`❌ ${file} - ERROR`);
      console.error(`   ${error.message}\n`);
      // No salir, continuar con las siguientes migraciones
    }
  }

  console.log('✅ ¡Migraciones completadas!');

} catch (error) {
  console.error('❌ Error ejecutando migraciones:');
  console.error(error.message);
  process.exit(1);
} finally {
  await db.destroy();
}
