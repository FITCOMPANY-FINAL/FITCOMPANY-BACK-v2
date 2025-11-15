// database/knex.js
// Instancia de conexión a PostgreSQL usando Knex

import knex from 'knex';
import knexConfig from '../knexfile.js';

// Detectar ambiente (development, staging, production)
const environment = process.env.NODE_ENV || 'development';

console.log(`🔧 Configurando Knex para ambiente: ${environment}`);

// Seleccionar configuración según ambiente
const config = knexConfig[environment];

// Crear instancia de Knex
const db = knex(config);

// Probar conexión al iniciar
db.raw('SELECT 1+1 AS resultado')
  .then(() => {
    console.log('✅ Conexión a PostgreSQL exitosa');
    console.log(`📊 Base de datos: ${config.connection.database || 'desde DATABASE_URL'}`);
  })
  .catch((err) => {
    console.error('❌ Error conectando a PostgreSQL:');
    console.error('   Mensaje:', err.message);
    console.error('   Verifica tu archivo .env y que PostgreSQL esté corriendo');
    process.exit(1);
  });

// Exportar instancia
export default db;



