import db from "../config/db.js";

// ========== HELPERS ==========

/**
 * Obtener datos del usuario autenticado desde el JWT
 */
function getAuthUser(req) {
  const email = req?.user?.email || req?.user?.correo;
  const tipo_id = req?.user?.tipo_id || req?.user?.tipoIdentificacion;
  const identificacion = req?.user?.identificacion;

  if (!email || !tipo_id || !identificacion) return null;

  return {
    email,
    tipo_id: parseInt(tipo_id, 10),
    identificacion: String(identificacion),
  };
}

/**
 * Validar estructura del payload de venta
 */
function validarPayloadVenta(payload) {
  // Verificar que detalles sea un array
  if (!Array.isArray(payload.detalles)) {
    return {
      ok: false,
      message: "El campo 'detalles' debe ser un array de productos.",
    };
  }

  // Verificar que haya al menos 1 producto
  if (payload.detalles.length === 0) {
    return {
      ok: false,
      message: "Debes agregar al menos un producto a la venta.",
    };
  }

  // Verificar que no haya productos duplicados
  const idsProductos = payload.detalles.map((d) => Number(d.id_producto));
  const idsUnicos = new Set(idsProductos);
  if (idsUnicos.size !== idsProductos.length) {
    return {
      ok: false,
      message:
        "No puedes agregar el mismo producto dos veces. Suma las cantidades.",
    };
  }

  // Verificar que pagos sea un array
  if (!Array.isArray(payload.pagos)) {
    return { ok: false, message: "El campo 'pagos' debe ser un array." };
  }

  // Verificar que haya al menos 1 pago (venta al contado)
  if (payload.pagos.length === 0) {
    return {
      ok: false,
      message:
        "Debes agregar al menos un método de pago para ventas al contado.",
    };
  }

  // Validar cada detalle
  for (let i = 0; i < payload.detalles.length; i++) {
    const detalle = payload.detalles[i];

    // ID producto debe ser entero válido
    const idProducto = Number(detalle.id_producto);
    if (!Number.isInteger(idProducto) || idProducto <= 0) {
      return {
        ok: false,
        message: `Detalle ${i + 1}: El ID del producto debe ser un entero válido.`,
      };
    }

    // Cantidad debe ser número > 0
    const cantidad = Number(detalle.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return {
        ok: false,
        message: `Detalle ${i + 1}: La cantidad debe ser un número mayor a 0.`,
      };
    }
  }

  // Validar cada pago
  for (let i = 0; i < payload.pagos.length; i++) {
    const pago = payload.pagos[i];

    // ID método de pago debe ser entero válido
    const idMetodo = Number(pago.id_metodo_pago);
    if (!Number.isInteger(idMetodo) || idMetodo <= 0) {
      return {
        ok: false,
        message: `Pago ${i + 1}: El ID del método de pago debe ser un entero válido.`,
      };
    }

    // Monto debe ser número > 0
    const monto = Number(pago.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return {
        ok: false,
        message: `Pago ${i + 1}: El monto debe ser un número mayor a 0.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Validar que la fecha no sea futura
 */
function validarFechaVenta(fecha) {
  if (!fecha) return { ok: true }; // Opcional

  const fechaVenta = new Date(fecha);
  const ahora = new Date();

  if (isNaN(fechaVenta.getTime())) {
    return { ok: false, message: "La fecha de venta no es válida." };
  }

  if (fechaVenta > ahora) {
    return { ok: false, message: "La fecha de venta no puede ser futura." };
  }

  return { ok: true };
}

// ========== ENDPOINTS ==========

/**
 * GET /api/ventas
 * Listar todas las ventas
 */
export const listarVentas = async (req, res) => {
  try {
    const ventas = await db("ventas as v")
      .join("usuarios as u", function () {
        this.on(
          "v.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("v.identificacion_usuario", "u.identificacion_usuario");
      })
      .join(
        "tipos_identificacion as ti",
        "u.id_tipo_identificacion",
        "ti.id_tipo_identificacion",
      )
      .select(
        "v.id_venta",
        "v.fecha_venta",
        "v.total",
        "v.cliente_desc",
        "v.estado",
        "v.observaciones",
        "v.creado_en",
        db.raw(
          `CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario, ' ', COALESCE(u.apellido2_usuario, '')) as nombre_usuario`,
        ),
        "u.email_usuario",
        "ti.abreviatura_tipo_identificacion",
        "u.identificacion_usuario",
      )
      .orderBy("v.fecha_venta", "desc")
      .orderBy("v.id_venta", "desc");

    res.json(ventas);
  } catch (error) {
    console.error("Error al listar ventas:", error);
    res.status(500).json({ message: "Error al listar ventas." });
  }
};

/**
 * GET /api/ventas/:id
 * Obtener una venta específica con sus detalles y pagos
 */
export const obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener datos de la venta
    const venta = await db("ventas as v")
      .join("usuarios as u", function () {
        this.on(
          "v.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("v.identificacion_usuario", "u.identificacion_usuario");
      })
      .select(
        "v.*",
        db.raw(
          `CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario, ' ', COALESCE(u.apellido2_usuario, '')) as nombre_usuario`,
        ),
        "u.email_usuario",
      )
      .where("v.id_venta", id)
      .first();

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada." });
    }

    // Obtener detalles de la venta
    const detalles = await db("detalle_venta as dv")
      .join("productos as p", "dv.id_producto", "p.id_producto")
      .join(
        "unidades_medida as um",
        "p.id_unidad_medida",
        "um.id_unidad_medida",
      )
      .select(
        "dv.id_detalle_venta",
        "dv.id_producto",
        "p.nombre_producto",
        "p.descripcion_producto",
        "dv.cantidad_detalle_venta",
        "dv.precio_unitario_venta",
        "dv.subtotal_venta",
        "um.nombre_unidad_medida",
        "um.abreviatura_unidad_medida",
      )
      .where("dv.id_venta", id)
      .orderBy("dv.id_detalle_venta");

    // Obtener pagos de la venta
    const pagos = await db("ventas_pagos as vp")
      .join("metodos_pago as mp", "vp.id_metodo_pago", "mp.id_metodo_pago")
      .select(
        "vp.id_venta_pago",
        "vp.id_metodo_pago",
        "mp.nombre_metodo_pago",
        "vp.monto",
        "vp.fecha_pago",
        "vp.observaciones",
      )
      .where("vp.id_venta", id)
      .orderBy("vp.fecha_pago");

    res.json({
      ...venta,
      detalles,
      pagos,
    });
  } catch (error) {
    console.error("Error al obtener venta:", error);
    res.status(500).json({ message: "Error al obtener venta." });
  }
};

/**
 * POST /api/ventas
 * Crear una nueva venta (al contado, sin fiado en esta fase)
 * Requiere autenticación (JWT)
 */
export const crearVenta = async (req, res) => {
  const payload = { ...req.body };

  // VALIDACIÓN 1: Usuario autenticado
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res
      .status(401)
      .json({ message: "Usuario no autenticado. Se requiere token JWT." });
  }

  // VALIDACIÓN 2: Estructura del payload
  const validacionPayload = validarPayloadVenta(payload);
  if (!validacionPayload.ok) {
    return res.status(400).json({ message: validacionPayload.message });
  }

  // VALIDACIÓN 3: Fecha de venta
  const validacionFecha = validarFechaVenta(payload.fecha_venta);
  if (!validacionFecha.ok) {
    return res.status(400).json({ message: validacionFecha.message });
  }

  try {
    // TRANSACCIÓN: Todo o nada
    const resultado = await db.transaction(async (trx) => {
      // PASO 1: Validar productos y stock suficiente
      const productosValidados = [];

      for (const detalle of payload.detalles) {
        const producto = await trx("productos")
          .where("id_producto", detalle.id_producto)
          .where("activo", true)
          .first();

        if (!producto) {
          throw new Error(
            `El producto con ID ${detalle.id_producto} no existe o está inactivo.`,
          );
        }

        const cantidad = Number(detalle.cantidad);
        const stockDisponible = Number(producto.stock_actual);

        // VALIDACIÓN CRÍTICA: Stock suficiente
        if (stockDisponible < cantidad) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre_producto}". ` +
              `Disponible: ${stockDisponible}, Solicitado: ${cantidad}`,
          );
        }

        productosValidados.push({
          ...producto,
          cantidad_venta: cantidad,
        });
      }

      // PASO 2: Validar métodos de pago
      const pagosValidados = [];
      let totalPagos = 0;

      for (const pago of payload.pagos) {
        const metodo = await trx("metodos_pago")
          .where("id_metodo_pago", pago.id_metodo_pago)
          .where("activo", true)
          .first();

        if (!metodo) {
          throw new Error(
            `El método de pago con ID ${pago.id_metodo_pago} no existe o está inactivo.`,
          );
        }

        const monto = Number(pago.monto);
        totalPagos += monto;

        pagosValidados.push({
          id_metodo_pago: pago.id_metodo_pago,
          nombre_metodo: metodo.nombre_metodo_pago,
          monto: monto,
          observaciones: pago.observaciones || null,
        });
      }

      // PASO 3: Calcular total de la venta
      let totalVenta = 0;

      for (const prod of productosValidados) {
        const precioVenta = Number(prod.precio_venta);
        const cantidad = Number(prod.cantidad_venta);
        totalVenta += precioVenta * cantidad;
      }

      // PASO 4: Validar que pagos = total (venta al contado)
      if (totalPagos < totalVenta) {
        const faltante = totalVenta - totalPagos;
        throw new Error(
          `Pago insuficiente para venta al contado. ` +
            `Total: $${totalVenta.toLocaleString()}, Pagado: $${totalPagos.toLocaleString()}, Falta: $${faltante.toLocaleString()}`,
        );
      }

      if (totalPagos > totalVenta) {
        const exceso = totalPagos - totalVenta;
        throw new Error(
          `El total de pagos ($${totalPagos.toLocaleString()}) excede el total de la venta ($${totalVenta.toLocaleString()}) por $${exceso.toLocaleString()}`,
        );
      }

      // PASO 5: Crear registro de venta
      const [nuevaVenta] = await trx("ventas")
        .insert({
          fecha_venta: payload.fecha_venta || trx.fn.now(),
          total: totalVenta,
          es_fiado: false, // Siempre false en esta fase
          cliente_desc: payload.cliente_desc || null,
          saldo_pendiente: 0, // Siempre 0 en ventas al contado
          estado: "PAGADA", // Siempre PAGADA en ventas al contado
          id_tipo_identificacion_usuario: authUser.tipo_id,
          identificacion_usuario: authUser.identificacion,
          observaciones: payload.observaciones || null,
        })
        .returning("*");

      // PASO 6: Crear detalles de venta
      const detallesCreados = [];

      for (const prod of productosValidados) {
        const precioVenta = Number(prod.precio_venta);
        const cantidad = Number(prod.cantidad_venta);

        const [detalle] = await trx("detalle_venta")
          .insert({
            id_venta: nuevaVenta.id_venta,
            id_producto: prod.id_producto,
            cantidad_detalle_venta: cantidad,
            precio_unitario_venta: precioVenta,
            // subtotal_venta es GENERATED ALWAYS
          })
          .returning("*");

        detallesCreados.push({
          id_producto: prod.id_producto,
          nombre_producto: prod.nombre_producto,
          cantidad: cantidad,
          precio_unitario: precioVenta,
          subtotal: precioVenta * cantidad,
        });
      }

      // PASO 7: Decrementar stock de productos
      const warnings = [];
      const productosAfectados = [];

      for (const prod of productosValidados) {
        const stockAnterior = Number(prod.stock_actual);
        const stockNuevo = stockAnterior - Number(prod.cantidad_venta);

        await trx("productos")
          .where("id_producto", prod.id_producto)
          .update({ stock_actual: stockNuevo });

        productosAfectados.push({
          id_producto: prod.id_producto,
          nombre_producto: prod.nombre_producto,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
        });

        // Warning si stock queda bajo el mínimo
        if (stockNuevo < prod.stock_minimo) {
          warnings.push({
            tipo: "STOCK_BAJO_MINIMO",
            id_producto: prod.id_producto,
            nombre_producto: prod.nombre_producto,
            stock_nuevo: stockNuevo,
            stock_minimo: prod.stock_minimo,
            diferencia: prod.stock_minimo - stockNuevo,
            mensaje: `⚠️ El stock de "${prod.nombre_producto}" quedó por debajo del mínimo (${stockNuevo}/${prod.stock_minimo}).`,
          });
        }
      }

      // PASO 8: Registrar pagos
      const pagosRegistrados = [];

      for (const pago of pagosValidados) {
        const [pagoRegistrado] = await trx("ventas_pagos")
          .insert({
            id_venta: nuevaVenta.id_venta,
            id_metodo_pago: pago.id_metodo_pago,
            monto: pago.monto,
            fecha_pago: trx.fn.now(),
            observaciones: pago.observaciones,
          })
          .returning("*");

        pagosRegistrados.push({
          id_metodo_pago: pago.id_metodo_pago,
          nombre_metodo: pago.nombre_metodo,
          monto: pago.monto,
        });
      }

      // RETORNAR DATOS DE LA TRANSACCIÓN
      return {
        venta: nuevaVenta,
        detalles: detallesCreados,
        pagos: pagosRegistrados,
        productos_afectados: productosAfectados,
        warnings,
      };
    });

    console.log(
      `✅ Venta creada: ID ${resultado.venta.id_venta} | Total: $${resultado.venta.total}`,
    );
    console.log(
      `   Productos: ${resultado.detalles.length} | Pagos: ${resultado.pagos.length} | Warnings: ${resultado.warnings.length}`,
    );

    // RESPUESTA EXITOSA
    res.status(201).json({
      message: "Venta registrada correctamente.",
      venta: resultado.venta,
      detalles: resultado.detalles,
      pagos: resultado.pagos,
      productos_afectados: resultado.productos_afectados,
      warnings: resultado.warnings.length > 0 ? resultado.warnings : null,
    });
  } catch (error) {
    console.error("❌ Error al crear venta:", error);

    // Errores de validación lanzados en la transacción
    if (
      error.message &&
      (error.message.includes("no existe") ||
        error.message.includes("insuficiente") ||
        error.message.includes("Pago") ||
        error.message.includes("excede"))
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Error al crear venta." });
  }
};

/**
 * DELETE /api/ventas/:id
 * Eliminar una venta y revertir el stock
 * Requiere autenticación (JWT)
 */
export const eliminarVenta = async (req, res) => {
  const { id } = req.params;

  // Validar autenticación
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res
      .status(401)
      .json({ message: "Usuario no autenticado. Se requiere token JWT." });
  }

  try {
    await db.transaction(async (trx) => {
      // PASO 1: Verificar que la venta existe
      const venta = await trx("ventas").where("id_venta", id).first();

      if (!venta) {
        throw new Error("VENTA_NO_ENCONTRADA");
      }

      // PASO 2: Obtener detalles para revertir stock
      const detalles = await trx("detalle_venta").where("id_venta", id);

      if (detalles.length === 0) {
        console.log(
          `⚠️ Venta ${id} no tiene detalles (posible inconsistencia)`,
        );
      }

      // PASO 3: Revertir stock (incrementar lo que se había restado)
      for (const detalle of detalles) {
        const producto = await trx("productos")
          .where("id_producto", detalle.id_producto)
          .first();

        if (!producto) {
          throw new Error(`El producto ${detalle.id_producto} ya no existe.`);
        }

        const nuevoStock =
          Number(producto.stock_actual) +
          Number(detalle.cantidad_detalle_venta);

        await trx("productos")
          .where("id_producto", detalle.id_producto)
          .update({ stock_actual: nuevoStock });
      }

      // PASO 4: Eliminar pagos (CASCADE lo hace automático)
      await trx("ventas_pagos").where("id_venta", id).del();

      // PASO 5: Eliminar detalles (CASCADE lo hace automático)
      await trx("detalle_venta").where("id_venta", id).del();

      // PASO 6: Eliminar venta
      await trx("ventas").where("id_venta", id).del();
    });

    console.log(`✅ Venta ${id} eliminada y stock revertido`);

    res.json({
      message: "Venta eliminada correctamente y stock revertido.",
    });
  } catch (error) {
    console.error("❌ Error al eliminar venta:", error);

    if (error.message === "VENTA_NO_ENCONTRADA") {
      return res.status(404).json({ message: "Venta no encontrada." });
    }

    if (error.message && error.message.includes("ya no existe")) {
      return res.status(409).json({
        message: error.message,
        code: "PRODUCTO_NO_EXISTE",
      });
    }

    res.status(500).json({ message: "Error al eliminar venta." });
  }
};
