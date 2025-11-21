// verificar-tablas.js
// Script para verificar que las tablas se crearon correctamente

import 'dotenv/config';
import knex from 'knex';
import knexConfig from './knexfile.js';

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];
const db = knex(config);

try {
  const result = await db.raw(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('\n📊 Tablas creadas en la base de datos:\n');
  result.rows.forEach((row, index) => {
    console.log(`  ${index + 1}. ✅ ${row.table_name}`);
  });
  
  console.log(`\n✅ Total: ${result.rows.length} tablas\n`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await db.destroy();
}






