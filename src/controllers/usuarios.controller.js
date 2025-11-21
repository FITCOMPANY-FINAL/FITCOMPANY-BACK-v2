import db from "../config/db.js";
import bcrypt from "bcryptjs";


/* ===========================
   Helpers y constantes
   =========================== */
const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_LEN_STR = 100;
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;
const PATRON_IDENT = /^[A-Za-z0-9.\-]+$/; // sin espacios
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/** Verifica si existe un usuario por identificación */
async function existeUsuarioPorIdent(
  ident,
  excludeTipo = null,
  excludeIdent = null,
) {
  const query = db("usuarios").where("identificacion_usuario", ident);

  // Excluir el usuario actual al editar (por PK compuesta)
  if (excludeTipo !== null && excludeIdent !== null) {
    query.whereNot(function () {
      this.where("id_tipo_identificacion", excludeTipo).where(
        "identificacion_usuario",
        excludeIdent,
      );
    });
  }

  const result = await query.first();
  return !!result;
}

/** Verifica si existe un usuario por email */
async function existeUsuarioPorEmail(
  email,
  excludeTipo = null,
  excludeIdent = null,
) {
  const query = db("usuarios").whereRaw("LOWER(email_usuario) = LOWER(?)", [
    email,
  ]);

  // Excluir el usuario actual al editar (por PK compuesta)
  if (excludeTipo !== null && excludeIdent !== null) {
    query.whereNot(function () {
      this.where("id_tipo_identificacion", excludeTipo).where(
        "identificacion_usuario",
        excludeIdent,
      );
    });
  }

  const result = await query.first();
  return !!result;
}

/** Verifica si existe el rol por ID */
async function existeRolPorId(idRol) {
  const result = await db("roles").where("id_rol", idRol).first();
  return !!result;
}

/** Verifica si existe el tipo de identificación por ID */
async function existeTipoIdentificacionPorId(idTipo) {
  const result = await db("tipos_identificacion")
    .where("id_tipo_identificacion", idTipo)
    .first();
  return !!result;
}

/* ===========================
   LISTAR
   =========================== */
export const listarUsuarios = async (_req, res) => {
  try {
    const usuarios = await db("usuarios as u")
      .join("roles as r", "u.id_rol", "r.id_rol")
      .join(
        "tipos_identificacion as t",
        "u.id_tipo_identificacion",
        "t.id_tipo_identificacion",
      )
      .select(
        "u.id_tipo_identificacion",
        "u.identificacion_usuario",
        "u.nombres_usuario",
        "u.apellido1_usuario",
        "u.apellido2_usuario",
        "u.email_usuario",
        "u.id_rol",
        "u.activo",
        "r.nombre_rol",
        "t.nombre_tipo_identificacion",
      )
      .orderBy("u.nombres_usuario");

    // Mapear a formato esperado por el frontend
    const usuariosMapeados = usuarios.map(u => ({
      tipo_identificacion: String(u.id_tipo_identificacion), // ID como string
      identificacion: u.identificacion_usuario,
      nombre: u.nombres_usuario,
      apellido1: u.apellido1_usuario,
      apellido2: u.apellido2_usuario || null,
      correo: u.email_usuario,
      id_rol: u.id_rol,
      rol_nombre: u.nombre_rol,
      activo: u.activo,
      estado: u.activo ? 'A' : 'I', // Mapear activo a estado para consistencia
    }));

    res.json(usuariosMapeados);
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    res.status(500).json({ message: "Error al listar usuarios." });
  }
};

/* ===========================
   CREAR
   =========================== */
export const crearUsuario = async (req, res) => {
  // Aceptar tanto nombres del frontend como del backend para compatibilidad
  let {
    tipo_identificacion, // Frontend usa este nombre
    id_tipo_identificacion, // Backend usa este nombre
    identificacion, // Frontend usa este nombre
    identificacion_usuario, // Backend usa este nombre
    nombre, // Frontend usa este nombre
    nombres_usuario, // Backend usa este nombre
    apellido1, // Frontend usa este nombre
    apellido1_usuario, // Backend usa este nombre
    apellido2, // Frontend usa este nombre
    apellido2_usuario, // Backend usa este nombre
    correo, // Frontend usa este nombre
    email_usuario, // Backend usa este nombre
    contrasennia, // Frontend usa este nombre
    password, // Backend usa este nombre
    id_rol, // Backend usa este nombre
  } = req.body;

  // Normalizar: usar valores del frontend si existen, sino usar del backend
  id_tipo_identificacion = tipo_identificacion || id_tipo_identificacion;
  identificacion_usuario = identificacion || identificacion_usuario;
  nombres_usuario = nombre || nombres_usuario;
  apellido1_usuario = apellido1 || apellido1_usuario;
  apellido2_usuario = apellido2 || apellido2_usuario;
  email_usuario = correo || email_usuario;
  password = contrasennia || password;

  // Normalización
  identificacion_usuario = (identificacion_usuario ?? "").trim();
  nombres_usuario = collapseSpaces(nombres_usuario ?? "");
  apellido1_usuario = collapseSpaces(apellido1_usuario ?? "");
  apellido2_usuario = collapseSpaces(apellido2_usuario ?? "");
  email_usuario = (email_usuario ?? "").trim().toLowerCase();

  // Validaciones
  if (!id_tipo_identificacion) {
    return res
      .status(400)
      .json({ message: "El tipo de identificación es obligatorio." });
  }
  if (!identificacion_usuario) {
    return res
      .status(400)
      .json({ message: "La identificación es obligatoria." });
  }
  if (!PATRON_IDENT.test(identificacion_usuario)) {
    return res.status(400).json({
      message:
        "La identificación solo admite letras, números, puntos o guiones.",
    });
  }
  if (identificacion_usuario.length > MAX_LEN_STR) {
    return res.status(400).json({
      message: `La identificación admite máximo ${MAX_LEN_STR} caracteres.`,
    });
  }

  if (!nombres_usuario || !PATRON_NOMBRE.test(nombres_usuario)) {
    return res.status(400).json({
      message:
        "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (nombres_usuario.length > MAX_LEN_STR) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_STR} caracteres.`,
    });
  }

  if (!apellido1_usuario || !PATRON_NOMBRE.test(apellido1_usuario)) {
    return res.status(400).json({
      message:
        "El apellido 1 solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (
    apellido1_usuario.length > MAX_LEN_STR ||
    (apellido2_usuario && apellido2_usuario.length > MAX_LEN_STR)
  ) {
    return res.status(400).json({
      message: `Los apellidos admiten máximo ${MAX_LEN_STR} caracteres.`,
    });
  }
  if (apellido2_usuario && !PATRON_NOMBRE.test(apellido2_usuario)) {
    return res.status(400).json({
      message:
        "El apellido 2 solo puede contener letras, espacios, guiones y puntos.",
    });
  }

  if (!email_usuario || !PATRON_EMAIL.test(email_usuario)) {
    return res.status(400).json({ message: "Formato de correo inválido." });
  }

  if (!password || String(password).length < 3) {
    return res.status(400).json({
      message: "La contraseña debe tener al menos 3 caracteres.",
    });
  }

  if (!id_rol) {
    return res.status(400).json({ message: "Debes seleccionar un rol." });
  }

  try {
    // Validar que el tipo de identificación existe
    if (!(await existeTipoIdentificacionPorId(id_tipo_identificacion))) {
      return res
        .status(400)
        .json({ message: "El tipo de identificación seleccionado no existe." });
    }

    // Validar que el rol existe
    if (!(await existeRolPorId(id_rol))) {
      return res
        .status(400)
        .json({ message: "El rol seleccionado no existe." });
    }

    // Unicidad de identificación
    if (await existeUsuarioPorIdent(identificacion_usuario)) {
      return res.status(409).json({
        code: "DUP_IDENT",
        field: "identificacion_usuario",
        message: "Ya existe un usuario con esa identificación.",
      });
    }

    // Unicidad de email
    if (await existeUsuarioPorEmail(email_usuario)) {
      return res.status(409).json({
        code: "DUP_EMAIL",
        field: "email_usuario",
        message: "Ya existe un usuario con ese correo.",
      });
    }

    // Hash de contraseña con bcrypt
    const hash_password = await bcrypt.hash(password, 10);

    // Insertar usuario
    await db("usuarios").insert({
      id_tipo_identificacion,
      identificacion_usuario,
      nombres_usuario,
      apellido1_usuario,
      apellido2_usuario: apellido2_usuario || null,
      email_usuario,
      hash_password_usuario: hash_password,
      id_rol,
      activo: true,
    });

    res.status(201).json({ message: "Usuario creado correctamente." });
  } catch (error) {
    console.error("Error al crear usuario:", error);

    // Error de constraint UNIQUE en PostgreSQL
    if (error && error.code === "23505") {
      if (error.constraint === "usuarios_email_usuario_key") {
        return res.status(409).json({
          code: "DUP_EMAIL",
          field: "email_usuario",
          message: "Ya existe un usuario con ese correo.",
        });
      }
      if (error.constraint === "usuarios_pkey") {
        return res.status(409).json({
          code: "DUP_IDENT",
          field: "identificacion_usuario",
          message: "Ya existe un usuario con esa identificación.",
        });
      }
    }

    res.status(500).json({ message: "Error al crear usuario." });
  }
};

/* ===========================
   ACTUALIZAR
   =========================== */
export const actualizarUsuario = async (req, res) => {
  // Valores ACTUALES (antes de editar) que llegan por la URL
  const { tipo: tipoActual, id: idActual } = req.params;

  // Valores NUEVOS (lo que escribió la persona en el formulario)
  // Aceptar tanto nombres del frontend como del backend para compatibilidad
  let {
    tipo_identificacion, // Frontend usa este nombre
    id_tipo_identificacion, // Backend usa este nombre
    identificacion, // Frontend usa este nombre
    identificacion_usuario, // Backend usa este nombre
    nombre, // Frontend usa este nombre
    nombres_usuario, // Backend usa este nombre
    apellido1, // Frontend usa este nombre
    apellido1_usuario, // Backend usa este nombre
    apellido2, // Frontend usa este nombre
    apellido2_usuario, // Backend usa este nombre
    correo, // Frontend usa este nombre
    email_usuario, // Backend usa este nombre
    contrasennia, // Frontend usa este nombre
    password, // Backend usa este nombre
    id_rol, // Backend usa este nombre
  } = req.body;

  // Normalizar: usar valores del frontend si existen, sino usar del backend
  id_tipo_identificacion = tipo_identificacion || id_tipo_identificacion;
  identificacion_usuario = identificacion || identificacion_usuario;
  nombres_usuario = nombre || nombres_usuario;
  apellido1_usuario = apellido1 || apellido1_usuario;
  apellido2_usuario = apellido2 || apellido2_usuario;
  email_usuario = correo || email_usuario;
  password = contrasennia || password;

  // Normalización
  identificacion_usuario = (identificacion_usuario ?? "").trim();
  nombres_usuario = collapseSpaces(nombres_usuario ?? "");
  apellido1_usuario = collapseSpaces(apellido1_usuario ?? "");
  apellido2_usuario = collapseSpaces(apellido2_usuario ?? "");
  email_usuario = (email_usuario ?? "").trim().toLowerCase();

  // Validaciones (iguales que en crear)
  if (!id_tipo_identificacion) {
    return res
      .status(400)
      .json({ message: "El tipo de identificación es obligatorio." });
  }
  if (!identificacion_usuario) {
    return res
      .status(400)
      .json({ message: "La identificación es obligatoria." });
  }
  if (!PATRON_IDENT.test(identificacion_usuario)) {
    return res.status(400).json({
      message:
        "La identificación solo admite letras, números, puntos o guiones.",
    });
  }
  if (identificacion_usuario.length > MAX_LEN_STR) {
    return res.status(400).json({
      message: `La identificación admite máximo ${MAX_LEN_STR} caracteres.`,
    });
  }

  if (!nombres_usuario || !PATRON_NOMBRE.test(nombres_usuario)) {
    return res.status(400).json({
      message:
        "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (nombres_usuario.length > MAX_LEN_STR) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_STR} caracteres.`,
    });
  }

  if (!apellido1_usuario || !PATRON_NOMBRE.test(apellido1_usuario)) {
    return res.status(400).json({
      message:
        "El apellido 1 solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (
    apellido1_usuario.length > MAX_LEN_STR ||
    (apellido2_usuario && apellido2_usuario.length > MAX_LEN_STR)
  ) {
    return res.status(400).json({
      message: `Los apellidos admiten máximo ${MAX_LEN_STR} caracteres.`,
    });
  }
  if (apellido2_usuario && !PATRON_NOMBRE.test(apellido2_usuario)) {
    return res.status(400).json({
      message:
        "El apellido 2 solo puede contener letras, espacios, guiones y puntos.",
    });
  }

  if (!email_usuario || !PATRON_EMAIL.test(email_usuario)) {
    return res.status(400).json({ message: "Formato de correo inválido." });
  }

  if (password && String(password).length > 0 && String(password).length < 3) {
    return res.status(400).json({
      message: "La contraseña debe tener al menos 3 caracteres.",
    });
  }

  if (!id_rol) {
    return res.status(400).json({ message: "Debes seleccionar un rol." });
  }

  try {
    // 1) Verificar que el usuario ACTUAL existe (por los valores de la URL)
    const existe = await db("usuarios")
      .where({
        id_tipo_identificacion: tipoActual,
        identificacion_usuario: idActual,
      })
      .first();

    if (!existe) {
      return res.status(404).json({ message: "El usuario no existe." });
    }

    // 2) Validar que el tipo de identificación existe
    if (!(await existeTipoIdentificacionPorId(id_tipo_identificacion))) {
      return res
        .status(400)
        .json({ message: "El tipo de identificación seleccionado no existe." });
    }

    // 3) Validar que el rol existe
    if (!(await existeRolPorId(id_rol))) {
      return res
        .status(400)
        .json({ message: "El rol seleccionado no existe." });
    }

    // 4) Si cambió la identificación o el tipo, validar que la NUEVA combinación no exista
    // (excluyendo al usuario actual)
    const tipoActualInt = parseInt(tipoActual);
    const idTipoNuevoInt = parseInt(id_tipo_identificacion);
    
    // Solo validar si realmente cambió la identificación o el tipo
    if (
      identificacion_usuario !== idActual ||
      idTipoNuevoInt !== tipoActualInt
    ) {
      // Verificar que la nueva identificación no exista (excluyendo el usuario actual)
      if (await existeUsuarioPorIdent(identificacion_usuario, tipoActualInt, idActual)) {
        return res.status(409).json({
          code: "DUP_IDENT",
          field: "identificacion_usuario",
          message: "Ya existe un usuario con esa identificación.",
        });
      }
    }

    // 5) Unicidad de email (excluyendo al usuario ACTUAL)
    if (await existeUsuarioPorEmail(email_usuario, tipoActual, idActual)) {
      return res.status(409).json({
        code: "DUP_EMAIL",
        field: "email_usuario",
        message: "Ya existe un usuario con ese correo.",
      });
    }

    // 6) Preparar datos a actualizar
    const datosActualizar = {
      id_tipo_identificacion,
      identificacion_usuario,
      nombres_usuario,
      apellido1_usuario,
      apellido2_usuario: apellido2_usuario || null,
      email_usuario,
      id_rol,
    };

    // 7) Si viene contraseña, hashearla y agregarla
    if (password && String(password).trim().length >= 3) {
      const hash_password = await bcrypt.hash(password, 10);
      datosActualizar.hash_password_usuario = hash_password;
    }

    // 8) UPDATE (importante: PostgreSQL no permite cambiar la PK directamente)
    // Si cambió tipo o identificación, hay que DELETE + INSERT
    const cambioEnPK =
      identificacion_usuario !== idActual ||
      id_tipo_identificacion !== parseInt(tipoActual);

    if (cambioEnPK) {
      // Usar transacción para DELETE + INSERT
      await db.transaction(async (trx) => {
        // Obtener el hash_password_usuario del usuario original antes de eliminarlo
        // (necesario si no se está cambiando la contraseña)
        const usuarioOriginal = await trx("usuarios")
          .where({
            id_tipo_identificacion: tipoActual,
            identificacion_usuario: idActual,
          })
          .select("hash_password_usuario")
          .first();

        // Si no se proporcionó nueva contraseña, usar la del usuario original
        if (!datosActualizar.hash_password_usuario && usuarioOriginal) {
          datosActualizar.hash_password_usuario = usuarioOriginal.hash_password_usuario;
        }

        // Eliminar el registro anterior
        await trx("usuarios")
          .where({
            id_tipo_identificacion: tipoActual,
            identificacion_usuario: idActual,
          })
          .delete();

        // Insertar con la nueva PK
        await trx("usuarios").insert(datosActualizar);
      });
    } else {
      // Actualización normal (sin cambio de PK)
      const rowsAffected = await db("usuarios")
        .where({
          id_tipo_identificacion: tipoActual,
          identificacion_usuario: idActual,
        })
        .update(datosActualizar);

      if (rowsAffected === 0) {
        return res.status(404).json({ message: "El usuario no existe." });
      }
    }

    res.json({ message: "Usuario actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);

    // Error de constraint UNIQUE en PostgreSQL
    if (error && error.code === "23505") {
      if (error.constraint === "usuarios_email_usuario_key") {
        return res.status(409).json({
          code: "DUP_EMAIL",
          field: "email_usuario",
          message: "Ya existe un usuario con ese correo.",
        });
      }
      if (error.constraint === "usuarios_pkey") {
        return res.status(409).json({
          code: "DUP_IDENT",
          field: "identificacion_usuario",
          message: "Ya existe un usuario con esa identificación.",
        });
      }
    }

    // Error de FK en ventas/compras
    if (error && error.code === "23503") {
      return res.status(409).json({
        code: "USER_REFERENCED",
        message:
          "No se puede cambiar la identificación porque el usuario tiene ventas o compras asociadas.",
      });
    }

    res.status(500).json({ message: "Error al actualizar usuario." });
  }
};

/* ===========================
   ELIMINAR
   =========================== */
export const eliminarUsuario = async (req, res) => {
  const { tipo, id } = req.params;

  try {
    const rowsAffected = await db("usuarios")
      .where({
        id_tipo_identificacion: tipo,
        identificacion_usuario: id,
      })
      .delete();

    if (rowsAffected === 0) {
      return res.status(404).json({ message: "El usuario no existe." });
    }

    res.json({ message: "Usuario eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);

    // Error de FK (usuario referenciado en ventas/compras)
    if (error && error.code === "23503") {
      return res.status(409).json({
        code: "USER_IN_USE",
        message:
          "No se puede eliminar el usuario porque tiene ventas o compras asociadas. " +
          "Considera desactivarlo en lugar de eliminarlo.",
        requiresDeactivation: true,
      });
    }

    res.status(500).json({ message: "Error al eliminar usuario." });
  }
};
