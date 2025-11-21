// src/controllers/ventas.controller.js
import db from '../config/db.js';

/* ===========================
   Helpers
   =========================== */

function getAuthUser(req) {
  const email = req?.user?.email || req?.user?.correo || req?.user?.usuario;
  const tipo_id =
    req?.user?.tipo_id ||
    req?.user?.tipo ||
    req?.user?.tipoIdentificacion ||
    req?.user?.tipo_identificacion;
  const identificacion = req?.user?.identificacion;

  if (!email || !tipo_id || !identificacion) return null;
  return { 
    email, 
    tipo_id: Number(tipo_id),
    identificacion: String(identificacion)
  };
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

// Obtener stocks de productos usando Knex
async function getStocks(trx, ids) {
  if (!ids.length) return new Map();
  
  const productos = await trx("productos")
    .select("id_producto", "nombre_producto", "stock_actual", "stock_minimo", "stock_maximo")
    .whereIn("id_producto", ids);
  
  const map = new Map();
  for (const p of productos) {
    map.set(p.id_producto, {
      nombre: p.nombre_producto,
      act: Number(p.stock_actual),
      min: Number(p.stock_minimo),
      max: Number(p.stock_maximo)
    });
  }
  return map; // Map<id, {nombre,act,min,max}>
}

/* ===========================
   CREAR VENTA (bloquea sobreventa)
   =========================== */
export const crearVenta = async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ message: "Usuario no autenticado." });

  // Validar que el usuario existe
  const usuarioExiste = await db("usuarios")
    .where("id_tipo_identificacion", authUser.tipo_id)
    .where("identificacion_usuario", authUser.identificacion)
    .where("activo", true)
    .first();

  if (!usuarioExiste) {
    return res.status(400).json({ 
      message: "El usuario autenticado no existe o está inactivo en la base de datos." 
    });
  }

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

  const warnings = [];
  try {
    const resultado = await db.transaction(async (trx) => {
      // === BLOQUEAR SOBREVENTA ===
      const agrupado = agruparCantidades(productos);
      const ids = Array.from(agrupado.keys());
      const stocks = await getStocks(trx, ids);

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
        throw new Error('STOCK_NOT_ENOUGH');
      }

      // === Registrar venta ===
      const [nuevaVenta] = await trx("ventas")
        .insert({
          fecha_venta: trx.fn.now(),
          total: 0, // Se calculará después
          id_tipo_identificacion_usuario: authUser.tipo_id,
          identificacion_usuario: authUser.identificacion,
        })
        .returning("*");

      const idVenta = nuevaVenta.id_venta;

      // Insertar detalles y actualizar stock
      for (const it of productos) {
        await trx("detalle_venta")
          .insert({
            id_venta: idVenta,
            id_producto: it.id_producto,
            cantidad_detalle_venta: it.cantidad,
            precio_unitario_venta: it.precio_unitario,
          });

        // Actualizar stock
        await trx("productos")
          .where("id_producto", it.id_producto)
          .decrement("stock_actual", it.cantidad);
      }

      // Actualizar total de la venta
      await trx("ventas")
        .where("id_venta", idVenta)
        .update({ total: totalVenta });

      // Verificar warnings por quedar bajo mínimo
      const after = await getStocks(trx, Array.from(new Set(productos.map(p => p.id_producto))));
      for (const [idProd, s] of after) {
        if (s.act < s.min) {
          warnings.push({
            code: 'STOCK_BELOW_MIN',
            message: 'El stock quedó por debajo del mínimo configurado.',
            meta: { min: s.min, after: s.act, producto_id: idProd }
          });
        }
      }

      return { id_venta: idVenta };
    });

    res.status(201).json({ 
      ok: true, 
      message: 'Venta registrada correctamente.', 
      id_venta: resultado.id_venta, 
      warnings: warnings.length > 0 ? warnings : null 
    });
  } catch (error) {
    if (error.message === 'STOCK_NOT_ENOUGH') {
      const agrupado = agruparCantidades(productos);
      const ids = Array.from(agrupado.keys());
      const stocks = await getStocks(db, ids);
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
      return res.status(400).json({
        code: 'STOCK_NOT_ENOUGH',
        message: 'No hay stock suficiente para completar la venta.',
        items: insuficientes
      });
    }

    console.error('Error al registrar venta:', error);
    return res.status(500).json({ message: 'Error al registrar venta.' });
  }
};

/* ===========================
   LISTAR VENTAS
   =========================== */
export const obtenerVentas = async (_req, res) => {
  try {
    const ventas = await db("ventas as v")
      .join("usuarios as u", function () {
        this.on(
          "v.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("v.identificacion_usuario", "u.identificacion_usuario");
      })
      .select(
        "v.id_venta",
        "v.fecha_venta",
        "v.total",
        db.raw(
          `CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario, ' ', COALESCE(u.apellido2_usuario, '')) as usuario`
        ),
        "u.id_tipo_identificacion as tipo_id"
      )
      .orderBy("v.fecha_venta", "desc")
      .orderBy("v.id_venta", "desc");

    // Formatear fecha a DD/MM/YYYY
    const ventasFormateadas = ventas.map(v => {
      let fecha = '';
      if (v.fecha_venta) {
        const d = new Date(v.fecha_venta);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        fecha = `${dd}/${mm}/${yyyy}`;
      }
      return {
        id_venta: v.id_venta,
        fecha: fecha,
        total: Number(v.total),
        usuario: v.usuario,
        tipo_id: v.tipo_id
      };
    });

    res.json(ventasFormateadas);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ message: 'Error al obtener ventas.' });
  }
};

/* ===========================
   ELIMINAR VENTA (restituye stock; puede dar warning de máximo)
   =========================== */
export const eliminarVenta = async (req, res) => {
  const { id } = req.params;
  const warnings = [];
  
  try {
    await db.transaction(async (trx) => {
      // Obtener detalles de la venta
      const detalles = await trx("detalle_venta as dv")
        .join("productos as p", "dv.id_producto", "p.id_producto")
        .select(
          "dv.id_producto",
          "p.nombre_producto",
          "p.stock_actual",
          "p.stock_maximo",
          "dv.cantidad_detalle_venta"
        )
        .where("dv.id_venta", id);

      if (detalles.length === 0) {
        throw new Error("VENTA_NO_ENCONTRADA");
      }

      // Verificar warnings y restituir stock
      for (const det of detalles) {
        const stockActual = Number(det.stock_actual);
        const cantidad = Number(det.cantidad_detalle_venta);
        const stockMaximo = Number(det.stock_maximo);
        const resultante = stockActual + cantidad;
        
        if (resultante > stockMaximo) {
          warnings.push({
            code: 'STOCK_ABOVE_MAX',
            message: 'La restitución dejó el stock por encima del máximo configurado.',
            meta: { 
              max: stockMaximo, 
              after: resultante, 
              producto_id: det.id_producto,
              nombre: det.nombre_producto
            }
          });
        }

        // Restituir stock
        await trx("productos")
          .where("id_producto", det.id_producto)
          .increment("stock_actual", cantidad);
      }

      // Eliminar detalles (CASCADE lo hace automático, pero por claridad)
      await trx("detalle_venta").where("id_venta", id).del();

      // Eliminar venta
      const eliminados = await trx("ventas").where("id_venta", id).del();
      
      if (eliminados === 0) {
        throw new Error("VENTA_NO_ENCONTRADA");
      }
    });

    res.json({ 
      ok: true, 
      message: 'Venta eliminada correctamente.', 
      warnings: warnings.length > 0 ? warnings : null 
    });
  } catch (error) {
    if (error.message === "VENTA_NO_ENCONTRADA") {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

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

  const warnings = [];
  try {
    await db.transaction(async (trx) => {
      // Obtener detalles actuales de la venta
      const detActual = await trx("detalle_venta")
        .select("id_producto", "cantidad_detalle_venta")
        .where("id_venta", id);

      if (detActual.length === 0) {
        throw new Error("VENTA_NO_ENCONTRADA");
      }

      // Cantidades anteriores por producto
      const prevQuantByProd = new Map();
      for (const det of detActual) {
        const prodId = det.id_producto;
        const qty = Number(det.cantidad_detalle_venta);
        prevQuantByProd.set(prodId, (prevQuantByProd.get(prodId) || 0) + qty);
      }

      // === BLOQUEAR SOBREVENTA EN ACTUALIZACIÓN ===
      const ids = Array.from(new Set([...prevQuantByProd.keys(), ...productos.map(p => p.id_producto)]));
      const stocks = await getStocks(trx, ids);

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
        throw new Error('STOCK_NOT_ENOUGH');
      }

      // === Revertir stock anterior ===
      for (const det of detActual) {
        const prodId = det.id_producto;
        const qty = Number(det.cantidad_detalle_venta);
        const s = stocks.get(prodId) || { act: 0, max: 0 };
        const resultante = s.act + qty;
        
        if (resultante > s.max) {
          warnings.push({
            code: 'STOCK_ABOVE_MAX',
            message: 'La reversión de la venta dejó el stock por encima del máximo configurado.',
            meta: { max: s.max, after: resultante, producto_id: prodId }
          });
        }

        await trx("productos")
          .where("id_producto", prodId)
          .increment("stock_actual", qty);
      }

      // Borrar detalles previos
      await trx("detalle_venta").where("id_venta", id).del();

      // Insertar nuevos detalles y debitar stock
      for (const it of productos) {
        await trx("detalle_venta")
          .insert({
            id_venta: id,
            id_producto: it.id_producto,
            cantidad_detalle_venta: it.cantidad,
            precio_unitario_venta: it.precio_unitario,
          });

        await trx("productos")
          .where("id_producto", it.id_producto)
          .decrement("stock_actual", it.cantidad);
      }

      // Warnings por quedar bajo el mínimo con los nuevos detalles
      const newIds = Array.from(new Set(productos.map(p => p.id_producto)));
      const after = await getStocks(trx, newIds);
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
      const actualizados = await trx("ventas")
        .where("id_venta", id)
        .update({
          total: totalVenta,
          id_tipo_identificacion_usuario: authUser.tipo_id,
          identificacion_usuario: authUser.identificacion,
        });

      if (actualizados === 0) {
        throw new Error("VENTA_NO_ENCONTRADA");
      }
    });

    res.json({ 
      ok: true, 
      message: 'Venta actualizada correctamente.', 
      warnings: warnings.length > 0 ? warnings : null 
    });
  } catch (error) {
    if (error.message === "VENTA_NO_ENCONTRADA") {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    if (error.message === 'STOCK_NOT_ENOUGH') {
      // Recalcular insuficientes para el error
      const detActual = await db("detalle_venta")
        .select("id_producto", "cantidad_detalle_venta")
        .where("id_venta", id);
      
      const prevQuantByProd = new Map();
      for (const det of detActual) {
        const prodId = det.id_producto;
        const qty = Number(det.cantidad_detalle_venta);
        prevQuantByProd.set(prodId, (prevQuantByProd.get(prodId) || 0) + qty);
      }

      const ids = Array.from(new Set([...prevQuantByProd.keys(), ...productos.map(p => p.id_producto)]));
      const stocks = await getStocks(db, ids);
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
      return res.status(400).json({
        code: 'STOCK_NOT_ENOUGH',
        message: 'No hay stock suficiente para actualizar la venta.',
        items: insuficientes
      });
    }

    console.error('Error al actualizar venta:', error);
    res.status(500).json({ message: 'Error al actualizar venta.' });
  }
};

/* ===========================
   OBTENER VENTA POR ID
   =========================== */
export const obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const venta = await db("ventas")
      .where("id_venta", id)
      .first();

    if (!venta) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    const detalles = await db("detalle_venta")
      .select(
        "id_producto",
        "cantidad_detalle_venta as cantidad",
        "precio_unitario_venta as precio_unitario"
      )
      .where("id_venta", id);

    res.json({ 
      id_venta: venta.id_venta, 
      usuario: venta.identificacion_usuario, 
      tipo_id: venta.id_tipo_identificacion_usuario, 
      productos: detalles 
    });
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ message: 'Error al obtener venta.' });
  }
};
