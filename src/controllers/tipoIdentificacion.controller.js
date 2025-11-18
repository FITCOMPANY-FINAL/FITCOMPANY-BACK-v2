// src/controllers/tipoIdentificacion.controller.js
import db from "../config/db.js";

const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";
const MAX_LEN = 100;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Busca coincidencia canónica (ignora acentos, mayúsculas y TODOS los espacios).
 *  Retorna objeto con {id} o null. Permite excluir un ID (para edición).
 */
async function encontrarCanonica(nombre, excludeId = null) {
  const query = db("tipos_identificacion").whereRaw(
    "LOWER(REPLACE(nombre_tipo_identificacion, ' ', '')) = LOWER(REPLACE(?, ' ', ''))",
    [nombre],
  );

  if (excludeId !== null) {
    query.whereNot("id_tipo_identificacion", excludeId);
  }

  const result = await query.first();
  return result ? { id: result.id_tipo_identificacion } : null;
}

/** Conteo de uso en USUARIOS y en VENTAS */
async function obtenerUso(tipoId) {
  // Contar en tabla usuarios
  const usuarios = await db("usuarios")
    .where("id_tipo_identificacion", tipoId)
    .count("* as count")
    .first();

  const usuariosCount = parseInt(usuarios?.count || 0);

  // Contar en tabla ventas (si existe la columna)
  // Nota: Verificar si la tabla ventas tiene relación con tipo de identificación
  let ventasCount = 0;
  try {
    const ventas = await db("ventas")
      .where("id_tipo_identificacion", tipoId)
      .count("* as count")
      .first();
    ventasCount = parseInt(ventas?.count || 0);
  } catch (error) {
    // Si la columna no existe, ventasCount queda en 0
    ventasCount = 0;
  }

  return {
    usuarios: usuariosCount,
    ventas: ventasCount,
    total: usuariosCount + ventasCount,
  };
}

// ---------- Endpoints ----------
export const listarTiposIdentificacion = async (req, res) => {
  try {
    const tipos = await db("tipos_identificacion")
      .select(
        "id_tipo_identificacion as id",
        "nombre_tipo_identificacion as nombre",
        "abreviatura_tipo_identificacion as abreviatura",
        "descripcion_tipo_identificacion as descripcion",
      )
      .orderBy("nombre_tipo_identificacion");

    res.json(tipos);
  } catch (error) {
    console.error("Error al listar tipos:", error);
    res.status(500).json({ message: "Error al listar tipos." });
  }
};

// Pre-chequeo para el front (existe canónicamente)
export const existeTipoIdentificacion = async (req, res) => {
  const { nombre, excludeId } = req.query;
  const base = collapseSpaces(nombre);
  if (!base) return res.json({ exists: false });

  try {
    const found = await encontrarCanonica(base, excludeId ?? null);
    res.json({
      exists: !!found,
      id: found?.id ?? null,
    });
  } catch (error) {
    console.error("Error en exists tipos:", error);
    res.json({ exists: false });
  }
};

export const crearTipoIdentificacion = async (req, res) => {
  let { nombre, abreviatura, descripcion } = req.body;
  nombre = collapseSpaces(nombre);
  abreviatura = collapseSpaces(abreviatura ?? "");
  descripcion = collapseSpaces(descripcion ?? "");

  if (!nombre)
    return res.status(400).json({ message: "El nombre es obligatorio." });
  if (nombre.length > MAX_LEN)
    return res.status(400).json({ message: `Máximo ${MAX_LEN} caracteres.` });
  if (!PATRON_PERMITIDO.test(nombre))
    return res.status(400).json({
      message: "Solo se permiten letras, espacios, guiones y puntos.",
    });

  try {
    const found = await encontrarCanonica(nombre);
    if (found) {
      return res.status(409).json({
        message: "Ya existe un tipo de identificación con ese nombre.",
      });
    }

    await db("tipos_identificacion").insert({
      nombre_tipo_identificacion: nombre,
      abreviatura_tipo_identificacion: abreviatura || null,
      descripcion_tipo_identificacion: descripcion || null,
    });

    res
      .status(201)
      .json({ message: "Tipo de identificación creado correctamente" });
  } catch (error) {
    console.error("Error al crear tipo:", error);
    res.status(500).json({ message: "Error al crear tipo." });
  }
};

export const actualizarTipoIdentificacion = async (req, res) => {
  const { id } = req.params;
  let { nombre, abreviatura, descripcion } = req.body;
  nombre = collapseSpaces(nombre);
  abreviatura = collapseSpaces(abreviatura ?? "");
  descripcion = collapseSpaces(descripcion ?? "");

  if (!nombre)
    return res.status(400).json({ message: "El nombre es obligatorio." });
  if (nombre.length > MAX_LEN)
    return res.status(400).json({ message: `Máximo ${MAX_LEN} caracteres.` });
  if (!PATRON_PERMITIDO.test(nombre))
    return res.status(400).json({
      message: "Solo se permiten letras, espacios, guiones y puntos.",
    });

  try {
    const found = await encontrarCanonica(nombre, id);
    if (found) {
      return res.status(409).json({
        message: "Ya existe un tipo de identificación con ese nombre.",
      });
    }

    const rowsAffected = await db("tipos_identificacion")
      .where("id_tipo_identificacion", id)
      .update({
        nombre_tipo_identificacion: nombre,
        abreviatura_tipo_identificacion: abreviatura || null,
        descripcion_tipo_identificacion: descripcion || null,
      });

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: "Tipo de identificación no encontrado." });
    }

    res.json({ message: "Tipo de identificación actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar tipo:", error);
    res.status(500).json({ message: "Error al actualizar tipo." });
  }
};

/** ELIMINAR:
 *  - Si NO está en uso -> borra físicamente
 *  - Si SÍ está en uso -> 409 con detalle */
export const eliminarTipoIdentificacion = async (req, res) => {
  const { id } = req.params;

  try {
    const { usuarios, ventas, total } = await obtenerUso(id);

    if (total > 0) {
      const partes = [];
      if (usuarios > 0) partes.push(`${usuarios} usuario(s)`);
      if (ventas > 0) partes.push(`${ventas} venta(s)`);
      return res.status(409).json({
        message: `Este tipo de identificación está en uso por ${partes.join(" y ")}. No se puede eliminar.`,
        requiresUpdateRecords: true,
        usuarios,
        ventas,
      });
    }

    const rowsAffected = await db("tipos_identificacion")
      .where("id_tipo_identificacion", id)
      .delete();

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: "Tipo de identificación no encontrado." });
    }

    res.json({ message: "Tipo de identificación eliminado correctamente" });
  } catch (error) {
    // PostgreSQL foreign key violation
    if (error && error.code === "23503") {
      return res.status(409).json({
        message:
          "No se puede eliminar este tipo de identificación porque está en uso.",
        requiresUpdateRecords: true,
      });
    }
    console.error("Error al eliminar tipo:", error);
    res.status(500).json({ message: "Error al eliminar tipo." });
  }
};
