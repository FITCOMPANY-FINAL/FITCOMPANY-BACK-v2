import { getConnection } from "../config/db.js";

// ---------- Helpers de normalización/validación ----------
const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_NOMBRE = 100;
const MAX_DESC = 200;
// Letras con acentos, dígitos, espacios y signos típicos de catálogo
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-./()%+]+$/;

const PRECIO_MAX = 99999999;

// Comparación canónica: ignora acentos/mayúsculas y elimina TODOS los espacios (incluye espacios intermedios)
async function existeNombreCanonico(connection, nombre, excludeId = null) {
  const sql = `
    SELECT ID_PRODUCTO
      FROM PRODUCTOS
     WHERE NLSSORT(REGEXP_REPLACE(NOMBRE_PRODUCTO, '[[:space:]]+', ''), 'NLS_SORT=BINARY_AI')
           = NLSSORT(REGEXP_REPLACE(:p_nombre,        '[[:space:]]+', ''), 'NLS_SORT=BINARY_AI')
       AND (:p_exclude IS NULL OR ID_PRODUCTO <> :p_exclude)
     FETCH FIRST 1 ROWS ONLY
  `;
  const r = await connection.execute(sql, {
    p_nombre: nombre,
    p_exclude: excludeId,
  });
  return r.rows.length > 0;
}



async function fkExiste(connection, tabla, columna, id) {
  const sql = `SELECT 1 FROM ${tabla} WHERE ${columna} = :id FETCH FIRST 1 ROWS ONLY`;
  const r = await connection.execute(sql, { id });
  return r.rows.length > 0;
}

function validarPayloadProducto(p) {
  // Normaliza strings
  p.nombre_producto = collapseSpaces(p.nombre_producto ?? "");
  p.descripcion_producto = collapseSpaces(p.descripcion_producto ?? "");

  // Coerción a número entero (precio/stock)
  const toInt = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
  p.precio_unitario = toInt(p.precio_unitario);
  p.stock_actual = toInt(p.stock_actual);
  p.stock_minimo = toInt(p.stock_minimo);
  p.stock_maximo = toInt(p.stock_maximo);
  p.unidad_medida = toInt(p.unidad_medida);
  p.producto_categoria = toInt(p.producto_categoria);

  // Reglas
  if (!p.nombre_producto) return { ok: false, message: "El nombre es obligatorio." };
  if (p.nombre_producto.length > MAX_NOMBRE)
    return { ok: false, message: `El nombre admite máximo ${MAX_NOMBRE} caracteres.` };
  if (!PATRON_NOMBRE.test(p.nombre_producto))
    return { ok: false, message: "El nombre solo puede contener letras, números, espacios y - . / ( ) % +." };

  if (p.descripcion_producto && p.descripcion_producto.length > MAX_DESC)
    return { ok: false, message: `La descripción admite máximo ${MAX_DESC} caracteres.` };

  if (!Number.isFinite(p.precio_unitario) || p.precio_unitario <= 0)
    return { ok: false, message: "El precio debe ser un entero mayor a cero." };
  if (p.precio_unitario > PRECIO_MAX)
    return { ok: false, message: `El precio máximo permitido es ${PRECIO_MAX}.` };

  for (const [campo, valor] of [
    ["stock_actual", p.stock_actual],
    ["stock_minimo", p.stock_minimo],
    ["stock_maximo", p.stock_maximo],
  ]) {
    if (!Number.isFinite(valor) || valor < 0)
      return { ok: false, message: `El ${campo.replace("_", " ")} debe ser un entero mayor o igual a 0.` };
  }

  if (p.stock_maximo === 0)
    return { ok: false, message: "El stock máximo debe ser mayor a 0." };

  if (p.stock_minimo > p.stock_maximo)
    return { ok: false, message: "El stock mínimo no puede ser mayor que el stock máximo." };

  if (p.stock_actual < p.stock_minimo || p.stock_actual > p.stock_maximo)
    return { ok: false, message: "El stock actual debe estar entre el stock mínimo y el stock máximo." };

  if (!Number.isFinite(p.unidad_medida))
    return { ok: false, message: "Debes seleccionar una unidad de medida." };
  if (!Number.isFinite(p.producto_categoria))
    return { ok: false, message: "Debes seleccionar una categoría." };

  return { ok: true };
}

// Para mensajes de borrado con referencias
async function referenciasProducto(connection, id, cap = 10) {
  const out = { ventas: 0, compras: 0, ventasEjemplos: [], comprasEjemplos: [] };

  // DETALLES_VENTAS_PRODUCTOS
  let r = await connection.execute(
    `SELECT COUNT(*) FROM DETALLES_VENTAS_PRODUCTOS WHERE PRODUCTO_VENDIDO = :id`,
    { id }
  );
  out.ventas = r.rows?.[0]?.[0] ?? 0;

  r = await connection.execute(
    `SELECT VENTA_ID FROM DETALLES_VENTAS_PRODUCTOS WHERE PRODUCTO_VENDIDO = :id FETCH FIRST :cap ROWS ONLY`,
    { id, cap }
  );
  out.ventasEjemplos = (r.rows || []).map((row) => row[0]);

  // COMPRAS (según FK que mostraste)
  r = await connection.execute(
    `SELECT COUNT(*) FROM COMPRAS WHERE COMPRA_PRODUCTO_INVENTARIO = :id`,
    { id }
  );
  out.compras = r.rows?.[0]?.[0] ?? 0;

  r = await connection.execute(
    `SELECT ID_COMPRA FROM COMPRAS WHERE COMPRA_PRODUCTO_INVENTARIO = :id FETCH FIRST :cap ROWS ONLY`,
    { id, cap }
  );
  out.comprasEjemplos = (r.rows || []).map((row) => row[0]);

  return out;
}

// ---------- Endpoints ----------

// LISTAR con nombres de FK
export const listarProductos = async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.execute(`
      SELECT 
        P.ID_PRODUCTO,
        P.NOMBRE_PRODUCTO,
        P.DESCRIPCION_PRODUCTO,
        P.PRECIO_UNITARIO,
        P.STOCK_ACTUAL,
        P.STOCK_MINIMO,
        P.STOCK_MAXIMO,
        UM.CODIGO_UNIDAD_MEDIDA,
        UM.NOMBRE_UNIDAD_MEDIDA,
        C.ID_CATEGORIA,
        C.NOMBRE_CATEGORIA,
        TO_CHAR(P.FECHA_CREACION, 'YYYY-MM-DD') AS FECHA_CREACION
      FROM PRODUCTOS P
      LEFT JOIN UNIDAD_MEDIDAS UM ON P.UNIDAD_MEDIDA = UM.CODIGO_UNIDAD_MEDIDA
      LEFT JOIN CATEGORIAS C ON P.PRODUCTO_CATEGORIA = C.ID_CATEGORIA
      ORDER BY P.NOMBRE_PRODUCTO
    `);

    const productos = result.rows.map((row) => ({
      id_producto: row[0],
      nombre_producto: row[1],
      descripcion_producto: row[2],
      precio_unitario: row[3],
      stock_actual: row[4],
      stock_minimo: row[5],
      stock_maximo: row[6],
      unidad_medida: row[7],
      nombre_unidad_medida: row[8],
      producto_categoria: row[9],
      nombre_categoria: row[10],
      fecha_creacion: row[11],
    }));

    await connection.close();
    res.json(productos);
  } catch (error) {
    console.error("Error al listar productos:", error);
    res.status(500).json({ message: "Error al listar productos." });
  }
};

// Pre-chequeo de nombre (para el blur del front)
export const existeProducto = async (req, res) => {
  const { nombre, excludeId } = req.query;
  const base = collapseSpaces(nombre || "");
  if (!base) return res.json({ exists: false });
  try {
    const connection = await getConnection();
    const existe = await existeNombreCanonico(connection, base, excludeId ?? null);
    await connection.close();
    res.json({ exists: !!existe });
  } catch (e) {
    console.error("Error en existeProducto:", e);
    res.json({ exists: false });
  }
};

// CREAR
export const crearProducto = async (req, res) => {
  const payload = { ...req.body };
  const v = validarPayloadProducto(payload);
  if (!v.ok) return res.status(400).json({ message: v.message });

  try {
    const connection = await getConnection();

    // Unicidad canónica
    if (await existeNombreCanonico(connection, payload.nombre_producto)) {
      await connection.close();
      return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    }

    // FKs existen
    const umOk = await fkExiste(connection, "UNIDAD_MEDIDAS", "CODIGO_UNIDAD_MEDIDA", payload.unidad_medida);
    if (!umOk) {
      await connection.close();
      return res.status(400).json({ message: "La unidad de medida seleccionada no existe." });
    }
    const catOk = await fkExiste(connection, "CATEGORIAS", "ID_CATEGORIA", payload.producto_categoria);
    if (!catOk) {
      await connection.close();
      return res.status(400).json({ message: "La categoría seleccionada no existe." });
    }

    await connection.execute(
      `INSERT INTO PRODUCTOS (
        ID_PRODUCTO, NOMBRE_PRODUCTO, DESCRIPCION_PRODUCTO,
        PRECIO_UNITARIO, STOCK_ACTUAL, STOCK_MINIMO, STOCK_MAXIMO,
        UNIDAD_MEDIDA, FECHA_CREACION, PRODUCTO_CATEGORIA
      ) VALUES (
        SEQ_ID_PRODUCTO.NEXTVAL, :p_nombre, :p_desc,
        :p_precio, :p_stock_act, :p_stock_min, :p_stock_max,
        :p_um, SYSDATE, :p_cat
      )`,
      {
        p_nombre: payload.nombre_producto,
        p_desc: payload.descripcion_producto || null,
        p_precio: payload.precio_unitario,
        p_stock_act: payload.stock_actual,
        p_stock_min: payload.stock_minimo,
        p_stock_max: payload.stock_maximo,
        p_um: payload.unidad_medida,
        p_cat: payload.producto_categoria,
      },
      { autoCommit: true }
    );

    await connection.close();
    res.status(201).json({ message: "Producto creado correctamente." });
  } catch (error) {
    console.error("Error al crear producto:", error);
    if (error?.errorNum === 1438) {
      return res.status(400).json({
        message: "Valor fuera de rango: el precio máximo permitido es 99,999,999.",
      });
    }
    res.status(500).json({ message: "Error al crear producto." });
  }
};

// ACTUALIZAR
export const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const payload = { ...req.body };
  const v = validarPayloadProducto(payload);
  if (!v.ok) return res.status(400).json({ message: v.message });

  try {
    const connection = await getConnection();

    // Unicidad canónica (excluyendo el propio id)
    if (await existeNombreCanonico(connection, payload.nombre_producto, id)) {
      await connection.close();
      return res.status(409).json({ message: "Ya existe un producto con ese nombre." });
    }

    // FKs existen
    const umOk = await fkExiste(connection, "UNIDAD_MEDIDAS", "CODIGO_UNIDAD_MEDIDA", payload.unidad_medida);
    if (!umOk) {
      await connection.close();
      return res.status(400).json({ message: "La unidad de medida seleccionada no existe." });
    }
    const catOk = await fkExiste(connection, "CATEGORIAS", "ID_CATEGORIA", payload.producto_categoria);
    if (!catOk) {
      await connection.close();
      return res.status(400).json({ message: "La categoría seleccionada no existe." });
    }

    await connection.execute(
      `UPDATE PRODUCTOS
          SET NOMBRE_PRODUCTO = :p_nombre,
              DESCRIPCION_PRODUCTO = :p_desc,
              PRECIO_UNITARIO = :p_precio,
              STOCK_ACTUAL = :p_stock_act,
              STOCK_MINIMO = :p_stock_min,
              STOCK_MAXIMO = :p_stock_max,
              UNIDAD_MEDIDA = :p_um,
              PRODUCTO_CATEGORIA = :p_cat
        WHERE ID_PRODUCTO = :p_id`,
      {
        p_nombre: payload.nombre_producto,
        p_desc: payload.descripcion_producto || null,
        p_precio: payload.precio_unitario,
        p_stock_act: payload.stock_actual,
        p_stock_min: payload.stock_minimo,
        p_stock_max: payload.stock_maximo,
        p_um: payload.unidad_medida,
        p_cat: payload.producto_categoria,
        p_id: id,
      },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Producto actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    if (error?.errorNum === 1438) {
      return res.status(400).json({
        message: `Valor fuera de rango: el precio máximo permitido es ${PRECIO_MAX}.`,
      });
    }
    res.status(500).json({ message: "Error al actualizar producto." });
  }
};


// ELIMINAR (permitir si stock_actual <= stock_minimo)
export const eliminarProducto = async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();

    // 1) Leer stock_actual y stock_minimo
    const rs = await connection.execute(
      `SELECT STOCK_ACTUAL, STOCK_MINIMO
         FROM PRODUCTOS
        WHERE ID_PRODUCTO = :p_id`,
      { p_id: id }
    );

    if (!rs.rows || rs.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    const stockActual = Number(rs.rows[0][0] || 0);
    const stockMinimo = Number(rs.rows[0][1] || 0);

    // Nueva regla: solo bloquea si actual > mínimo
    if (stockActual > stockMinimo) {
      await connection.close();
      return res.status(409).json({
        message:
          "No se puede eliminar el producto porque el stock actual es mayor que el mínimo. " +
          "Primero bájalo hasta su stock mínimo.",
      });
    }

    // 2) Borrar (históricos quedan con SET NULL en FKs)
    await connection.execute(
      `DELETE FROM PRODUCTOS WHERE ID_PRODUCTO = :p_id`,
      { p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Producto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar producto:", error);

    // Si el trigger de BD sigue activo con la regla anterior, mapeamos bien el mensaje
    if (error?.errorNum === 20004) {
      return res.status(409).json({
        message:
          "No se puede eliminar el producto por regla de stock. " +
          "Debe estar en su stock mínimo (o 0).",
      });
    }

    if (error?.errorNum === 2292) {
      return res.status(409).json({
        message:
          "No se pudo eliminar por restricciones de integridad. Revisa que las FKs estén con ON DELETE SET NULL.",
      });
    }

    res.status(500).json({ message: "Error al eliminar producto." });
  }
};

