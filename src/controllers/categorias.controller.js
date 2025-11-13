import { getConnection } from "../config/db.js";

const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_LEN_NOMBRE = 100;
const MAX_LEN_DESC = 200;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Unicidad canónica (ignora acentos, mayúsculas y TODOS los espacios). */
async function existeNombreCanonico(connection, nombre, excludeId = null) {
  const sql = `
    SELECT 1
      FROM CATEGORIAS
     WHERE NLSSORT(REPLACE(NOMBRE_CATEGORIA, ' ', ''), 'NLS_SORT=BINARY_AI')
           = NLSSORT(REPLACE(:p_nombre, ' ', ''), 'NLS_SORT=BINARY_AI')
       AND (:p_exclude_id IS NULL OR ID_CATEGORIA <> :p_exclude_id)
     FETCH FIRST 1 ROWS ONLY
  `;
  const r = await connection.execute(sql, {
    p_nombre: nombre,
    p_exclude_id: excludeId,
  });
  return r.rows.length > 0;
}

/** Productos que usan la categoría (para mensaje amigable). */
async function productosDeCategoria(connection, categoriaId, limit = 25) {
  const sql = `
    SELECT ID_PRODUCTO, NOMBRE_PRODUCTO
      FROM PRODUCTOS
     WHERE PRODUCTO_CATEGORIA = :p_id
     ORDER BY NOMBRE_PRODUCTO
  `;
  const r = await connection.execute(sql, { p_id: categoriaId });
  const productos = r.rows.map((row) => ({ id: row[0], nombre: row[1] }));
  const total = productos.length;
  return { total, productos: productos.slice(0, limit), truncated: total > limit };
}

// --------- Endpoints ---------

// LISTAR
export const listarCategorias = async (_req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.execute(
      `SELECT ID_CATEGORIA, NOMBRE_CATEGORIA, DESCRIPCION_CATEGORIA
         FROM CATEGORIAS
         ORDER BY NOMBRE_CATEGORIA`
    );
    const categorias = result.rows.map((row) => ({
      id_categoria: row[0],
      nombre_categoria: row[1],
      descripcion_categoria: row[2],
    }));
    await connection.close();
    res.json(categorias);
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
      .json({ message: "El nombre solo puede contener letras, espacios, guiones y puntos." });
  }
  if (nombre_categoria.length > MAX_LEN_NOMBRE) {
    return res
      .status(400)
      .json({ message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.` });
  }
  if (descripcion_categoria && descripcion_categoria.length > MAX_LEN_DESC) {
    return res
      .status(400)
      .json({ message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.` });
  }

  try {
    const connection = await getConnection();

    if (await existeNombreCanonico(connection, nombre_categoria)) {
      await connection.close();
      return res.status(409).json({ message: "Ya existe una categoría con ese nombre." });
    }

    await connection.execute(
      `INSERT INTO CATEGORIAS (ID_CATEGORIA, NOMBRE_CATEGORIA, DESCRIPCION_CATEGORIA)
       VALUES (SEQ_CATEGORIA.NEXTVAL, :p_nombre, :p_desc)`,
      { p_nombre: nombre_categoria, p_desc: descripcion_categoria },
      { autoCommit: true }
    );

    await connection.close();
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
      .json({ message: "El nombre solo puede contener letras, espacios, guiones y puntos." });
  }
  if (nombre_categoria.length > MAX_LEN_NOMBRE) {
    return res
      .status(400)
      .json({ message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.` });
  }
  if (descripcion_categoria && descripcion_categoria.length > MAX_LEN_DESC) {
    return res
      .status(400)
      .json({ message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.` });
  }

  try {
    const connection = await getConnection();

    if (await existeNombreCanonico(connection, nombre_categoria, id)) {
      await connection.close();
      return res.status(409).json({ message: "Ya existe una categoría con ese nombre." });
    }

    await connection.execute(
      `UPDATE CATEGORIAS
          SET NOMBRE_CATEGORIA = :p_nombre, DESCRIPCION_CATEGORIA = :p_desc
        WHERE ID_CATEGORIA = :p_id`,
      { p_nombre: nombre_categoria, p_desc: descripcion_categoria, p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Categoría actualizada correctamente." });
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar categoría." });
  }
};

// ELIMINAR
// - Si está en uso por productos -> 409 con lista de productos.
// - Si no, borra.
export const eliminarCategoria = async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();

    const { total, productos, truncated } = await productosDeCategoria(connection, id);
    if (total > 0) {
      await connection.close();
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

    await connection.execute(
      `DELETE FROM CATEGORIAS WHERE ID_CATEGORIA = :p_id`,
      { p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Categoría eliminada correctamente." });
  } catch (error) {
    if (error && error.errorNum === 2292) {
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
