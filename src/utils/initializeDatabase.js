// src/utils/initializeDatabase.js
// Inicializa la base de datos si es necesario (ejecuta schema si no existen las tablas)

import db from "../config/db.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function initializeDatabase() {
  try {
    // Verificar si la tabla 'categorias' existe
    const result = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'categorias'
      );
    `);

    const tableExists = result.rows[0].exists;

    if (tableExists) {
      console.log("✅ Base de datos ya inicializada (tabla 'categorias' existe)");
      return true;
    }

    console.log(
      "⚠️ Base de datos vacía. Ejecutando schema-initial.sql...",
    );

    // Leer el schema
    const schemaPath = join(__dirname, "../../database/schema-initial.sql");
    const sql = readFileSync(schemaPath, "utf8");

    // Ejecutar el schema completo
    console.log("⏳ Inicializando tablas...");
    await db.raw(sql);

    console.log("✅ Base de datos inicializada correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error inicializando base de datos:");
    console.error(error.message);

    // No detener la aplicación, solo advertir
    console.warn("⚠️ La aplicación continuará, pero puede haber errores de BD");
    return false;
  }
}
