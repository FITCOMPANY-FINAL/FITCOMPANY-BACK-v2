// ejecutar-schema.js
// Script simple para ejecutar schema-initial.sql

import 'dotenv/config';
import knex from 'knex';
import knexConfig from './knexfile.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

console.log('🚀 Ejecutando schema-initial.sql...\n');
console.log(`📊 Base de datos: ${config.connection.database || 'desde DATABASE_URL'}`);
console.log(`🔌 Host: ${config.connection.host || 'desde DATABASE_URL'}\n`);

// Crear instancia de Knex
const db = knex(config);

// Leer el archivo SQL
const schemaPath = join(__dirname, 'database', 'schema-initial.sql');
console.log(`📄 Leyendo: ${schemaPath}\n`);

try {
  const sql = readFileSync(schemaPath, 'utf8');
  
  // Ejecutar el SQL completo
  console.log('⏳ Ejecutando comandos SQL...\n');
  await db.raw(sql);
  
  console.log('✅ ¡Schema ejecutado correctamente!');
  console.log('📊 Base de datos lista para usar.\n');
  
} catch (error) {
  console.error('❌ Error ejecutando schema:');
  console.error(error.message);
  if (error.message.includes('does not exist')) {
    console.error('\n💡 Sugerencia: Asegúrate de que la base de datos "gimnasio_db" exista.');
    console.error('   Ejecuta: CREATE DATABASE gimnasio_db;');
  }
  process.exit(1);
} finally {
  await db.destroy();
}






