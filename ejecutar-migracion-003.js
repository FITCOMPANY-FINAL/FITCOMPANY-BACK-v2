import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'gimnasio_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
});

async function migrar() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 MIGRACIÓN 003: Folio y Soft Delete en Ventas');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // 1. Verificar si ya existe la columna folio
    const existeFolio = await db.schema.hasColumn('ventas', 'folio');

    if (existeFolio) {
      console.log('⚠️  La migración ya fue aplicada anteriormente.');
      console.log('   No se realizarán cambios.');
      console.log('');
      await db.destroy();
      process.exit(0);
    }

    // 2. Agregar columnas nuevas
    console.log('📝 Paso 1: Agregando columnas nuevas a tabla ventas...');

    await db.schema.alterTable('ventas', (table) => {
      table.string('folio', 20);
      table.boolean('activo').defaultTo(true).notNullable();
      table.timestamp('eliminado_en').nullable();
      table.string('eliminado_por', 50).nullable();
      table.text('motivo_eliminacion').nullable();
    });

    console.log('   ✅ Columnas agregadas:');
    console.log('      - folio (VARCHAR 20)');
    console.log('      - activo (BOOLEAN, default TRUE)');
    console.log('      - eliminado_en (TIMESTAMP)');
    console.log('      - eliminado_por (VARCHAR 50)');
    console.log('      - motivo_eliminacion (TEXT)');
    console.log('');

    // 3. Generar folios para ventas existentes
    console.log('📝 Paso 2: Generando folios para ventas existentes...');

    const ventas = await db('ventas')
      .select('id_venta', 'fecha_venta')
      .orderBy('id_venta', 'asc');

    let contador = 0;
    for (const venta of ventas) {
      const fechaVenta = new Date(venta.fecha_venta);
      const year = fechaVenta.getFullYear();
      const folio = `VTA-${year}-${String(venta.id_venta).padStart(5, '0')}`;

      await db('ventas')
        .where('id_venta', venta.id_venta)
        .update({ folio });

      contador++;
    }

    console.log(`   ✅ ${contador} folios generados`);
    console.log('');

    // 4. Hacer folio UNIQUE
    console.log('📝 Paso 3: Creando constraint UNIQUE en folio...');

    await db.raw('ALTER TABLE ventas ADD CONSTRAINT ventas_folio_unique UNIQUE (folio)');

    console.log('   ✅ Constraint creado');
    console.log('');

    // 5. Crear índices para optimizar consultas
    console.log('📝 Paso 4: Creando índices de optimización...');

    await db.raw('CREATE INDEX idx_ventas_activo ON ventas(activo) WHERE activo = TRUE');
    await db.raw('CREATE INDEX idx_ventas_folio ON ventas(folio)');

    console.log('   ✅ Índices creados:');
    console.log('      - idx_ventas_activo (solo ventas activas)');
    console.log('      - idx_ventas_folio (búsqueda por folio)');
    console.log('');

    // 6. Resumen final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Cambios aplicados:');
    console.log(`  • ${contador} ventas ahora tienen folio único`);
    console.log('  • Soft delete habilitado (columna "activo")');
    console.log('  • Auditoría de eliminaciones configurada');
    console.log('');
    console.log('Ejemplo de folio generado:');
    if (ventas.length > 0) {
      const ultimaVenta = ventas[ventas.length - 1];
      const year = new Date(ultimaVenta.fecha_venta).getFullYear();
      const folioEjemplo = `VTA-${year}-${String(ultimaVenta.id_venta).padStart(5, '0')}`;
      console.log(`  ${folioEjemplo}`);
    }
    console.log('');

    await db.destroy();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR EN LA MIGRACIÓN');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('Detalle del error:');
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    console.error('Posibles soluciones:');
    console.error('  1. Verifica que el archivo .env tenga las credenciales correctas');
    console.error('  2. Verifica que PostgreSQL esté corriendo');
    console.error('  3. Verifica que la base de datos "gimnasio_db" exista');
    console.error('');

    await db.destroy();
    process.exit(1);
  }
}

// Ejecutar migración
migrar();
