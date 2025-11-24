// src/controllers/setup-migrate-ventas.controller.js
// Controlador para migrar la tabla ventas y agregar columnas de soft delete

import db from "../config/db.js";

export const migrateVentasTable = async (req, res) => {
  try {
    console.log("🔄 Iniciando migración de tabla ventas...");

    // 1. Verificar si las columnas ya existen
    console.log("📋 Verificando columnas existentes...");

    const columnasExistentes = await db.raw(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ventas'
    `);

    const columnNames = columnasExistentes.rows.map(row => row.column_name);
    console.log("Columnas actuales:", columnNames);

    const columnasAgregar = [
      { nombre: 'activo', tipo: 'BOOLEAN DEFAULT TRUE' },
      { nombre: 'eliminado_en', tipo: 'TIMESTAMP' },
      { nombre: 'eliminado_por', tipo: 'VARCHAR(100)' },
      { nombre: 'motivo_eliminacion', tipo: 'TEXT' }
    ];

    // 2. Agregar columnas que falten
    console.log("\n➕ Agregando columnas faltantes...");

    for (const columna of columnasAgregar) {
      if (!columnNames.includes(columna.nombre)) {
        console.log(`   Agregando columna: ${columna.nombre}`);
        await db.raw(`ALTER TABLE ventas ADD COLUMN ${columna.nombre} ${columna.tipo}`);
        console.log(`   ✅ ${columna.nombre} agregada`);
      } else {
        console.log(`   ⓘ ${columna.nombre} ya existe`);
      }
    }

    console.log("\n✅ Migración completada exitosamente");

    res.json({
      success: true,
      message: "✅ Tabla ventas migrada correctamente",
      columnasAgregadas: columnasAgregar.map(c => c.nombre),
    });
  } catch (error) {
    console.error("❌ Error en migración:", error.message);
    res.status(500).json({
      success: false,
      message: "Error en migración de tabla ventas",
      error: error.message,
    });
  }
};
