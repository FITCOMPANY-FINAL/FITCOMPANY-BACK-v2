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
      // Seguridad (PADRE) - orden 1
      { titulo: "Seguridad", url: null, es_padre: true, orden: 1 },
      {
        titulo: "Formularios",
        url: "/dashboard/formularios",
        es_padre: false,
        orden: 1,
        padre: "Seguridad",
      },
      {
        titulo: "Permisos",
        url: "/dashboard/permisos",
        es_padre: false,
        orden: 2,
        padre: "Seguridad",
      },

      // Inventario (PADRE) - orden 2
      { titulo: "Inventario", url: null, es_padre: true, orden: 2 },
      {
        titulo: "Categorías",
        url: "/dashboard/categorias",
        es_padre: false,
        orden: 1,
        padre: "Inventario",
      },
      {
        titulo: "Unidades de Medida",
        url: "/dashboard/unidades-medidas",
        es_padre: false,
        orden: 2,
        padre: "Inventario",
      },
      {
        titulo: "Productos",
        url: "/dashboard/productos",
        es_padre: false,
        orden: 3,
        padre: "Inventario",
      },

      // Operaciones (PADRE) - orden 3
      { titulo: "Operaciones", url: null, es_padre: true, orden: 3 },
      {
        titulo: "Compras",
        url: "/dashboard/compras",
        es_padre: false,
        orden: 1,
        padre: "Operaciones",
      },
      {
        titulo: "Ventas",
        url: "/dashboard/ventas",
        es_padre: false,
        orden: 2,
        padre: "Operaciones",
      },
      {
        titulo: "Métodos de Pago",
        url: "/dashboard/metodos-pago",
        es_padre: false,
        orden: 3,
        padre: "Operaciones",
      },

      // Reportes (PADRE) - orden 4
      { titulo: "Reportes", url: null, es_padre: true, orden: 4 },
      {
        titulo: "Reporte de Ventas",
        url: "/dashboard/reportes/ventas",
        es_padre: false,
        orden: 1,
        padre: "Reportes",
      },
      {
        titulo: "Reporte de Compras",
        url: "/dashboard/reportes/compras",
        es_padre: false,
        orden: 2,
        padre: "Reportes",
      },
      {
        titulo: "Reporte de Inventario",
        url: "/dashboard/reportes/inventario",
        es_padre: false,
        orden: 3,
        padre: "Reportes",
      },

      // Administración (PADRE) - orden 5
      { titulo: "Administración", url: null, es_padre: true, orden: 5 },
      {
        titulo: "Roles",
        url: "/dashboard/roles",
        es_padre: false,
        orden: 1,
        padre: "Administración",
      },
      {
        titulo: "Usuarios",
        url: "/dashboard/usuarios",
        es_padre: false,
        orden: 2,
        padre: "Administración",
      },
      {
        titulo: "Tipos de Identificación",
        url: "/dashboard/tipos-identificaciones",
        es_padre: false,
        orden: 3,
        padre: "Administración",
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
