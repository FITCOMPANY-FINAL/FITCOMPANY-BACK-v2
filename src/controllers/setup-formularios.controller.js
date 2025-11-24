// src/controllers/setup-formularios.controller.js
// Controlador para crear formularios base

import db from "../config/db.js";

export const setupFormularios = async (req, res) => {
  try {
    console.log("📋 Creando formularios base...");

    const formularios = [
      // Dashboard (sin padre)
      { titulo: "Dashboard", url: "/dashboard", es_padre: false, orden: 1 },

      // Operaciones
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

      // Inventario
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

      // Administración
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
      {
        titulo: "Permisos",
        url: "/permisos",
        es_padre: false,
        orden: 15,
        padre: "Administración",
      },

      // Seguridad
      { titulo: "Seguridad", url: "/seguridad", es_padre: true, orden: 16 },
      {
        titulo: "Gestión de Usuarios",
        url: "/seguridad/usuarios",
        es_padre: false,
        orden: 17,
        padre: "Seguridad",
      },

      // Reportes
      { titulo: "Reportes", url: "/reportes", es_padre: true, orden: 18 },
      {
        titulo: "Reporte de Ventas",
        url: "/reportes/ventas",
        es_padre: false,
        orden: 19,
        padre: "Reportes",
      },
      {
        titulo: "Reporte de Compras",
        url: "/reportes/compras",
        es_padre: false,
        orden: 20,
        padre: "Reportes",
      },
      {
        titulo: "Reporte de Inventario",
        url: "/reportes/inventario",
        es_padre: false,
        orden: 21,
        padre: "Reportes",
      },
    ];

    let creados = 0;
    const formulariosMap = {}; // Para guardar IDs de padres

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
        const [id] = await db("formularios")
          .insert({
            titulo_formulario: form.titulo,
            url_formulario: form.url,
            padre_id: padreId,
            is_padre: form.es_padre,
            orden_formulario: form.orden,
          })
          .returning("id_formulario");

        formulariosMap[form.titulo] = id;
        console.log(
          `✅ ${form.titulo}${padreId ? ` (hijo de ${form.padre})` : ""}`,
        );
        creados++;
      } catch (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          console.log(`⚠️ ${form.titulo} ya existe`);
        } else {
          throw error;
        }
      }
    }

    console.log(
      `\n✅ ${creados} formularios creados con estructura jerárquica`,
    );

    res.json({
      success: true,
      message: "✅ Formularios creados exitosamente",
      formulariosCreados: creados,
      formularios: formularios.map((f) => f.titulo),
    });
  } catch (error) {
    console.error("❌ Error creando formularios:", error.message);
    res.status(500).json({
      success: false,
      message: "Error creando formularios",
      error: error.message,
    });
  }
};
