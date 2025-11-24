// src/controllers/setup-clean.controller.js
// Controlador para limpiar y recrear todo correctamente

import db from "../config/db.js";
import bcrypt from "bcryptjs";

export const cleanAndSetup = async (req, res) => {
  try {
    console.log("🗑️  Limpiando base de datos...");

    // 1. LIMPIAR: Borrar todos los formularios y sus relaciones
    await db("roles_formularios").del();
    console.log("✅ Permisos eliminados");

    await db("formularios").del();
    console.log("✅ Formularios eliminados");

    // 2. RECREAR FORMULARIOS CON ESTRUCTURA CORRECTA
    console.log("\n📋 Creando formularios con estructura jerárquica...");

    const formularios = [
      // Dashboard (sin padre)
      { titulo: "Dashboard", url: "/dashboard", es_padre: false, orden: 1 },

      // Operaciones (PADRE)
      { titulo: "Operaciones", url: "/operaciones", es_padre: true, orden: 2 },
      {
        titulo: "Ventas",
        url: "/ventas",
        es_padre: false,
        orden: 3,
        padre: "Operaciones",
      },
      {
        titulo: "Compras",
        url: "/compras",
        es_padre: false,
        orden: 4,
        padre: "Operaciones",
      },
      {
        titulo: "Métodos de Pago",
        url: "/metodos-pago",
        es_padre: false,
        orden: 5,
        padre: "Operaciones",
      },

      // Inventario (PADRE)
      { titulo: "Inventario", url: "/inventario", es_padre: true, orden: 6 },
      {
        titulo: "Categorías",
        url: "/categorias",
        es_padre: false,
        orden: 7,
        padre: "Inventario",
      },
      {
        titulo: "Productos",
        url: "/productos",
        es_padre: false,
        orden: 8,
        padre: "Inventario",
      },
      {
        titulo: "Unidades de Medida",
        url: "/unidades-medidas",
        es_padre: false,
        orden: 9,
        padre: "Inventario",
      },

      // Administración (PADRE)
      {
        titulo: "Administración",
        url: "/administracion",
        es_padre: true,
        orden: 10,
      },
      {
        titulo: "Tipos de Identificación",
        url: "/tipos-identificacion",
        es_padre: false,
        orden: 11,
        padre: "Administración",
      },
      {
        titulo: "Roles",
        url: "/roles",
        es_padre: false,
        orden: 12,
        padre: "Administración",
      },
      {
        titulo: "Usuarios",
        url: "/usuarios",
        es_padre: false,
        orden: 13,
        padre: "Administración",
      },
      {
        titulo: "Formularios",
        url: "/formularios",
        es_padre: false,
        orden: 14,
        padre: "Administración",
      },

      // Seguridad (PADRE)
      { titulo: "Seguridad", url: "/seguridad", es_padre: true, orden: 15 },
      {
        titulo: "Permisos",
        url: "/permisos",
        es_padre: false,
        orden: 16,
        padre: "Seguridad",
      },

      // Reportes (PADRE)
      { titulo: "Reportes", url: "/reportes", es_padre: true, orden: 17 },
      {
        titulo: "Reporte de Ventas",
        url: "/reportes/ventas",
        es_padre: false,
        orden: 18,
        padre: "Reportes",
      },
      {
        titulo: "Reporte de Compras",
        url: "/reportes/compras",
        es_padre: false,
        orden: 19,
        padre: "Reportes",
      },
      {
        titulo: "Reporte de Inventario",
        url: "/reportes/inventario",
        es_padre: false,
        orden: 20,
        padre: "Reportes",
      },
    ];

    let creados = 0;
    const formulariosMap = {};

    for (const form of formularios) {
      try {
        // Si tiene padre, obtener el ID del padre
        let padreId = null;
        if (form.padre) {
          const formularioPadre = await db("formularios")
            .where("titulo_formulario", form.padre)
            .first();
          if (formularioPadre) {
            padreId = formularioPadre.id_formulario;
          }
        }

        // Insertar el formulario
        const result = await db("formularios")
          .insert({
            titulo_formulario: form.titulo,
            url_formulario: form.url,
            padre_id: padreId,
            is_padre: form.es_padre,
            orden_formulario: form.orden,
          })
          .returning("id_formulario");

        const id = result[0];
        formulariosMap[form.titulo] = id;
        console.log(
          `✅ ${form.titulo}${padreId ? ` (hijo de ${form.padre})` : " (PADRE)"}`,
        );
        creados++;
      } catch (error) {
        console.error(`❌ Error creando ${form.titulo}:`, error.message);
      }
    }

    console.log(`\n✅ ${creados} formularios creados`);

    // 3. ASIGNAR PERMISOS AL ADMIN (ROL 1)
    console.log("\n🔐 Asignando permisos al Admin...");

    // Verificar si el rol Admin (id 1) existe
    const adminRole = await db("roles").where("id_rol", 1).first();
    let permisosAsignados = 0;

    if (adminRole) {
      const todosLosFormularios =
        await db("formularios").select("id_formulario");

      for (const form of todosLosFormularios) {
        try {
          await db("roles_formularios").insert({
            id_rol: 1, // Admin
            id_formulario: form.id_formulario,
          });
          permisosAsignados++;
        } catch (error) {
          if (error.code !== "23505") {
            console.error("Error asignando permiso:", error.message);
          }
        }
      }

      console.log(`✅ ${permisosAsignados} permisos asignados al Admin`);
    } else {
      console.log(
        "⚠️  Rol Admin no encontrado. Los permisos se asignarán cuando exista el rol.",
      );
    }

    res.json({
      success: true,
      message: "✅ Base de datos limpiada y recreada correctamente",
      formularios: {
        creados: creados,
        estructura: "Jerárquica con padres e hijos",
      },
      permisos: {
        admin: permisosAsignados,
      },
    });
  } catch (error) {
    console.error("❌ Error en cleanup:", error.message);
    res.status(500).json({
      success: false,
      message: "Error en cleanup",
      error: error.message,
    });
  }
};
