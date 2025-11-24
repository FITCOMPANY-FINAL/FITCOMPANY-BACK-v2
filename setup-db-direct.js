// setup-db-direct.js
// Script para inicializar BD usando postgres driver directamente (sin Knex pool)

import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL ||
  'postgresql://gimnasio_db_ghso_user:QdAVcykIr0WY4aN24jJ4cb3hw4JhspLo@dpg-d4hsm13uibrs73dqnqi0-a.onrender.com:5432/gimnasio_db_ghso';

console.log('🚀 Inicializando base de datos...\n');
console.log('🔌 Conectando a PostgreSQL...');

const client = new Client({
  connectionString: connectionString,
  connectionTimeoutMillis: 30000,
  statement_timeout: 120000,
  ssl: { rejectUnauthorized: false } // Necesario para conexiones SSL a Render
});

try {
  await client.connect();
  console.log('✅ Conectado a PostgreSQL\n');

  // Leer el schema
  const schemaPath = join(__dirname, 'database', 'schema-initial.sql');
  console.log(`📄 Leyendo: ${schemaPath}`);

  const sql = readFileSync(schemaPath, 'utf8');

  // Ejecutar el SQL completo
  console.log('⏳ Ejecutando schema (esto puede tardar unos minutos)...\n');

  await client.query(sql);

  console.log('\n✅ ¡Schema ejecutado correctamente!');
  console.log('📊 Base de datos inicializada.\n');

} catch (error) {
  console.error('❌ Error:');
  console.error(error.message);
  process.exit(1);
} finally {
  await client.end();
}
