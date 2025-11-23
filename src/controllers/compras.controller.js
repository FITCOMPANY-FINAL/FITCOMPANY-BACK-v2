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
 * Validar estructura del payload de compra
 */
function validarPayloadCompra(payload) {
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
      message: "Debes agregar al menos un producto a la compra.",
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

    // Precio debe ser número >= 0
    const precio = Number(detalle.precio_unitario);
    if (!Number.isFinite(precio) || precio < 0) {
      return {
        ok: false,
        message: `Detalle ${i + 1}: El precio unitario no puede ser negativo.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Validar que la fecha no sea futura
 */
function validarFechaCompra(fecha) {
  if (!fecha) return { ok: true }; // Opcional

  const fechaCompra = new Date(fecha);
  const ahora = new Date();

  if (isNaN(fechaCompra.getTime())) {
    return { ok: false, message: "La fecha de compra no es válida." };
  }

  if (fechaCompra > ahora) {
    return { ok: false, message: "La fecha de compra no puede ser futura." };
  }

  return { ok: true };
}

// ========== ENDPOINTS ==========

/**
 * GET /api/compras
 * Listar todas las compras con información del usuario
 */
export const listarCompras = async (req, res) => {
  try {
    const compras = await db("compras as c")
      .join("usuarios as u", function () {
        this.on(
          "c.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("c.identificacion_usuario", "u.identificacion_usuario");
      })
      .join(
        "tipos_identificacion as ti",
        "u.id_tipo_identificacion",
        "ti.id_tipo_identificacion",
      )
      .select(
        "c.id_compra",
        "c.fecha_compra",
        "c.total",
        "c.observaciones",
        "c.creado_en",
        db.raw(
          `CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario, ' ', COALESCE(u.apellido2_usuario, '')) as nombre_usuario`,
        ),
        "u.email_usuario",
        "ti.abreviatura_tipo_identificacion",
        "u.identificacion_usuario",
      )
      .orderBy("c.fecha_compra", "desc")
      .orderBy("c.id_compra", "desc");

    // Obtener detalles de productos para cada compra
    const comprasConDetalles = await Promise.all(
      compras.map(async (compra) => {
        const detalles = await db("detalle_compra as dc")
          .join("productos as p", "dc.id_producto", "p.id_producto")
          .select(
            "p.nombre_producto",
            "dc.cantidad_detalle_compra",
          )
          .where("dc.id_compra", compra.id_compra)
          .orderBy("dc.id_detalle_compra");

        return {
          ...compra,
          detalles: detalles,
        };
      })
    );

    res.json(comprasConDetalles);
  } catch (error) {
    console.error("Error al listar compras:", error);
    res.status(500).json({ message: "Error al listar compras." });
  }
};

/**
 * GET /api/compras/:id
 * Obtener una compra específica con sus detalles
 */
export const obtenerCompraPorId = async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener datos de la compra
    const compra = await db("compras as c")
      .join("usuarios as u", function () {
        this.on(
          "c.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("c.identificacion_usuario", "u.identificacion_usuario");
      })
      .select(
        "c.*",
        db.raw(
          `CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario, ' ', COALESCE(u.apellido2_usuario, '')) as nombre_usuario`,
        ),
        "u.email_usuario",
      )
      .where("c.id_compra", id)
      .first();

    if (!compra) {
      return res.status(404).json({ message: "Compra no encontrada." });
    }

    // Obtener detalles de la compra
    const detalles = await db("detalle_compra as dc")
      .join("productos as p", "dc.id_producto", "p.id_producto")
      .join(
        "unidades_medida as um",
        "p.id_unidad_medida",
        "um.id_unidad_medida",
      )
      .select(
        "dc.id_detalle_compra",
        "dc.id_producto",
        "p.nombre_producto",
        "p.descripcion_producto",
        "dc.cantidad_detalle_compra",
        "dc.precio_unitario_compra",
        "dc.subtotal_compra",
        "um.nombre_unidad_medida",
        "um.abreviatura_unidad_medida",
      )
      .where("dc.id_compra", id)
      .orderBy("dc.id_detalle_compra");

    res.json({
      ...compra,
      detalles,
    });
  } catch (error) {
    console.error("Error al obtener compra:", error);
    res.status(500).json({ message: "Error al obtener compra." });
  }
};

/**
 * POST /api/compras
 * Crear una nueva compra con múltiples productos
 * Requiere autenticación (JWT)
 */
export const crearCompra = async (req, res) => {
  const payload = { ...req.body };

  // VALIDACIÓN 1: Usuario autenticado
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res
      .status(401)
      .json({ message: "Usuario no autenticado. Se requiere token JWT." });
  }

  // VALIDACIÓN 2: Estructura del payload
  const validacionPayload = validarPayloadCompra(payload);
  if (!validacionPayload.ok) {
    return res.status(400).json({ message: validacionPayload.message });
  }

  // VALIDACIÓN 3: Fecha de compra
  const validacionFecha = validarFechaCompra(payload.fecha_compra);
  if (!validacionFecha.ok) {
    return res.status(400).json({ message: validacionFecha.message });
  }

  try {
    // TRANSACCIÓN: Todo o nada
    const resultado = await db.transaction(async (trx) => {
      // PASO 0: Validar que el usuario autenticado existe en la base de datos
      const usuarioExiste = await trx("usuarios")
        .where("id_tipo_identificacion", authUser.tipo_id)
        .where("identificacion_usuario", authUser.identificacion)
        .where("activo", true)
        .first();

      if (!usuarioExiste) {
        throw new Error(
          `El usuario autenticado (tipo: ${authUser.tipo_id}, identificación: ${authUser.identificacion}) no existe o está inactivo en la base de datos.`,
        );
      }

      // PASO 1: Validar que todos los productos existan y estén activos
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

        productosValidados.push({
          ...producto,
          cantidad_compra: Number(detalle.cantidad),
          precio_compra: Number(detalle.precio_unitario),
        });
      }

      // PASO 2: Crear registro principal de compra
      const [nuevaCompra] = await trx("compras")
        .insert({
          fecha_compra: payload.fecha_compra || trx.fn.now(),
          total: 0, // Se calculará después
          observaciones: payload.observaciones || null,
          id_tipo_identificacion_usuario: authUser.tipo_id,
          identificacion_usuario: authUser.identificacion,
        })
        .returning("*");

      // PASO 3: Crear detalles y calcular total
      let totalCompra = 0;
      const detallesCreados = [];
      const productosAfectados = [];

      for (const prod of productosValidados) {
        const subtotal = prod.cantidad_compra * prod.precio_compra;
        totalCompra += subtotal;

        // Insertar detalle
        const [detalleCreado] = await trx("detalle_compra")
          .insert({
            id_compra: nuevaCompra.id_compra,
            id_producto: prod.id_producto,
            cantidad_detalle_compra: prod.cantidad_compra,
            precio_unitario_compra: prod.precio_compra,
            // subtotal_compra es GENERATED ALWAYS
          })
          .returning("*");

        detallesCreados.push({
          ...detalleCreado,
          nombre_producto: prod.nombre_producto,
          stock_anterior: prod.stock_actual,
        });

        productosAfectados.push({
          id_producto: prod.id_producto,
          nombre_producto: prod.nombre_producto,
          stock_anterior: Number(prod.stock_actual),
          cantidad_agregada: prod.cantidad_compra,
          stock_maximo: Number(prod.stock_maximo),
        });
      }

      // PASO 4: Actualizar total de la compra
      await trx("compras")
        .where("id_compra", nuevaCompra.id_compra)
        .update({ total: totalCompra });

      // PASO 5: Incrementar stock de productos
      const warnings = [];

      for (const prod of productosAfectados) {
        const stockNuevo = prod.stock_anterior + prod.cantidad_agregada;

        await trx("productos")
          .where("id_producto", prod.id_producto)
          .update({ stock_actual: stockNuevo });

        // PASO 6: Generar warnings si supera stock máximo
        if (stockNuevo > prod.stock_maximo) {
          warnings.push({
            tipo: "STOCK_SOBRE_MAXIMO",
            id_producto: prod.id_producto,
            nombre_producto: prod.nombre_producto,
            stock_anterior: prod.stock_anterior,
            stock_nuevo: stockNuevo,
            stock_maximo: prod.stock_maximo,
            diferencia: stockNuevo - prod.stock_maximo,
            mensaje: `El stock de "${prod.nombre_producto}" superó el máximo recomendado (${stockNuevo}/${prod.stock_maximo}).`,
          });
        }
      }

      // RETORNAR DATOS DE LA TRANSACCIÓN
      return {
        compra: {
          ...nuevaCompra,
          total: totalCompra,
        },
        detalles: detallesCreados.map((d) => ({
          id_producto: d.id_producto,
          nombre_producto: d.nombre_producto,
          cantidad: d.cantidad_detalle_compra,
          precio_unitario: d.precio_unitario_compra,
          subtotal: d.subtotal_compra,
        })),
        productos_afectados: productosAfectados.map((p) => ({
          id_producto: p.id_producto,
          nombre_producto: p.nombre_producto,
          stock_anterior: p.stock_anterior,
          stock_nuevo: p.stock_anterior + p.cantidad_agregada,
        })),
        warnings,
      };
    });

    console.log(
      `✅ Compra creada: ID ${resultado.compra.id_compra} | Total: $${resultado.compra.total}`,
    );
    console.log(
      `   Productos: ${resultado.detalles.length} | Warnings: ${resultado.warnings.length}`,
    );

    // RESPUESTA EXITOSA
    res.status(201).json({
      message: "Compra registrada correctamente.",
      compra: resultado.compra,
      detalles: resultado.detalles,
      productos_afectados: resultado.productos_afectados,
      warnings: resultado.warnings.length > 0 ? resultado.warnings : null,
    });
  } catch (error) {
    console.error("❌ Error al crear compra:", error);

    // Error de validación lanzado en la transacción
    if (error.message && (error.message.includes("no existe") || error.message.includes("no está presente"))) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message && error.message.includes("no válida")) {
      return res.status(400).json({ message: error.message });
    }

    // Error de foreign key (usuario no existe)
    if (error.code === '23503' && error.constraint?.includes('usuarios')) {
      return res.status(400).json({ 
        message: `El usuario autenticado no existe o está inactivo en la base de datos. Por favor, cierra sesión y vuelve a iniciar sesión.` 
      });
    }

    res.status(500).json({ message: "Error al crear compra." });
  }
};

/**
 * PUT /api/compras/:id
 * Actualizar una compra existente
 * Requiere autenticación (JWT)
 */
export const actualizarCompra = async (req, res) => {
  const { id } = req.params;
  const payload = { ...req.body };

  // VALIDACIÓN 1: Usuario autenticado
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res
      .status(401)
      .json({ message: "Usuario no autenticado. Se requiere token JWT." });
  }

  // VALIDACIÓN 2: Estructura del payload
  const validacionPayload = validarPayloadCompra(payload);
  if (!validacionPayload.ok) {
    return res.status(400).json({ message: validacionPayload.message });
  }

  // VALIDACIÓN 3: Fecha de compra
  const validacionFecha = validarFechaCompra(payload.fecha_compra);
  if (!validacionFecha.ok) {
    return res.status(400).json({ message: validacionFecha.message });
  }

  try {
    // TRANSACCIÓN: Todo o nada
    const resultado = await db.transaction(async (trx) => {
      // PASO 0: Validar que el usuario autenticado existe
      const usuarioExiste = await trx("usuarios")
        .where("id_tipo_identificacion", authUser.tipo_id)
        .where("identificacion_usuario", authUser.identificacion)
        .where("activo", true)
        .first();

      if (!usuarioExiste) {
        throw new Error(
          `El usuario autenticado (tipo: ${authUser.tipo_id}, identificación: ${authUser.identificacion}) no existe o está inactivo en la base de datos.`,
        );
      }

      // PASO 1: Verificar que la compra existe
      const compraExistente = await trx("compras")
        .where("id_compra", id)
        .first();

      if (!compraExistente) {
        throw new Error("COMPRA_NO_ENCONTRADA");
      }

      // PASO 2: Obtener detalles actuales para revertir stock
      const detallesActuales = await trx("detalle_compra")
        .where("id_compra", id);

      // PASO 3: Revertir stock anterior (restar lo que se había sumado)
      for (const detalle of detallesActuales) {
        const producto = await trx("productos")
          .where("id_producto", detalle.id_producto)
          .first();

        if (!producto) {
          throw new Error(`El producto ${detalle.id_producto} ya no existe.`);
        }

        const stockAnterior = Number(producto.stock_actual);
        const cantidadARevertir = Number(detalle.cantidad_detalle_compra);
        const nuevoStock = stockAnterior - cantidadARevertir;

        if (nuevoStock < 0) {
          throw new Error(
            `No se puede actualizar la compra porque el producto "${producto.nombre_producto}" ` +
              `quedaría con stock negativo (${nuevoStock}) al revertir la compra anterior. Posiblemente ya se vendió parte del stock.`,
          );
        }

        await trx("productos")
          .where("id_producto", detalle.id_producto)
          .update({ stock_actual: nuevoStock });
      }

      // PASO 4: Validar que todos los nuevos productos existan y estén activos
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

        productosValidados.push({
          ...producto,
          cantidad_compra: Number(detalle.cantidad),
          precio_compra: Number(detalle.precio_unitario),
        });
      }

      // PASO 5: Eliminar detalles antiguos
      await trx("detalle_compra").where("id_compra", id).del();

      // PASO 6: Crear nuevos detalles y calcular total
      let totalCompra = 0;
      const detallesCreados = [];
      const productosAfectados = [];

      for (const prod of productosValidados) {
        const subtotal = prod.cantidad_compra * prod.precio_compra;
        totalCompra += subtotal;

        // Insertar nuevo detalle
        const [detalleCreado] = await trx("detalle_compra")
          .insert({
            id_compra: id,
            id_producto: prod.id_producto,
            cantidad_detalle_compra: prod.cantidad_compra,
            precio_unitario_compra: prod.precio_compra,
          })
          .returning("*");

        detallesCreados.push({
          ...detalleCreado,
          nombre_producto: prod.nombre_producto,
        });

        // Obtener stock actual después de la reversión
        const productoActualizado = await trx("productos")
          .where("id_producto", prod.id_producto)
          .first();

        const stockAnterior = Number(productoActualizado.stock_actual);
        const stockNuevo = stockAnterior + prod.cantidad_compra;

        productosAfectados.push({
          id_producto: prod.id_producto,
          nombre_producto: prod.nombre_producto,
          stock_anterior: stockAnterior,
          cantidad_agregada: prod.cantidad_compra,
          stock_nuevo: stockNuevo,
          stock_maximo: Number(prod.stock_maximo),
        });

        // PASO 7: Aplicar nuevo stock
        await trx("productos")
          .where("id_producto", prod.id_producto)
          .update({ stock_actual: stockNuevo });
      }

      // PASO 8: Actualizar compra (total, fecha, observaciones)
      await trx("compras")
        .where("id_compra", id)
        .update({
          fecha_compra: payload.fecha_compra || compraExistente.fecha_compra,
          total: totalCompra,
          observaciones: payload.observaciones !== undefined ? payload.observaciones : compraExistente.observaciones,
        });

      // PASO 9: Generar warnings si supera stock máximo
      const warnings = [];

      for (const prod of productosAfectados) {
        if (prod.stock_nuevo > prod.stock_maximo) {
          warnings.push({
            tipo: "STOCK_SOBRE_MAXIMO",
            id_producto: prod.id_producto,
            nombre_producto: prod.nombre_producto,
            stock_anterior: prod.stock_anterior,
            stock_nuevo: prod.stock_nuevo,
            stock_maximo: prod.stock_maximo,
            diferencia: prod.stock_nuevo - prod.stock_maximo,
            mensaje: `El stock de "${prod.nombre_producto}" superó el máximo recomendado (${prod.stock_nuevo}/${prod.stock_maximo}).`,
          });
        }
      }

      // Obtener compra actualizada
      const compraActualizada = await trx("compras")
        .where("id_compra", id)
        .first();

      return {
        compra: compraActualizada,
        detalles: detallesCreados.map((d) => ({
          id_producto: d.id_producto,
          nombre_producto: d.nombre_producto,
          cantidad: d.cantidad_detalle_compra,
          precio_unitario: d.precio_unitario_compra,
          subtotal: d.subtotal_compra,
        })),
        productos_afectados: productosAfectados.map((p) => ({
          id_producto: p.id_producto,
          nombre_producto: p.nombre_producto,
          stock_anterior: p.stock_anterior,
          stock_nuevo: p.stock_nuevo,
        })),
        warnings,
      };
    });

    console.log(
      `✅ Compra actualizada: ID ${id} | Total: $${resultado.compra.total}`,
    );
    console.log(
      `   Productos: ${resultado.detalles.length} | Warnings: ${resultado.warnings.length}`,
    );

    // RESPUESTA EXITOSA
    res.json({
      message: "Compra actualizada correctamente.",
      compra: resultado.compra,
      detalles: resultado.detalles,
      productos_afectados: resultado.productos_afectados,
      warnings: resultado.warnings.length > 0 ? resultado.warnings : null,
    });
  } catch (error) {
    console.error("❌ Error al actualizar compra:", error);

    if (error.message === "COMPRA_NO_ENCONTRADA") {
      return res.status(404).json({ message: "Compra no encontrada." });
    }

    // Error de validación lanzado en la transacción
    if (error.message && (error.message.includes("no existe") || error.message.includes("no está presente"))) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message && error.message.includes("no válida")) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message && error.message.includes("stock negativo")) {
      return res.status(409).json({
        message: error.message,
        code: "STOCK_INSUFICIENTE",
      });
    }

    // Error de foreign key (usuario no existe)
    if (error.code === '23503' && error.constraint?.includes('usuarios')) {
      return res.status(400).json({ 
        message: `El usuario autenticado no existe o está inactivo en la base de datos. Por favor, cierra sesión y vuelve a iniciar sesión.` 
      });
    }

    res.status(500).json({ message: "Error al actualizar compra." });
  }
};

/**
 * DELETE /api/compras/:id
 * Eliminar una compra y revertir el stock
 * Requiere autenticación (JWT)
 */
export const eliminarCompra = async (req, res) => {
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
      // PASO 1: Verificar que la compra existe
      const compra = await trx("compras").where("id_compra", id).first();

      if (!compra) {
        throw new Error("COMPRA_NO_ENCONTRADA");
      }

      // PASO 2: Obtener detalles para revertir stock
      const detalles = await trx("detalle_compra").where("id_compra", id);

      if (detalles.length === 0) {
        console.log(
          `⚠️ Compra ${id} no tiene detalles (posible inconsistencia)`,
        );
      }

      // PASO 3: Revertir stock (decrementar lo que se había sumado)
      for (const detalle of detalles) {
        // Verificar que el producto todavía tenga suficiente stock
        const producto = await trx("productos")
          .where("id_producto", detalle.id_producto)
          .first();

        if (!producto) {
          throw new Error(`El producto ${detalle.id_producto} ya no existe.`);
        }

        const nuevoStock =
          Number(producto.stock_actual) -
          Number(detalle.cantidad_detalle_compra);

        if (nuevoStock < 0) {
          throw new Error(
            `No se puede eliminar la compra porque el producto "${producto.nombre_producto}" ` +
              `quedaría con stock negativo (${nuevoStock}). Posiblemente ya se vendió parte del stock.`,
          );
        }

        await trx("productos")
          .where("id_producto", detalle.id_producto)
          .update({ stock_actual: nuevoStock });
      }

      // PASO 4: Eliminar detalles (CASCADE lo hace automático, pero por claridad)
      await trx("detalle_compra").where("id_compra", id).del();

      // PASO 5: Eliminar compra
      await trx("compras").where("id_compra", id).del();
    });

    console.log(`✅ Compra ${id} eliminada y stock revertido`);

    res.json({
      message: "Compra eliminada correctamente y stock revertido.",
    });
  } catch (error) {
    console.error("❌ Error al eliminar compra:", error);

    if (error.message === "COMPRA_NO_ENCONTRADA") {
      return res.status(404).json({ message: "Compra no encontrada." });
    }

    if (error.message && error.message.includes("stock negativo")) {
      return res.status(409).json({
        message: error.message,
        code: "STOCK_INSUFICIENTE",
      });
    }

    if (error.message && error.message.includes("ya no existe")) {
      return res.status(409).json({
        message: error.message,
        code: "PRODUCTO_NO_EXISTE",
      });
    }

    res.status(500).json({ message: "Error al eliminar compra." });
  }
};
