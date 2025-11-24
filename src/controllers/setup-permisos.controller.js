// src/controllers/setup-permisos.controller.js
// Controlador para asignar permisos a roles

import db from "../config/db.js";

export const setupPermisos = async (req, res) => {
  try {
    console.log("🔐 Iniciando setup de permisos...");

    // Obtener todos los formularios
    const formularios = await db("formularios").select("id_formulario");
    console.log(`📋 Encontrados ${formularios.length} formularios`);

    // 1. ASIGNAR TODOS LOS FORMULARIOS AL ADMIN (ROL 1)
    console.log("\n📝 Paso 1: Asignando permisos a Administrador...");
    let adminCount = 0;
    for (const formulario of formularios) {
      try {
        await db("roles_formularios").insert({
          id_rol: 1, // Administrador
          id_formulario: formulario.id_formulario,
        });
        adminCount++;
      } catch (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          // Ya existe, continuar
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Admin: ${adminCount} permisos asignados`);

    // 2. ASIGNAR PERMISOS AL VENDEDOR (ROL 2)
    // Primero obtener los IDs de los formularios de Ventas y Compras
    console.log("\n📝 Paso 2: Asignando permisos a Vendedor...");

    const ventas = await db("formularios")
      .where("titulo_formulario", "like", "%Venta%")
      .orWhere("titulo_formulario", "like", "%venta%")
      .select("id_formulario");

    const compras = await db("formularios")
      .where("titulo_formulario", "like", "%Compra%")
      .orWhere("titulo_formulario", "like", "%compra%")
      .select("id_formulario");

    const formulariosVendedor = [...ventas, ...compras];
    console.log(`📋 Formularios para Vendedor: ${formulariosVendedor.length}`);

    let vendedorCount = 0;
    for (const formulario of formulariosVendedor) {
      try {
        await db("roles_formularios").insert({
          id_rol: 2, // Vendedor
          id_formulario: formulario.id_formulario,
        });
        vendedorCount++;
      } catch (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          // Ya existe, continuar
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Vendedor: ${vendedorCount} permisos asignados`);

    console.log("\n✅ Setup de permisos completado");

    res.json({
      success: true,
      message: "✅ Permisos asignados exitosamente",
      admin: {
        rol: "Administrador",
        permisosAsignados: adminCount,
        descripcion: "Acceso a todos los formularios",
      },
      vendedor: {
        rol: "Vendedor",
        permisosAsignados: vendedorCount,
        descripcion: "Acceso a Ventas y Compras",
      },
    });
  } catch (error) {
    console.error("❌ Error en setup de permisos:", error.message);
    res.status(500).json({
      success: false,
      message: "Error asignando permisos",
      error: error.message,
    });
  }
};
