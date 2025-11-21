import db from "../config/db.js";

const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_LEN_NOMBRE = 100;
const MAX_LEN_DESC = 200;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/**
 * Unicidad canónica (ignora acentos, mayúsculas y TODOS los espacios).
 * Migrado de Oracle NLSSORT a PostgreSQL LOWER
 */
async function existeNombreCanonico(nombre, excludeId = null) {
  const query = db("categorias").whereRaw(
    "LOWER(REPLACE(nombre_categoria, ' ', '')) = LOWER(REPLACE(?, ' ', ''))",
    [nombre],
  );

  if (excludeId !== null) {
    query.whereNot("id_categoria", excludeId);
  }

  const result = await query.first();
  return !!result;
}

/**
 * Productos que usan la categoría (para mensaje amigable).
 */
async function productosDeCategoria(categoriaId, limit = 25) {
  const productos = await db("productos")
    .select("id_producto as id", "nombre_producto as nombre")
    .where("id_categoria", categoriaId)
    .orderBy("nombre_producto");

  const total = productos.length;
  return {
    total,
    productos: productos.slice(0, limit),
    truncated: total > limit,
  };
}

// --------- Endpoints ---------

// LISTAR
export const listarCategorias = async (_req, res) => {
  try {
    const categorias = await db("categorias")
      .select(
        "id_categoria",
        "nombre_categoria",
        "descripcion_categoria",
        "activa",
      )
      .orderBy("nombre_categoria");

    // Mapear activa a estado 'A' o 'I' para compatibilidad con el frontend
    const categoriasMapeadas = categorias.map(categoria => ({
      ...categoria,
      estado: categoria.activa ? 'A' : 'I'
    }));

    res.json(categoriasMapeadas);
  } catch (error) {
    console.error("Error al listar categorías:", error);
    res.status(500).json({ message: "Error al listar categorías." });
  }
};

// CREAR
export const crearCategoria = async (req, res) => {
  let { nombre_categoria, descripcion_categoria } = req.body;

  nombre_categoria = collapseSpaces(nombre_categoria ?? "");
  descripcion_categoria = collapseSpaces(descripcion_categoria ?? "");

  if (!nombre_categoria) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (!PATRON_PERMITIDO.test(nombre_categoria)) {
    return res
      .status(400)
      .json({
        message:
          "El nombre solo puede contener letras, espacios, guiones y puntos.",
      });
  }
  if (nombre_categoria.length > MAX_LEN_NOMBRE) {
    return res
      .status(400)
      .json({
        message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
      });
  }
  if (descripcion_categoria && descripcion_categoria.length > MAX_LEN_DESC) {
    return res
      .status(400)
      .json({
        message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
      });
  }

  try {
    // Verificar unicidad canónica
    if (await existeNombreCanonico(nombre_categoria)) {
      return res
        .status(409)
        .json({ message: "Ya existe una categoría con ese nombre." });
    }

    // Insertar nueva categoría
    await db("categorias").insert({
      nombre_categoria,
      descripcion_categoria: descripcion_categoria || null,
      activa: true,
    });

    res.status(201).json({ message: "Categoría creada correctamente." });
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ message: "Error al crear categoría." });
  }
};

// ACTUALIZAR
export const actualizarCategoria = async (req, res) => {
  const { id } = req.params;
  let { nombre_categoria, descripcion_categoria } = req.body;

  nombre_categoria = collapseSpaces(nombre_categoria ?? "");
  descripcion_categoria = collapseSpaces(descripcion_categoria ?? "");

  if (!nombre_categoria) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (!PATRON_PERMITIDO.test(nombre_categoria)) {
    return res
      .status(400)
      .json({
        message:
          "El nombre solo puede contener letras, espacios, guiones y puntos.",
      });
  }
  if (nombre_categoria.length > MAX_LEN_NOMBRE) {
    return res
      .status(400)
      .json({
        message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
      });
  }
  if (descripcion_categoria && descripcion_categoria.length > MAX_LEN_DESC) {
    return res
      .status(400)
      .json({
        message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
      });
  }

  try {
    // Verificar unicidad canónica (excluyendo el ID actual)
    if (await existeNombreCanonico(nombre_categoria, id)) {
      return res
        .status(409)
        .json({ message: "Ya existe una categoría con ese nombre." });
    }

    // Actualizar categoría
    const rowsUpdated = await db("categorias")
      .where("id_categoria", id)
      .update({
        nombre_categoria,
        descripcion_categoria: descripcion_categoria || null,
      });

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Categoría no encontrada." });
    }

    res.json({ message: "Categoría actualizada correctamente." });
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar categoría." });
  }
};

// ELIMINAR
// TODO: Implementar soft delete (cambiar activa=false en vez de DELETE físico)
// TODO: Agregar endpoint para eliminar permanentemente con confirmación/password
// - Si está en uso por productos -> 409 con lista de productos.
// - Si no, borra.
export const eliminarCategoria = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si hay productos usando esta categoría
    const { total, productos, truncated } = await productosDeCategoria(id);

    if (total > 0) {
      return res.status(409).json({
        message:
          `No se puede eliminar la categoría porque está en uso por ${total} producto(s). ` +
          `Debes editar esos productos y cambiar la categoría antes de eliminarla.`,
        requiresUpdateProducts: true,
        totalProductos: total,
        productos: productos.map((p) => p.nombre),
        truncated,
      });
    }

    // Eliminar categoría
    const rowsDeleted = await db("categorias").where("id_categoria", id).del();

    if (rowsDeleted === 0) {
      return res.status(404).json({ message: "Categoría no encontrada." });
    }

    res.json({ message: "Categoría eliminada correctamente." });
  } catch (error) {
    // Error de clave foránea en PostgreSQL (código 23503)
    if (error && error.code === "23503") {
      return res.status(409).json({
        message:
          "No se puede eliminar la categoría porque está en uso por productos. " +
          "Debes editar esos productos y cambiar la categoría antes de eliminarla.",
        requiresUpdateProducts: true,
      });
    }

    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar categoría." });
  }
};
