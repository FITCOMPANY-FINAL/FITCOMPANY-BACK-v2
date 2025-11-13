// src/controllers/ventas.controller.js
import { getConnection } from '../config/db.js';

/* ===========================
   Helpers
   =========================== */

function getAuthUser(req) {
  const email = req?.user?.email || req?.user?.correo || req?.user?.usuario;
  const tipo_id =
    req?.user?.tipo_id ||
    req?.user?.tipo ||                 // acepta el campo "tipo" del token
    req?.user?.tipoIdentificacion ||
    req?.user?.tipo_identificacion;

  if (!email || !tipo_id) return null;
  return { email, tipo_id: Number(tipo_id) };
}

function agruparCantidades(items) {
  const map = new Map();
  for (const it of items) {
    const id = it.id_producto;
    const qty = it.cantidad;
    map.set(id, (map.get(id) || 0) + qty);
  }
  return map; // Map<id_producto, cantidadTotalSolicitada>
}

function buildInBindings(ids, prefix = 'p') {
  const keys = ids.map((_, i) => `:${prefix}${i}`).join(',');
  const binds = Object.fromEntries(ids.map((v, i) => [`${prefix}${i}`, v]));
  return { keys, binds };
}

const isInt = (n) => Number.isInteger(n);
const inRange = (n, a, b) => isInt(n) && n >= a && n <= b;

const LIMITE_CANTIDAD = 999_999;
const LIMITE_PRECIO_UNIT = 99_999_999;
const LIMITE_TOTAL_VENTA = 99_999_999;

// Valida array de productos del body (formato y rangos básicos)
function validarItemsVenta(productos) {
  if (!Array.isArray(productos) || productos.length === 0) {
    return 'Debes incluir al menos un producto en la venta.';
  }
  if (productos.length > 200) {
    return 'La venta no puede tener más de 200 ítems.';
  }
  for (let i = 0; i < productos.length; i++) {
    const p = productos[i] || {};
    const id = parseInt(p.id_producto, 10);
    const qty = parseInt(p.cantidad, 10);
    const pu = parseInt(p.precio_unitario, 10);

    if (!id || id <= 0) {
      return `El producto #${i + 1} no es válido.`;
    }
    if (!inRange(qty, 1, LIMITE_CANTIDAD)) {
      return `La cantidad del ítem #${i + 1} debe ser un entero entre 1 y ${LIMITE_CANTIDAD.toLocaleString('es-CO')}.`;
    }
    if (!inRange(pu, 1, LIMITE_PRECIO_UNIT)) {
      return `El precio unitario del ítem #${i + 1} debe ser un entero entre 1 y ${LIMITE_PRECIO_UNIT.toLocaleString('es-CO')}.`;
    }
  }
  return null;
}

// Lee STOCK_ACTUAL, MINIMO y MAXIMO para lista de productos
async function getStocks(conn, ids) {
  if (!ids.length) return new Map();
  const { keys, binds } = buildInBindings(ids, 'p');
  const r = await conn.execute(
    `SELECT ID_PRODUCTO, NOMBRE_PRODUCTO, STOCK_ACTUAL, STOCK_MINIMO, STOCK_MAXIMO
       FROM PRODUCTOS
      WHERE ID_PRODUCTO IN (${keys})`,
    binds
  );
  const map = new Map();
  for (const [id, nombre, act, min, max] of r.rows) {
    map.set(id, { nombre, act: Number(act), min: Number(min), max: Number(max) });
  }
  return map; // Map<id, {nombre,act,min,max}>
}


function mapOracleStockError(err) {
  const text = String(err?.message || '');
  if (err?.errorNum === 20002 || text.includes('ORA-20002')) {
    return text.replace(/^.*ORA-20002:\s*/, '').trim()
      || '❌ Movimiento supera el stock máximo permitido.';
  }
  if (err?.errorNum === 20001 || text.includes('ORA-20001')) {
    return text.replace(/^.*ORA-20001:\s*/, '').trim()
      || '❌ Movimiento dejaría el stock por debajo del mínimo.';
  }
  if (err?.errorNum === 1438 || text.includes('ORA-01438')) {
    return 'Límite del sistema: el stock no puede superar 999.999.';
  }
  return null;
}

/* ===========================
   CREAR VENTA (bloquea sobreventa)
   =========================== */
export const crearVenta = async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ message: "Usuario no autenticado." });
  const { email: usuario, tipo_id } = authUser;

  const errorItems = validarItemsVenta(req.body?.productos);
  if (errorItems) return res.status(400).json({ message: errorItems });

  const productos = req.body.productos.map(p => ({
    id_producto: parseInt(p.id_producto, 10),
    cantidad: parseInt(p.cantidad, 10),
    precio_unitario: parseInt(p.precio_unitario, 10),
  }));

  let totalVenta = 0;
  for (const it of productos) totalVenta += it.cantidad * it.precio_unitario;
  if (!inRange(totalVenta, 1, LIMITE_TOTAL_VENTA)) {
    return res.status(400).json({
      message: `El total de la venta debe ser un entero entre 1 y ${LIMITE_TOTAL_VENTA.toLocaleString('es-CO')}.`,
    });
  }

  let connection;
  const warnings = [];
  try {
    connection = await getConnection();

    // === BLOQUEAR SOBREVENTA ===
    const agrupado = agruparCantidades(productos);
    const ids = Array.from(agrupado.keys());
    const stocks = await getStocks(connection, ids);

    const insuficientes = [];
    for (const id of ids) {
      const reqQty = agrupado.get(id) || 0;
      const s = stocks.get(id);
      const disponible = s?.act ?? 0;
      if (reqQty > disponible) {
        insuficientes.push({
          producto_id: id,
          nombre: s?.nombre || '',
          solicitado: reqQty,
          disponible,
          deficit: reqQty - disponible
        });
      }
    }
    if (insuficientes.length) {
      await connection.close();
      return res.status(400).json({
        code: 'STOCK_NOT_ENOUGH',
        message: 'No hay stock suficiente para completar la venta.',
        items: insuficientes
      });
    }

    // === Registrar venta ===
    const rId = await connection.execute(`SELECT SEQ_ID_VENTA.NEXTVAL FROM DUAL`);
    const idVenta = rId.rows[0][0];

    await connection.execute(
      `INSERT INTO VENTAS (ID_VENTA, FECHA_VENTA, TOTAL_VENTA, VENTA_USUARIO, VENTA_USUARIO_TIPO_ID)
       VALUES (:id, SYSDATE, 0, :u, :t)`,
      { id: idVenta, u: usuario, t: tipo_id }
    );

    for (const it of productos) {
      await connection.execute(
        `INSERT INTO DETALLES_VENTAS_PRODUCTOS
           (ID_DETALLE_VENTA, CANTIDAD_DETALLE_VENTA, PRECIO_UNITARIO_DETALLE_VENTA, PRODUCTO_VENDIDO, VENTA_ID)
         VALUES (SEQ_ID_DETALLE_VENTA.NEXTVAL, :qty, :pu, :prod, :venta)`,
        { qty: it.cantidad, pu: it.precio_unitario, prod: it.id_producto, venta: idVenta }
      );

      await connection.execute(
        `UPDATE PRODUCTOS
            SET STOCK_ACTUAL = STOCK_ACTUAL - :qty
          WHERE ID_PRODUCTO = :prod`,
        { qty: it.cantidad, prod: it.id_producto }
      );
    }

    await connection.execute(
      `UPDATE VENTAS SET TOTAL_VENTA = :tot WHERE ID_VENTA = :id`,
      { tot: totalVenta, id: idVenta }
    );

    // Warnings por quedar bajo mínimo
    const after = await getStocks(connection, Array.from(new Set(productos.map(p => p.id_producto))));
    for (const [id, s] of after) {
      if (s.act < s.min) {
        warnings.push({
          code: 'STOCK_BELOW_MIN',
          message: 'El stock quedó por debajo del mínimo configurado.',
          meta: { min: s.min, after: s.act, producto_id: id }
        });
      }
    }

    await connection.commit();
    await connection.close();

    res.status(201).json({ ok: true, message: 'Venta registrada correctamente.', id_venta: idVenta, warnings });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    try { await connection?.close(); } catch {}

    const nice = mapOracleStockError(error);
    if (nice) return res.status(400).json({ message: nice });

    console.error('Error al registrar venta:', error);
    return res.status(500).json({ message: 'Error al registrar venta.' });
  }
};

/* ===========================
   LISTAR VENTAS
   =========================== */
export const obtenerVentas = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(`
      SELECT 
        ID_VENTA,
        TO_CHAR(FECHA_VENTA, 'DD/MM/YYYY') AS FECHA,
        TOTAL_VENTA,
        VENTA_USUARIO,
        VENTA_USUARIO_TIPO_ID
      FROM VENTAS
      ORDER BY FECHA_VENTA DESC, ID_VENTA DESC
    `);

    const ventas = result.rows.map(r => ({
      id_venta: r[0],
      fecha: r[1],
      total: r[2],
      usuario: r[3],
      tipo_id: r[4],
    }));

    await connection.close();
    res.json(ventas);
  } catch (error) {
    try { await connection?.close(); } catch {}
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ message: 'Error al obtener ventas.' });
  }
};

/* ===========================
   ELIMINAR VENTA (restituye stock; puede dar warning de máximo)
   =========================== */
export const eliminarVenta = async (req, res) => {
  const { id } = req.params;
  let connection;
  const warnings = [];
  try {
    connection = await getConnection();

    const det = await connection.execute(
      `SELECT 
         P.ID_PRODUCTO,
         P.NOMBRE_PRODUCTO,
         P.STOCK_ACTUAL,
         P.STOCK_MAXIMO,
         D.CANTIDAD_DETALLE_VENTA
       FROM DETALLES_VENTAS_PRODUCTOS D
       JOIN PRODUCTOS P ON P.ID_PRODUCTO = D.PRODUCTO_VENDIDO
      WHERE D.VENTA_ID = :id`,
      { id }
    );

    if (det.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    for (const [idProd, , stockAct, stockMax, qty] of det.rows) {
      const resultante = Number(stockAct) + Number(qty);
      if (resultante > Number(stockMax)) {
        warnings.push({
          code: 'STOCK_ABOVE_MAX',
          message: 'La restitución dejó el stock por encima del máximo configurado.',
          meta: { max: Number(stockMax), after: resultante, producto_id: Number(idProd) }
        });
      }
      await connection.execute(
        `UPDATE PRODUCTOS
            SET STOCK_ACTUAL = STOCK_ACTUAL + :qty
          WHERE ID_PRODUCTO = :prod`,
        { qty, prod: idProd }
      );
    }

    await connection.execute(`DELETE FROM DETALLES_VENTAS_PRODUCTOS WHERE VENTA_ID = :id`, { id });
    const r = await connection.execute(`DELETE FROM VENTAS WHERE ID_VENTA = :id`, { id });

    await connection.commit();
    await connection.close();

    if (r.rowsAffected === 0) return res.status(404).json({ message: 'Venta no encontrada.' });
    res.json({ ok: true, message: 'Venta eliminada correctamente.', warnings });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    try { await connection?.close(); } catch {}

    const nice = mapOracleStockError(error);
    if (nice) return res.status(400).json({ message: nice });
    console.error('Error al eliminar venta:', error);
    res.status(500).json({ message: 'Error al eliminar venta.' });
  }
};

/* ===========================
   ACTUALIZAR VENTA (bloquea sobreventa con base en reversión)
   =========================== */
export const actualizarVenta = async (req, res) => {
  const { id } = req.params;

  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ message: "Usuario no autenticado." });
  const { email: usuario, tipo_id } = authUser;

  const errorItems = validarItemsVenta(req.body?.productos);
  if (errorItems) return res.status(400).json({ message: errorItems });

  const productos = req.body.productos.map(p => ({
    id_producto: parseInt(p.id_producto, 10),
    cantidad: parseInt(p.cantidad, 10),
    precio_unitario: parseInt(p.precio_unitario, 10),
  }));

  let totalVenta = 0;
  for (const it of productos) totalVenta += it.cantidad * it.precio_unitario;
  if (!inRange(totalVenta, 1, LIMITE_TOTAL_VENTA)) {
    return res.status(400).json({
      message: `El total de la venta debe ser un entero entre 1 y ${LIMITE_TOTAL_VENTA.toLocaleString('es-CO')}.`,
    });
  }

  let connection;
  const warnings = [];
  try {
    connection = await getConnection();

    // Detalles actuales de la venta (para reversión lógica)
    const detActual = await connection.execute(
      `SELECT PRODUCTO_VENDIDO, CANTIDAD_DETALLE_VENTA
         FROM DETALLES_VENTAS_PRODUCTOS
        WHERE VENTA_ID = :id`,
      { id }
    );
    if (detActual.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    // Cantidades anteriores por producto
    const prevQuantByProd = new Map();
    for (const [prod, qty] of detActual.rows) {
      prevQuantByProd.set(prod, (prevQuantByProd.get(prod) || 0) + Number(qty));
    }

    // === BLOQUEAR SOBREVENTA EN ACTUALIZACIÓN ===
    // Disponibilidad base = stock_actual + cantidadAnterior (como si ya hubiéramos devuelto la venta previa)
    const ids = Array.from(new Set([...prevQuantByProd.keys(), ...productos.map(p => p.id_producto)]));
    const stocks = await getStocks(connection, ids);

    const solicitados = agruparCantidades(productos);
    const insuficientes = [];
    for (const idProd of solicitados.keys()) {
      const reqQty = solicitados.get(idProd) || 0;
      const s = stocks.get(idProd);
      const base = (s?.act ?? 0) + (prevQuantByProd.get(idProd) || 0);
      if (reqQty > base) {
        insuficientes.push({
          producto_id: idProd,
          nombre: s?.nombre || '',
          solicitado: reqQty,
          disponible: base,
          deficit: reqQty - base
        });
      }
    }
    if (insuficientes.length) {
      await connection.close();
      return res.status(400).json({
        code: 'STOCK_NOT_ENOUGH',
        message: 'No hay stock suficiente para actualizar la venta.',
        items: insuficientes
      });
    }

    // === Revertir stock anterior (puede dejar sobre máximo → warning) ===
    for (const [prod, qty] of detActual.rows) {
      const s = stocks.get(prod) || { act: 0, max: 0 };
      const resultante = s.act + Number(qty);
      if (resultante > s.max) {
        warnings.push({
          code: 'STOCK_ABOVE_MAX',
          message: 'La reversión de la venta dejó el stock por encima del máximo configurado.',
          meta: { max: s.max, after: resultante, producto_id: prod }
        });
      }
      await connection.execute(
        `UPDATE PRODUCTOS SET STOCK_ACTUAL = STOCK_ACTUAL + :qty WHERE ID_PRODUCTO = :prod`,
        { qty, prod }
      );
    }

    // Borrar detalles previos
    await connection.execute(`DELETE FROM DETALLES_VENTAS_PRODUCTOS WHERE VENTA_ID = :id`, { id });

    // Insertar nuevos detalles y debitar stock
    for (const it of productos) {
      await connection.execute(
        `INSERT INTO DETALLES_VENTAS_PRODUCTOS
           (ID_DETALLE_VENTA, CANTIDAD_DETALLE_VENTA, PRECIO_UNITARIO_DETALLE_VENTA, PRODUCTO_VENDIDO, VENTA_ID)
         VALUES (SEQ_ID_DETALLE_VENTA.NEXTVAL, :qty, :pu, :prod, :venta)`,
        { qty: it.cantidad, pu: it.precio_unitario, prod: it.id_producto, venta: id }
      );
      await connection.execute(
        `UPDATE PRODUCTOS SET STOCK_ACTUAL = STOCK_ACTUAL - :qty WHERE ID_PRODUCTO = :prod`,
        { qty: it.cantidad, prod: it.id_producto }
      );
    }

    // Warnings por quedar bajo el mínimo con los nuevos detalles
    const newIds = Array.from(new Set(productos.map(p => p.id_producto)));
    const after = await getStocks(connection, newIds);
    for (const [idProd, s] of after) {
      if (s.act < s.min) {
        warnings.push({
          code: 'STOCK_BELOW_MIN',
          message: 'El stock quedó por debajo del mínimo configurado.',
          meta: { min: s.min, after: s.act, producto_id: idProd }
        });
      }
    }

    // Actualizar cabecera
    const r = await connection.execute(
      `UPDATE VENTAS
          SET TOTAL_VENTA = :tot,
              VENTA_USUARIO = :u,
              VENTA_USUARIO_TIPO_ID = :t
        WHERE ID_VENTA = :id`,
      { tot: totalVenta, u: usuario, t: tipo_id, id }
    );

    await connection.commit();
    await connection.close();

    if (r.rowsAffected === 0) return res.status(404).json({ message: 'Venta no encontrada.' });
    res.json({ ok: true, message: 'Venta actualizada correctamente.', warnings });
  } catch (error) {
    try { await connection?.rollback(); } catch {}
    try { await connection?.close(); } catch {}

    const nice = mapOracleStockError(error);
    if (nice) return res.status(400).json({ message: nice });

    console.error('Error al actualizar venta:', error);
    res.status(500).json({ message: 'Error al actualizar venta.' });
  }
};

/* ===========================
   OBTENER VENTA POR ID
   =========================== */
export const obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    connection = await getConnection();

    const cab = await connection.execute(
      `SELECT ID_VENTA, VENTA_USUARIO, VENTA_USUARIO_TIPO_ID
         FROM VENTAS
        WHERE ID_VENTA = :id`,
      { id }
    );
    if (cab.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    const [id_venta, usuario, tipo_id] = cab.rows[0];

    const det = await connection.execute(
      `SELECT PRODUCTO_VENDIDO, CANTIDAD_DETALLE_VENTA, PRECIO_UNITARIO_DETALLE_VENTA
         FROM DETALLES_VENTAS_PRODUCTOS
        WHERE VENTA_ID = :id`,
      { id }
    );

    const productos = det.rows.map(([id_producto, cantidad, precio_unitario]) => ({
      id_producto, cantidad, precio_unitario,
    }));

    await connection.close();
    res.json({ id_venta, usuario, tipo_id, productos });
  } catch (error) {
    try { await connection?.close(); } catch {}
    console.error('Error al obtener venta:', error);
    res.status(500).json({ message: 'Error al obtener venta.' });
  }
};
