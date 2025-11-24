// src/controllers/setup-formularios.controller.js
// Controlador para crear formularios base

import db from "../config/db.js";

export const setupFormularios = async (req, res) => {
  try {
    console.log("📋 Creando formularios base...");

    const formularios = [
      { titulo: "Dashboard", url: "/dashboard", es_padre: true, orden: 1 },
      { titulo: "Categorías", url: "/categorias", es_padre: false, orden: 2 },
      { titulo: "Productos", url: "/productos", es_padre: false, orden: 3 },
      { titulo: "Unidades de Medida", url: "/unidades-medidas", es_padre: false, orden: 4 },
      { titulo: "Tipos de Identificación", url: "/tipos-identificacion", es_padre: false, orden: 5 },
      { titulo: "Roles", url: "/roles", es_padre: false, orden: 6 },
      { titulo: "Usuarios", url: "/usuarios", es_padre: false, orden: 7 },
      { titulo: "Ventas", url: "/ventas", es_padre: false, orden: 8 },
      { titulo: "Compras", url: "/compras", es_padre: false, orden: 9 },
      { titulo: "Métodos de Pago", url: "/metodos-pago", es_padre: false, orden: 10 },
      { titulo: "Reportes", url: "/reportes", es_padre: true, orden: 11 },
      { titulo: "Reporte de Ventas", url: "/reportes/ventas", es_padre: false, orden: 12 },
      { titulo: "Reporte de Compras", url: "/reportes/compras", es_padre: false, orden: 13 },
      { titulo: "Reporte de Inventario", url: "/reportes/inventario", es_padre: false, orden: 14 },
      { titulo: "Permisos", url: "/permisos", es_padre: false, orden: 15 },
      { titulo: "Formularios", url: "/formularios", es_padre: false, orden: 16 },
    ];

    let creados = 0;
    for (const form of formularios) {
      try {
        await db("formularios").insert({
          titulo_formulario: form.titulo,
          url_formulario: form.url,
          is_padre: form.es_padre,
          orden_formulario: form.orden,
        });
        console.log(`✅ ${form.titulo}`);
        creados++;
      } catch (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          console.log(`⚠️ ${form.titulo} ya existe`);
        } else {
          throw error;
        }
      }
    }

    console.log(`\n✅ ${creados} formularios creados`);

    res.json({
      success: true,
      message: "✅ Formularios creados exitosamente",
      formulariosCreados: creados,
      formularios: formularios.map(f => f.titulo),
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
