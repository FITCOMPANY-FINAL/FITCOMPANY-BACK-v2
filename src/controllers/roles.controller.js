import db from "../config/db.js";

/* ===========================
   Helpers y constantes
   =========================== */

const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_LEN_NOMBRE = 50;
const MAX_LEN_DESC = 200;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Unicidad canónica por nombre (sin acentos, lower y sin espacios).
 *  excludeId (opcional) para ediciones.
 */
async function existeNombreCanonico(nombre, excludeId = null) {
  const query = db("roles").whereRaw(
    "LOWER(REPLACE(nombre_rol, ' ', '')) = LOWER(REPLACE(?, ' ', ''))",
    [nombre],
  );

  if (excludeId !== null) {
    query.whereNot("id_rol", excludeId);
  }

  const result = await query.first();
  return !!result;
}

/** Nombre canónico del rol por ID (para proteger "Administrador"). */
async function obtenerNombreCanonicoPorId(id) {
  const result = await db("roles")
    .select(db.raw("LOWER(REPLACE(nombre_rol, ' ', '')) as nombre_canon"))
    .where("id_rol", id)
    .first();

  return result ? result.nombre_canon : null;
}

/** Usuarios que usan un rol (para mensaje amigable en 409). */
async function usuariosQueUsan(rolId, limit = 25) {
  const usuarios = await db("usuarios")
    .select(
      "id_tipo_identificacion",
      "identificacion_usuario",
      "nombres_usuario as nombres",
      "apellido1_usuario as apellido",
    )
    .where("id_rol", rolId)
    .orderBy("nombres_usuario")
    .limit(limit);

  const total = await db("usuarios")
    .where("id_rol", rolId)
    .count("* as count")
    .first();

  const totalCount = parseInt(total?.count || 0);

  return {
    total: totalCount,
    usuarios,
    truncated: totalCount > limit,
  };
}

/* ===========================
   Endpoints
   =========================== */

// GET /api/roles
export const listarRoles = async (_req, res) => {
  try {
    const roles = await db("roles")
      .select("id_rol", "nombre_rol", "descripcion_rol")
      .orderBy("nombre_rol", "asc");

    res.json(roles);
  } catch (error) {
    console.error("Error al listar roles:", error);
    res.status(500).json({ message: "Error al listar roles." });
  }
};

// POST /api/roles
export const crearRol = async (req, res) => {
  let { nombre_rol, descripcion_rol } = req.body;

  nombre_rol = collapseSpaces(nombre_rol ?? "");
  descripcion_rol = collapseSpaces(descripcion_rol ?? "");

  // Validaciones
  if (!nombre_rol) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (!PATRON_PERMITIDO.test(nombre_rol)) {
    return res.status(400).json({
      message:
        "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (nombre_rol.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
    });
  }
  if (descripcion_rol && descripcion_rol.length > MAX_LEN_DESC) {
    return res.status(400).json({
      message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
    });
  }

  try {
    // Unicidad canónica
    if (await existeNombreCanonico(nombre_rol)) {
      return res.status(409).json({
        code: "DUPLICATE_NAME",
        field: "nombre_rol",
        message: "Ya existe un rol con ese nombre.",
      });
    }

    await db("roles").insert({
      nombre_rol,
      descripcion_rol: descripcion_rol || null,
    });

    res.status(201).json({ message: "Rol creado correctamente." });
  } catch (error) {
    console.error("Error al crear rol:", error);
    res.status(500).json({ message: "Error al crear rol." });
  }
};

// PUT /api/roles/:id
export const actualizarRol = async (req, res) => {
  const { id } = req.params;
  let { nombre_rol, descripcion_rol } = req.body;

  nombre_rol = collapseSpaces(nombre_rol ?? "");
  descripcion_rol = collapseSpaces(descripcion_rol ?? "");

  // Validaciones
  if (!nombre_rol) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (!PATRON_PERMITIDO.test(nombre_rol)) {
    return res.status(400).json({
      message:
        "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (nombre_rol.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
    });
  }
  if (descripcion_rol && descripcion_rol.length > MAX_LEN_DESC) {
    return res.status(400).json({
      message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
    });
  }

  try {
    // Unicidad canónica excluyendo este ID
    if (await existeNombreCanonico(nombre_rol, id)) {
      return res.status(409).json({
        code: "DUPLICATE_NAME",
        field: "nombre_rol",
        message: "Ya existe un rol con ese nombre.",
      });
    }

    const rowsAffected = await db("roles")
      .where("id_rol", id)
      .update({
        nombre_rol,
        descripcion_rol: descripcion_rol || null,
      });

    if (rowsAffected === 0) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    res.json({ message: "Rol actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar rol:", error);
    res.status(500).json({ message: "Error al actualizar rol." });
  }
};

// DELETE /api/roles/:id
export const eliminarRol = async (req, res) => {
  const { id } = req.params;

  try {
    // ¿Existe? y ¿es "Administrador"?
    const nombreCanon = await obtenerNombreCanonicoPorId(id);
    if (nombreCanon === null) {
      return res.status(404).json({ message: "El rol no existe." });
    }
    if (nombreCanon === "administrador") {
      return res.status(409).json({
        code: "ROLE_PROTECTED",
        message: "El rol 'Administrador' no se puede eliminar.",
      });
    }

    // ¿Está en uso por USUARIOS?
    const { total, usuarios, truncated } = await usuariosQueUsan(id);

    if (total > 0) {
      return res.status(409).json({
        code: "ROLE_IN_USE",
        message:
          `No se puede eliminar: hay ${total} usuario(s) con este rol. ` +
          `Debes cambiar el rol de esos usuarios antes de eliminarlo.`,
        requiresUpdateRelations: true,
        totalUsuarios: total,
        usuarios: usuarios.map((u) => `${u.nombres} ${u.apellido}`),
        truncated,
      });
    }

    // Eliminar
    const rowsAffected = await db("roles").where("id_rol", id).delete();

    if (rowsAffected === 0) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    res.json({ message: "Rol eliminado correctamente." });
  } catch (error) {
    // PostgreSQL foreign key violation
    if (error && error.code === "23503") {
      return res.status(409).json({
        code: "ROLE_IN_USE",
        message:
          "No se puede eliminar este rol porque está en uso por usuarios. " +
          "Debes reasignar esos usuarios antes de eliminarlo.",
        requiresUpdateRelations: true,
      });
    }
    console.error("Error al eliminar rol:", error);
    res.status(500).json({ message: "Error al eliminar rol." });
  }
};
