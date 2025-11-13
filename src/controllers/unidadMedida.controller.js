import { getConnection } from "../config/db.js";

const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_LEN_NOMBRE = 100;
const MAX_LEN_DESC = 150;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Busca coincidencia canónica por nombre (sin acentos, lower, colapsando espacios).
 *  Retorna true si existe otro registro con el mismo "nombre canónico".
 */
async function existeNombreCanonico(connection, nombre, excludeId = null) {
  const sql = `
    SELECT 1
    FROM UNIDAD_MEDIDAS
    WHERE NLSSORT(REPLACE(NOMBRE_UNIDAD_MEDIDA, ' ', ''), 'NLS_SORT=BINARY_AI')
          = NLSSORT(REPLACE(:p_nombre, ' ', ''), 'NLS_SORT=BINARY_AI')
      AND (:p_exclude_id IS NULL OR CODIGO_UNIDAD_MEDIDA <> :p_exclude_id)
    FETCH FIRST 1 ROWS ONLY
  `;
  const r = await connection.execute(sql, { p_nombre: nombre, p_exclude_id: excludeId });
  return r.rows.length > 0;
}

/** Devuelve productos que usan la unidad (para mensaje amigable). */
async function productosQueUsan(connection, unidadId, limit = 25) {
  const sql = `
    SELECT ID_PRODUCTO, NOMBRE_PRODUCTO
      FROM PRODUCTOS
     WHERE UNIDAD_MEDIDA = :p_id
     ORDER BY NOMBRE_PRODUCTO
  `;
  const r = await connection.execute(sql, { p_id: unidadId });
  const productos = r.rows.map((row) => ({
    id: row[0],
    nombre: row[1],
  }));
  const total = productos.length;
  // cap de seguridad
  const lista = productos.slice(0, limit);
  return { total, productos: lista, truncated: total > limit };
}

// LISTAR TODAS LAS UNIDADES DE MEDIDA
export const listarUnidadesMedida = async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.execute(
      `SELECT CODIGO_UNIDAD_MEDIDA, NOMBRE_UNIDAD_MEDIDA, DESCRIPCION_UNIDAD_MEDIDA
         FROM UNIDAD_MEDIDAS
         ORDER BY NOMBRE_UNIDAD_MEDIDA`
    );

    const unidades = result.rows.map((row) => ({
      codigo_unidad_medida: row[0],
      nombre_unidad_medida: row[1],
      descripcion_unidad_medida: row[2],
    }));

    await connection.close();
    res.json(unidades);
  } catch (error) {
    console.error("Error al listar unidades de medida:", error);
    res.status(500).json({ message: "Error al listar unidades de medida." });
  }
};

// CREAR UNA NUEVA UNIDAD DE MEDIDA
export const crearUnidadMedida = async (req, res) => {
  let { nombre_unidad_medida, descripcion_unidad_medida } = req.body;

  nombre_unidad_medida = collapseSpaces(nombre_unidad_medida ?? "");
  descripcion_unidad_medida = collapseSpaces(descripcion_unidad_medida ?? "");

  if (!nombre_unidad_medida) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (nombre_unidad_medida.length > MAX_LEN_NOMBRE) {
    return res
      .status(400)
      .json({ message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.` });
  }
  if (!PATRON_PERMITIDO.test(nombre_unidad_medida)) {
    return res.status(400).json({
      message: "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (descripcion_unidad_medida && descripcion_unidad_medida.length > MAX_LEN_DESC) {
    return res
      .status(400)
      .json({ message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.` });
  }

  try {
    const connection = await getConnection();

    // Unicidad canónica
    if (await existeNombreCanonico(connection, nombre_unidad_medida)) {
      await connection.close();
      return res
        .status(409)
        .json({ message: "Ya existe una unidad de medida con ese nombre." });
    }

    await connection.execute(
      `INSERT INTO UNIDAD_MEDIDAS
         (CODIGO_UNIDAD_MEDIDA, NOMBRE_UNIDAD_MEDIDA, DESCRIPCION_UNIDAD_MEDIDA)
       VALUES
         (SEQ_UNIDAD_MEDIDA.NEXTVAL, :p_nombre, :p_desc)`,
      { p_nombre: nombre_unidad_medida, p_desc: descripcion_unidad_medida },
      { autoCommit: true }
    );

    await connection.close();
    res.status(201).json({ message: "Unidad de medida creada correctamente." });
  } catch (error) {
    console.error("Error al crear unidad de medida:", error);
    res.status(500).json({ message: "Error al crear unidad de medida." });
  }
};

// ACTUALIZAR UNA UNIDAD DE MEDIDA
export const actualizarUnidadMedida = async (req, res) => {
  const { id } = req.params;
  let { nombre_unidad_medida, descripcion_unidad_medida } = req.body;

  nombre_unidad_medida = collapseSpaces(nombre_unidad_medida ?? "");
  descripcion_unidad_medida = collapseSpaces(descripcion_unidad_medida ?? "");

  if (!nombre_unidad_medida) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }
  if (nombre_unidad_medida.length > MAX_LEN_NOMBRE) {
    return res
      .status(400)
      .json({ message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.` });
  }
  if (!PATRON_PERMITIDO.test(nombre_unidad_medida)) {
    return res.status(400).json({
      message: "El nombre solo puede contener letras, espacios, guiones y puntos.",
    });
  }
  if (descripcion_unidad_medida && descripcion_unidad_medida.length > MAX_LEN_DESC) {
    return res
      .status(400)
      .json({ message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.` });
  }

  try {
    const connection = await getConnection();

    // Unicidad canónica excluyendo este ID
    if (await existeNombreCanonico(connection, nombre_unidad_medida, id)) {
      await connection.close();
      return res
        .status(409)
        .json({ message: "Ya existe una unidad de medida con ese nombre." });
    }

    await connection.execute(
      `UPDATE UNIDAD_MEDIDAS
          SET NOMBRE_UNIDAD_MEDIDA = :p_nombre,
              DESCRIPCION_UNIDAD_MEDIDA = :p_desc
        WHERE CODIGO_UNIDAD_MEDIDA = :p_id`,
      { p_nombre: nombre_unidad_medida, p_desc: descripcion_unidad_medida, p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Unidad de medida actualizada correctamente." });
  } catch (error) {
    console.error("Error al actualizar unidad de medida:", error);
    res.status(500).json({ message: "Error al actualizar unidad de medida." });
  }
};

// ELIMINAR UNA UNIDAD DE MEDIDA
// - Si NO está en uso -> borra.
// - Si SÍ está en uso por productos -> 409 con la lista de productos que la usan.
export const eliminarUnidadMedida = async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();

    const { total, productos, truncated } = await productosQueUsan(connection, id);

    if (total > 0) {
      await connection.close();
      return res.status(409).json({
        message:
          `No se puede eliminar esta unidad porque está en uso por ${total} producto(s). ` +
          `Debes editar esos productos y cambiar la unidad antes de eliminarla.`,
        requiresUpdateProducts: true,
        totalProductos: total,
        productos: productos.map((p) => p.nombre), // devolvemos solo nombres para el front
        truncated, // true si solo se envió una parte de la lista
      });
    }

    await connection.execute(
      `DELETE FROM UNIDAD_MEDIDAS WHERE CODIGO_UNIDAD_MEDIDA = :p_id`,
      { p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Unidad de medida eliminada correctamente." });
  } catch (error) {
    // Si la FK explotara igualmente por carrera, manejamos ORA-02292
    if (error && error.errorNum === 2292) {
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
