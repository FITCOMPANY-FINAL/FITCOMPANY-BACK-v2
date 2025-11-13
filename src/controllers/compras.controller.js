// src/controllers/compras.controller.js
import { getConnection } from '../config/db.js';

// ===== Helpers =====
const isInt = (n) => Number.isInteger(n);
const inRange = (n, min, max) => isInt(n) && n >= min && n <= max;

function getAuthUser(req) {
  const email = req?.user?.email || req?.user?.correo || req?.user?.usuario;
  const tipo_id = req?.user?.tipo_id || req?.user?.tipoIdentificacion || req?.user?.tipo_identificacion;
  if (!email || !tipo_id) return null;
  return { email, tipo_id: parseInt(tipo_id, 10) };
}

async function productoExiste(conn, idProducto) {
  const r = await conn.execute(
    `SELECT 1 FROM PRODUCTOS WHERE ID_PRODUCTO = :id FETCH FIRST 1 ROWS ONLY`,
    { id: idProducto }
  );
  return r.rows.length > 0;
}

// NUEVO: leer stock y umbrales del producto
async function getStockYUmbrales(conn, idProducto) {
  const r = await conn.execute(
    `SELECT STOCK_ACTUAL, STOCK_MINIMO, STOCK_MAXIMO
       FROM PRODUCTOS
      WHERE ID_PRODUCTO = :id`,
    { id: idProducto }
  );
  if (!r.rows.length) return null;
  const [stock_actual, stock_minimo, stock_maximo] = r.rows[0];
  return { stock_actual, stock_minimo, stock_maximo };
}

// Manejador de errores Oracle con mensajes claros
function respondOracleError(res, error, fallbackMsg) {
  // Límite duro de 6 dígitos (ej. 1,000,000) => ORA-01438
  const isHardLimit =
    error?.errorNum === 1438 ||
    error?.code === 'ORA-01438' ||
    String(error?.message || '').includes('ORA-01438');

  if (isHardLimit) {
    return res.status(400).json({
      code: 'STOCK_LIMIT_EXCEEDED',
      message: 'Límite del sistema: el stock no puede superar 999.999.'
    });
  }

  // Queda por compatibilidad; el trigger de “máximo” ya no bloquea,
  // pero si en algún entorno aparece ORA-20002, mostramos algo entendible.
  const wasMaxStockTrigger =
    error?.errorNum === 20002 ||
    error?.code === 'ORA-20002' ||
    String(error?.message || '').includes('ORA-20002');

  if (wasMaxStockTrigger) {
    return res.status(400).json({
      code: 'MAX_STOCK_EXCEEDED',
      message: 'El stock actual excede el máximo permitido.'
    });
  }

  // Genérico
  return res.status(500).json({ message: fallbackMsg });
}

async function usuarioExiste(conn, email, tipoId) {
  const r = await conn.execute(
    `
    SELECT 1
      FROM USUARIOS U
     WHERE TREAT(U.DATOS_PERSONALES AS PersonaBase).EMAIL_USUARIO = :email
       AND TREAT(U.DATOS_PERSONALES AS PersonaBase).TIPO_IDENTIFICACION_USUARIO = :tipo
     FETCH FIRST 1 ROWS ONLY
    `,
    { email, tipo: tipoId }
  );
  return r.rows.length > 0;
}

function hoyYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function esFechaNoFutura(fechaYYYYMMDD) {
  return fechaYYYYMMDD <= hoyYYYYMMDD();
}

// =============================
// REGISTRAR COMPRA
// =============================
export const registrarCompra = async (req, res) => {
  let { cantidad, costo_unitario, producto_id, fecha_compra } = req.body;

  // Usuario autenticado (obligatorio)
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }
  const { email: usuario, tipo_id } = authUser;

  // Normalizar numéricos
  cantidad = parseInt(cantidad, 10);
  costo_unitario = parseInt(costo_unitario, 10);
  producto_id = parseInt(producto_id, 10);

  // Validaciones
  if (!inRange(cantidad, 1, 999_999)) {
    return res.status(400).json({ message: 'La cantidad debe ser un entero entre 1 y 999.999.' });
  }
  if (!inRange(costo_unitario, 1, 99_999_999)) {
    return res.status(400).json({ message: 'El costo unitario debe ser un entero entre 1 y 99.999.999.' });
  }
  if (!producto_id) {
    return res.status(400).json({ message: 'Debes seleccionar un producto válido.' });
  }

  // Fecha de compra: si no viene, usar hoy. Nunca puede ser futura.
  fecha_compra = (fecha_compra && String(fecha_compra)) || hoyYYYYMMDD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_compra) || !esFechaNoFutura(fecha_compra)) {
    return res.status(400).json({ message: 'La fecha de compra es inválida o futura.' });
  }

  let connection;
  try {
    connection = await getConnection();

    // Verificar existencia producto + usuario
    if (!(await productoExiste(connection, producto_id))) {
      await connection.close();
      return res.status(404).json({ message: 'El producto indicado no existe.' });
    }
    if (!(await usuarioExiste(connection, usuario, tipo_id))) {
      await connection.close();
      return res.status(404).json({ message: 'El usuario autenticado no existe en la BD.' });
    }

    // Iniciar transacción (commit/rollback manual)
    const rSeq = await connection.execute(`SELECT SEQ_ID_COMPRA.NEXTVAL FROM DUAL`);
    const idCompra = rSeq.rows[0][0];

    await connection.execute(
      `
      INSERT INTO COMPRAS (
        ID_COMPRA,
        CANTIDAD_COMPRA_INVENTARIO,
        FECHA_COMPRA,
        COSTO_UNIDAD_COMPRA,
        COMPRA_PRODUCTO_INVENTARIO,
        COMPRA_PRODUCTO_USUARIO,
        COMPRA_USUARIO_TIPO_ID
      ) VALUES (
        :id_compra,
        :cantidad,
        TO_DATE(:fecha_compra, 'YYYY-MM-DD'),
        :costo_unitario,
        :producto_id,
        :usuario,
        :tipo_id
      )
      `,
      {
        id_compra: idCompra,
        cantidad,
        fecha_compra,
        costo_unitario,
        producto_id,
        usuario,
        tipo_id,
      }
    );

    await connection.execute(
      `UPDATE PRODUCTOS
          SET STOCK_ACTUAL = STOCK_ACTUAL + :cantidad
        WHERE ID_PRODUCTO = :id`,
      { cantidad, id: producto_id }
    );

    // === Warnings (sobre máximo) ===
    const warnings = [];
    const s = await getStockYUmbrales(connection, producto_id);
    if (s && s.stock_actual > s.stock_maximo) {
      warnings.push({
        code: 'STOCK_ABOVE_MAX',
        message: 'El stock quedó por encima del máximo configurado.',
        meta: { max: s.stock_maximo, after: s.stock_actual }
      });
    }

    await connection.commit();
    await connection.close();
    res.status(201).json({
      ok: true,
      message: 'Compra registrada correctamente.',
      id_compra: idCompra,
      stock_final: s?.stock_actual ?? null,
      warnings
    });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    try { await connection?.close(); } catch {}
    console.error('Error al registrar compra:', error);
    return respondOracleError(res, error, 'Error al registrar compra.');
  }
};

// =============================
// LISTAR COMPRAS
// =============================
export const obtenerCompras = async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(`
      SELECT 
        C.ID_COMPRA,
        C.CANTIDAD_COMPRA_INVENTARIO,
        C.COSTO_UNIDAD_COMPRA,
        (C.CANTIDAD_COMPRA_INVENTARIO * C.COSTO_UNIDAD_COMPRA) AS COSTO_TOTAL,
        TO_CHAR(C.FECHA_COMPRA, 'DD/MM/YYYY') AS FECHA,
        C.COMPRA_PRODUCTO_INVENTARIO,
        C.COMPRA_PRODUCTO_USUARIO,
        C.COMPRA_USUARIO_TIPO_ID,
        P.NOMBRE_PRODUCTO
      FROM COMPRAS C
      JOIN PRODUCTOS P ON P.ID_PRODUCTO = C.COMPRA_PRODUCTO_INVENTARIO
      ORDER BY C.FECHA_COMPRA DESC, C.ID_COMPRA DESC
    `);

    const compras = result.rows.map((row) => ({
      id_compra: row[0],
      cantidad: row[1],
      costo_unitario: row[2],
      costo_total: row[3],
      fecha: row[4],
      producto: row[5],
      usuario: row[6],
      tipo_id: row[7],
      producto_nombre: row[8],
    }));

    await connection.close();
    res.json(compras);
  } catch (error) {
    try { await connection?.close(); } catch {}
    console.error('Error al obtener compras:', error);
    res.status(500).json({ message: 'Error al obtener compras.' });
  }
};

// =============================
// ELIMINAR COMPRA (restituye stock)
// =============================
export const eliminarCompra = async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT CANTIDAD_COMPRA_INVENTARIO, COMPRA_PRODUCTO_INVENTARIO
         FROM COMPRAS
        WHERE ID_COMPRA = :id`,
      { id }
    );
    if (result.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: 'Compra no encontrada.' });
    }

    const [cantidad, producto_id] = result.rows[0];

    await connection.execute(
      `UPDATE PRODUCTOS
          SET STOCK_ACTUAL = STOCK_ACTUAL - :cantidad
        WHERE ID_PRODUCTO = :producto_id`,
      { cantidad, producto_id }
    );

    await connection.execute(
      `DELETE FROM COMPRAS WHERE ID_COMPRA = :id`,
      { id }
    );

    await connection.commit();
    await connection.close();
    res.json({ message: 'Compra eliminada correctamente.' });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    try { await connection?.close(); } catch {}
    console.error('Error al eliminar compra:', error);
    res.status(500).json({ message: 'Error al eliminar compra.' });
  }
};

// =============================
// ACTUALIZAR COMPRA (ajusta stock)
// =============================
export const actualizarCompra = async (req, res) => {
  const { id } = req.params;
  let { cantidad, costo_unitario, producto_id, fecha_compra } = req.body;

  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }
  const { email: usuario, tipo_id } = authUser;

  cantidad = parseInt(cantidad, 10);
  costo_unitario = parseInt(costo_unitario, 10);
  producto_id = parseInt(producto_id, 10);

  if (!inRange(cantidad, 1, 999_999)) {
    return res.status(400).json({ message: 'La cantidad debe ser un entero entre 1 y 999.999.' });
  }
  if (!inRange(costo_unitario, 1, 99_999_999)) {
    return res.status(400).json({ message: 'El costo unitario debe ser un entero entre 1 y 99.999.999.' });
  }
  if (!producto_id) {
    return res.status(400).json({ message: 'Producto inválido.' });
  }

  fecha_compra = (fecha_compra && String(fecha_compra)) || hoyYYYYMMDD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_compra) || !esFechaNoFutura(fecha_compra)) {
    return res.status(400).json({ message: 'La fecha de compra es inválida o futura.' });
  }

  let connection;
  try {
    connection = await getConnection();

    if (!(await productoExiste(connection, producto_id))) {
      await connection.close();
      return res.status(404).json({ message: 'El producto indicado no existe.' });
    }
    if (!(await usuarioExiste(connection, usuario, tipo_id))) {
      await connection.close();
      return res.status(404).json({ message: 'El usuario autenticado no existe en la BD.' });
    }

    const r = await connection.execute(
      `SELECT CANTIDAD_COMPRA_INVENTARIO, COMPRA_PRODUCTO_INVENTARIO
         FROM COMPRAS
        WHERE ID_COMPRA = :id`,
      { id }
    );
    if (r.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: 'Compra no encontrada.' });
    }
    const [cantidadAnterior, productoAnterior] = r.rows[0];

    // Revertir stock anterior
    await connection.execute(
      `UPDATE PRODUCTOS
          SET STOCK_ACTUAL = STOCK_ACTUAL - :cantidad
        WHERE ID_PRODUCTO = :producto_id`,
      { cantidad: cantidadAnterior, producto_id: productoAnterior }
    );

    // Actualizar compra
    await connection.execute(
      `UPDATE COMPRAS SET
          CANTIDAD_COMPRA_INVENTARIO  = :cantidad,
          COSTO_UNIDAD_COMPRA        = :costo,
          FECHA_COMPRA               = TO_DATE(:fecha_compra, 'YYYY-MM-DD'),
          COMPRA_PRODUCTO_INVENTARIO = :producto,
          COMPRA_PRODUCTO_USUARIO    = :usuario,
          COMPRA_USUARIO_TIPO_ID     = :tipo
        WHERE ID_COMPRA = :id`,
      {
        cantidad,
        costo: costo_unitario,
        fecha_compra,
        producto: producto_id,
        usuario,
        tipo: tipo_id,
        id,
      }
    );

    // Sumar nuevo stock
    await connection.execute(
      `UPDATE PRODUCTOS
          SET STOCK_ACTUAL = STOCK_ACTUAL + :cantidad
        WHERE ID_PRODUCTO = :producto_id`,
      { cantidad, producto_id }
    );

    // === Warnings (sobre máximo) ===
    const warnings = [];
    const s = await getStockYUmbrales(connection, producto_id);
    if (s && s.stock_actual > s.stock_maximo) {
      warnings.push({
        code: 'STOCK_ABOVE_MAX',
        message: 'El stock quedó por encima del máximo configurado.',
        meta: { max: s.stock_maximo, after: s.stock_actual }
      });
    }

    await connection.commit();
    await connection.close();
    res.json({
      ok: true,
      message: 'Compra actualizada correctamente.',
      stock_final: s?.stock_actual ?? null,
      warnings
    });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    try { await connection?.close(); } catch {}
    console.error('Error al actualizar compra:', error);
    return respondOracleError(res, error, 'Error al actualizar compra.');
  }
};
