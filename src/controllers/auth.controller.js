import db from "../config/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

export const login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    // Limpiar y normalizar el correo para evitar errores de espacios o mayúsculas
    const correoLimpio = correo.trim().toLowerCase();

    console.log("🔐 Intento de login para:", correoLimpio);

    // Buscar el usuario en la base de datos con JOIN a roles y tipos_identificacion
    const usuario = await db("usuarios as u")
      .join("roles as r", "u.id_rol", "r.id_rol")
      .join(
        "tipos_identificacion as ti",
        "u.id_tipo_identificacion",
        "ti.id_tipo_identificacion",
      )
      .select(
        "u.id_tipo_identificacion",
        "u.identificacion_usuario",
        "u.nombres_usuario",
        "u.apellido1_usuario",
        "u.apellido2_usuario",
        "u.email_usuario",
        "u.hash_password_usuario",
        "u.id_rol",
        "r.nombre_rol",
        "ti.nombre_tipo_identificacion",
      )
      .where(db.raw("LOWER(u.email_usuario)"), correoLimpio)
      .where("u.activo", true) // Solo usuarios activos
      .first();

    // Si no se encuentra el usuario
    if (!usuario) {
      console.log("❌ No se encontró usuario activo con ese correo");
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos." });
    }

    // Validar la contraseña con bcrypt
    const passwordValido = await bcrypt.compare(
      password,
      usuario.hash_password_usuario,
    );

    if (!passwordValido) {
      console.log("❌ Contraseña incorrecta");
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos." });
    }

    console.log("✅ Credenciales válidas para:", usuario.email_usuario);

    // Obtener formularios asociados al rol del usuario
    const formularios = await db("formularios as f")
      .join("roles_formularios as rf", "f.id_formulario", "rf.id_formulario")
      .select(
        "f.id_formulario",
        "f.titulo_formulario",
        "f.url_formulario",
        "f.is_padre",
        "f.orden_formulario",
        "f.padre_id",
      )
      .where("rf.id_rol", usuario.id_rol)
      .orderBy([
        { column: "f.is_padre", order: "desc" },
        { column: "f.orden_formulario", order: "asc" },
      ]);

    // Mapear formularios a estructura esperada
    // Como los permisos son simples: si existe en roles_formularios = CRUD completo
    const formulariosMapeados = formularios.map((f) => ({
      id: f.id_formulario,
      titulo: f.titulo_formulario,
      url: f.url_formulario,
      es_padre: f.is_padre,
      orden: f.orden_formulario,
      padre: f.padre_id,
      permisos: {
        crear: true,
        leer: true,
        actualizar: true,
        eliminar: true,
      },
    }));

    console.log(
      `✅ Usuario tiene acceso a ${formulariosMapeados.length} formularios`,
    );

    // Crear el token JWT
    const token = jwt.sign(
      {
        tipo_id: usuario.id_tipo_identificacion,
        identificacion: usuario.identificacion_usuario,
        nombres: usuario.nombres_usuario,
        apellido1: usuario.apellido1_usuario,
        apellido2: usuario.apellido2_usuario || "",
        email: usuario.email_usuario,
        id_rol: usuario.id_rol,
        nombre_rol: usuario.nombre_rol,
        tipo_identificacion: usuario.nombre_tipo_identificacion,
        formularios: formulariosMapeados,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    console.log("✅ Token JWT generado exitosamente");

    // Devolver token + datos del usuario
    res.json({
      token,
      usuario: {
        tipo_id: usuario.id_tipo_identificacion,
        identificacion: usuario.identificacion_usuario,
        nombres: usuario.nombres_usuario,
        apellido1: usuario.apellido1_usuario,
        apellido2: usuario.apellido2_usuario || "",
        email: usuario.email_usuario,
        tipo_identificacion: usuario.nombre_tipo_identificacion,
        rol: {
          id_rol: usuario.id_rol,
          nombre_rol: usuario.nombre_rol,
        },
        formularios: formulariosMapeados,
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor al intentar iniciar sesión." });
  }
};
