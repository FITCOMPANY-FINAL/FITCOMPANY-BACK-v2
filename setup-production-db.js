// setup-production-db.js
// Script para inicializar la base de datos de producción en Render
// Ejecuta el schema completo en la BD remota

import 'dotenv/config';
import knex from 'knex';
import knexConfig from './knexfile.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Forzar ambiente de producción
const environment = 'production';
const config = knexConfig[environment];

console.log('🚀 Inicializando base de datos de PRODUCCIÓN en Render...\n');
console.log(`📊 Usando DATABASE_URL desde variables de entorno`);
console.log(`🔌 Conectando...\n`);

// Crear instancia de Knex
const db = knex(config);

try {
  // Leer el archivo del schema
  const schemaPath = join(__dirname, 'database', 'schema-initial.sql');
  console.log(`📄 Leyendo schema desde: ${schemaPath}\n`);

  const sql = readFileSync(schemaPath, 'utf8');

  // Ejecutar el SQL completo
  console.log('⏳ Ejecutando schema...\n');
  await db.raw(sql);

  console.log('\n✅ ¡Schema ejecutado correctamente en Render!');
  console.log('📊 Base de datos de producción lista para usar.\n');

} catch (error) {
  console.error('❌ Error ejecutando schema:');
  console.error(error.message);
  process.exit(1);
} finally {
  await db.destroy();
}
