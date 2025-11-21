import db from "../config/db.js";

const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_LEN_NOMBRE = 100;
const MAX_LEN_DESC = 150;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Busca coincidencia canónica por nombre (sin acentos, lower, colapsando espacios).
 *  Retorna true si existe otro registro con el mismo "nombre canónico".
 */
async function existeNombreCanonico(nombre, excludeId = null) {
  const query = db("unidades_medida").whereRaw(
    "LOWER(REPLACE(nombre_unidad_medida, ' ', '')) = LOWER(REPLACE(?, ' ', ''))",
    [nombre],
  );

  if (excludeId !== null) {
    query.whereNot("id_unidad_medida", excludeId);
  }

  const result = await query.first();
  return !!result;
}

/** Devuelve productos que usan la unidad (para mensaje amigable). */
async function productosQueUsan(unidadId, limit = 25) {
  const productos = await db("productos")
    .select("id_producto as id", "nombre_producto as nombre")
    .where("id_unidad_medida", unidadId)
    .orderBy("nombre_producto");

  const total = productos.length;
  const lista = productos.slice(0, limit);
  return { total, productos: lista, truncated: total > limit };
}

// LISTAR TODAS LAS UNIDADES DE MEDIDA
export const listarUnidadesMedida = async (req, res) => {
  try {
    const unidades = await db("unidades_medida")
      .select(
        "id_unidad_medida as codigo_unidad_medida", // Mapear para compatibilidad con frontend
        "nombre_unidad_medida",
        "abreviatura_unidad_medida",
        "descripcion_unidad_medida",
        "activo"
      )
      .orderBy("nombre_unidad_medida");

    // Mapear activo a estado 'A' o 'I' para compatibilidad con el frontend
    const unidadesMapeadas = unidades.map(unidad => ({
      ...unidad,
      estado: unidad.activo ? 'A' : 'I'
    }));

    res.json(unidadesMapeadas);
  } catch (error) {
    console.error("Error al listar unidades de medida:", error);
    res.status(500).json({ message: "Error al listar unidades de medida." });
  }
};

// CREAR UNA NUEVA UNIDAD DE MEDIDA
export const crearUnidadMedida = async (req, res) => {
  let {
    nombre_unidad_medida,
    abreviatura_unidad_medida,
    descripcion_unidad_medida,
  } = req.body;

  nombre_unidad_medida = collapseSpaces(nombre_unidad_medida ?? "");
  abreviatura_unidad_medida = collapseSpaces(abreviatura_unidad_medida ?? "");
  descripcion_unidad_medida = collapseSpaces(descripcion_unidad_medida ?? "");

  if (!nombre_unidad_medida) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (nombre_unidad_medida.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
    });
  }
  if (!PATRON_PERMITIDO.test(nombre_unidad_medida)) {
    return res.status(400).json({
      message:
        "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (
    descripcion_unidad_medida &&
    descripcion_unidad_medida.length > MAX_LEN_DESC
  ) {
    return res.status(400).json({
      message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
    });
  }

  try {
    // Unicidad canónica
    if (await existeNombreCanonico(nombre_unidad_medida)) {
      return res
        .status(409)
        .json({ message: "Ya existe una unidad de medida con ese nombre." });
    }

    await db("unidades_medida").insert({
      nombre_unidad_medida,
      abreviatura_unidad_medida: abreviatura_unidad_medida || null,
      descripcion_unidad_medida: descripcion_unidad_medida || null,
      activo: true, // Por defecto activo
    });
    res.status(201).json({ message: "Unidad de medida creada correctamente." });
  } catch (error) {
    console.error("Error al crear unidad de medida:", error);
    res.status(500).json({ message: "Error al crear unidad de medida." });
  }
};

// ACTUALIZAR UNA UNIDAD DE MEDIDA
export const actualizarUnidadMedida = async (req, res) => {
  const { id } = req.params;
  let {
    nombre_unidad_medida,
    abreviatura_unidad_medida,
    descripcion_unidad_medida,
  } = req.body;

  nombre_unidad_medida = collapseSpaces(nombre_unidad_medida ?? "");
  abreviatura_unidad_medida = collapseSpaces(abreviatura_unidad_medida ?? "");
  descripcion_unidad_medida = collapseSpaces(descripcion_unidad_medida ?? "");

  if (!nombre_unidad_medida) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (nombre_unidad_medida.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
    });
  }
  if (!PATRON_PERMITIDO.test(nombre_unidad_medida)) {
    return res.status(400).json({
      message:
        "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (
    descripcion_unidad_medida &&
    descripcion_unidad_medida.length > MAX_LEN_DESC
  ) {
    return res.status(400).json({
      message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
    });
  }

  try {
    // Unicidad canónica excluyendo este ID
    if (await existeNombreCanonico(nombre_unidad_medida, id)) {
      return res
        .status(409)
        .json({ message: "Ya existe una unidad de medida con ese nombre." });
    }

    const rowsAffected = await db("unidades_medida")
      .where("id_unidad_medida", id)
      .update({
        nombre_unidad_medida,
        abreviatura_unidad_medida: abreviatura_unidad_medida || null,
        descripcion_unidad_medida: descripcion_unidad_medida || null,
      });

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: "Unidad de medida no encontrada." });
    }

    res.json({ message: "Unidad de medida actualizada correctamente." });
  } catch (error) {
    console.error("Error al actualizar unidad de medida:", error);
    res.status(500).json({ message: "Error al actualizar unidad de medida." });
  }
};

// ELIMINAR UNA UNIDAD DE MEDIDA
// - Si NO está en uso -> borra físicamente
// - Si SÍ está en uso por productos -> 409 con lista de productos
export const eliminarUnidadMedida = async (req, res) => {
  const { id } = req.params;

  try {
    const { total, productos, truncated } = await productosQueUsan(id);

    if (total > 0) {
      return res.status(409).json({
        message:
          `No se puede eliminar esta unidad porque está en uso por ${total} producto(s). ` +
          `Debes editar esos productos y cambiar la unidad antes de eliminarla.`,
        requiresUpdateProducts: true,
        totalProductos: total,
        productos: productos.map((p) => p.nombre),
        truncated,
      });
    }

    const rowsAffected = await db("unidades_medida")
      .where("id_unidad_medida", id)
      .delete();

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: "Unidad de medida no encontrada." });
    }

    res.json({ message: "Unidad de medida eliminada correctamente." });
  } catch (error) {
    // PostgreSQL foreign key violation error code
    if (error && error.code === "23503") {
      return res.status(409).json({
        message:
          "No se puede eliminar esta unidad porque está en uso por productos. " +
          "Debes editar esos productos y cambiar la unidad antes de eliminarla.",
        requiresUpdateProducts: true,
      });
    }
    console.error("Error al eliminar unidad de medida:", error);
    res.status(500).json({ message: "Error al eliminar unidad de medida." });
  }
};
