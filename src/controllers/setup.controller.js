// src/controllers/setup.controller.js
// Controlador para setup inicial de datos

import db from "../config/db.js";
import bcrypt from "bcryptjs";

export const setupDatabase = async (req, res) => {
  try {
    console.log("🌱 Iniciando setup de datos...");

    // 1. INSERTAR TIPO DE IDENTIFICACIÓN
    console.log("📝 Paso 1: Insertando Tipo de Identificación...");
    try {
      await db("tipos_identificacion").insert({
        nombre_tipo_identificacion: "Cédula de Ciudadanía",
        abreviatura_tipo_identificacion: "CC",
        descripcion_tipo_identificacion: "Documento de identificación colombiano",
        activo: true,
      });
      console.log("✅ CC creado");
    } catch (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        console.log("⚠️ CC ya existe");
      } else {
        throw error;
      }
    }

    // 2. INSERTAR ROLES
    console.log("📝 Paso 2: Insertando Roles...");

    try {
      await db("roles").insert({
        nombre_rol: "Administrador",
        descripcion_rol: "Acceso total a todas las funciones",
        activo: true,
      });
      console.log("✅ Rol Administrador creado");
    } catch (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        console.log("⚠️ Rol Administrador ya existe");
      } else {
        throw error;
      }
    }

    try {
      await db("roles").insert({
        nombre_rol: "Vendedor",
        descripcion_rol: "Acceso a ventas y productos",
        activo: true,
      });
      console.log("✅ Rol Vendedor creado");
    } catch (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        console.log("⚠️ Rol Vendedor ya existe");
      } else {
        throw error;
      }
    }

    // 3. INSERTAR USUARIOS
    console.log("📝 Paso 3: Insertando Usuarios...");

    // Usuario ADMIN
    try {
      const hashAdmin = bcrypt.hashSync("admin123", 10);
      await db("usuarios").insert({
        id_tipo_identificacion: 1,
        identificacion_usuario: "1234567890",
        nombres_usuario: "Deisy",
        apellido1_usuario: "Fonegra",
        apellido2_usuario: null,
        email_usuario: "fitcompany@gmail.com",
        hash_password_usuario: hashAdmin,
        id_rol: 1,
        activo: true,
      });
      console.log("✅ Usuario ADMIN creado");
    } catch (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        console.log("⚠️ Usuario ADMIN ya existe");
      } else {
        throw error;
      }
    }

    // Usuario VENDEDOR
    try {
      const hashVendedor = bcrypt.hashSync("123", 10);
      await db("usuarios").insert({
        id_tipo_identificacion: 1,
        identificacion_usuario: "0987654321",
        nombres_usuario: "Luisa",
        apellido1_usuario: "Muñoz",
        apellido2_usuario: null,
        email_usuario: "vendedor@gmail.com",
        hash_password_usuario: hashVendedor,
        id_rol: 2,
        activo: true,
      });
      console.log("✅ Usuario VENDEDOR creado");
    } catch (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        console.log("⚠️ Usuario VENDEDOR ya existe");
      } else {
        throw error;
      }
    }

    console.log("✅ Setup completado");

    res.json({
      success: true,
      message: "✅ Datos iniciales creados exitosamente",
      usuarios: [
        {
          email: "fitcompany@gmail.com",
          password: "admin123",
          rol: "Administrador",
        },
        {
          email: "vendedor@gmail.com",
          password: "123",
          rol: "Vendedor",
        },
      ],
    });
  } catch (error) {
    console.error("❌ Error en setup:", error.message);
    res.status(500).json({
      success: false,
      message: "Error en setup",
      error: error.message,
    });
  }
};
