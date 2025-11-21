import db from "../config/db.js";

// ---------- Helpers de normalización/validación ----------
const collapseSpaces = (s) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

const MAX_NOMBRE = 150; // Según schema PostgreSQL
const MAX_DESC = 500; // TEXT permite más, pero ponemos límite razonable
// Letras con acentos, dígitos, espacios y signos típicos de catálogo
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-./()%+]+$/;

const PRECIO_MAX = 99999999.99; // NUMERIC(12,2)

// Comparación canónica: ignora mayúsculas y elimina TODOS los espacios
async function existeNombreCanonico(nombre, excludeId = null) {
  const nombreLimpio = nombre.toLowerCase().replace(/\s+/g, "");

  let query = db("productos")
    .whereRaw(`LOWER(REPLACE(nombre_producto, ' ', '')) = ?`, [nombreLimpio])
    .where("activo", true);

  if (excludeId) {
    query = query.whereNot("id_producto", excludeId);
  }

  const resultado = await query.first();
  return !!resultado;
}

// Validar que una FK existe y está activa
async function fkExiste(tabla, columna, id, campoActivo = "activo") {
  const resultado = await db(tabla)
    .where(columna, id)
    .where(campoActivo, true)
    .first();
  return !!resultado;
}

function validarPayloadProducto(p) {
  // Normaliza strings
  p.nombre_producto = collapseSpaces(p.nombre_producto ?? "");
  p.descripcion_producto = collapseSpaces(p.descripcion_producto ?? "");

  // Coerción a número
  const toNum = (v) =>
    v === "" || v === null || v === undefined ? NaN : Number(v);
  
  // Aceptar tanto nombres del frontend como del backend para compatibilidad
  // precio_unitario del frontend se mapea a precio_venta
  if (p.precio_unitario !== undefined && p.precio_venta === undefined) {
    p.precio_venta = toNum(p.precio_unitario);
  }
  p.precio_costo = toNum(p.precio_costo ?? 0); // Por defecto 0 si no viene
  p.precio_venta = toNum(p.precio_venta);
  
  p.stock_actual = toNum(p.stock_actual);
  p.stock_minimo = toNum(p.stock_minimo);
  p.stock_maximo = toNum(p.stock_maximo);
  
  // Aceptar tanto unidad_medida como id_unidad_medida
  if (p.unidad_medida !== undefined && p.id_unidad_medida === undefined) {
    p.id_unidad_medida = toNum(p.unidad_medida);
  }
  p.id_unidad_medida = toNum(p.id_unidad_medida);
  
  // Aceptar tanto producto_categoria como id_categoria
  if (p.producto_categoria !== undefined && p.id_categoria === undefined) {
    p.id_categoria = toNum(p.producto_categoria);
  }
  p.id_categoria = toNum(p.id_categoria);

  // Validaciones de nombre
  if (!p.nombre_producto)
    return { ok: false, message: "El nombre es obligatorio." };
  if (p.nombre_producto.length > MAX_NOMBRE)
    return {
      ok: false,
      message: `El nombre admite máximo ${MAX_NOMBRE} caracteres.`,
    };
  if (!PATRON_NOMBRE.test(p.nombre_producto))
    return {
      ok: false,
      message:
        "El nombre solo puede contener letras, números, espacios y - . / ( ) % +.",
    };

  if (p.descripcion_producto && p.descripcion_producto.length > MAX_DESC)
    return {
      ok: false,
      message: `La descripción admite máximo ${MAX_DESC} caracteres.`,
    };

  // Validaciones de precios
  if (!Number.isFinite(p.precio_costo) || p.precio_costo < 0)
    return {
      ok: false,
      message: "El precio de costo debe ser un número mayor o igual a cero.",
    };
  if (p.precio_costo > PRECIO_MAX)
    return {
      ok: false,
      message: `El precio de costo máximo permitido es ${PRECIO_MAX}.`,
    };

  if (!Number.isFinite(p.precio_venta) || p.precio_venta <= 0)
    return {
      ok: false,
      message: "El precio de venta debe ser un número mayor a cero.",
    };
  if (p.precio_venta > PRECIO_MAX)
    return {
      ok: false,
      message: `El precio de venta máximo permitido es ${PRECIO_MAX}.`,
    };

  // Validación: precio de venta debe ser >= precio de costo (para tener ganancia)
  if (p.precio_venta < p.precio_costo)
    return {
      ok: false,
      message: "El precio de venta no puede ser menor que el precio de costo.",
    };

  
  // Validaciones de stock
  for (const [campo, valor] of [
    ["stock_actual", p.stock_actual],
    ["stock_minimo", p.stock_minimo],
    ["stock_maximo", p.stock_maximo],
  ]) {
    if (!Number.isFinite(valor) || valor < 0)
      return {
        ok: false,
        message: `El ${campo.replace("_", " ")} debe ser un número mayor o igual a 0.`,
      };
  }

  if (p.stock_maximo === 0)
    return { ok: false, message: "El stock máximo debe ser mayor a 0." };

  if (p.stock_minimo > p.stock_maximo)
    return {
      ok: false,
      message: "El stock mínimo no puede ser mayor que el stock máximo.",
    };

  if (p.stock_actual < p.stock_minimo || p.stock_actual > p.stock_maximo)
    return {
      ok: false,
      message:
        "El stock actual debe estar entre el stock mínimo y el stock máximo.",
    };

  // Validaciones de FKs
  if (!Number.isFinite(p.id_unidad_medida))
    return { ok: false, message: "Debes seleccionar una unidad de medida." };
  if (!Number.isFinite(p.id_categoria))
    return { ok: false, message: "Debes seleccionar una categoría." };

  return { ok: true };
}

// ---------- Endpoints ----------

// LISTAR productos con JOINs a categorías y unidades de medida
export const listarProductos = async (req, res) => {
  try {
    const productos = await db("productos as p")
      .leftJoin(
        "unidades_medida as um",
        "p.id_unidad_medida",
        "um.id_unidad_medida",
      )
      .leftJoin("categorias as c", "p.id_categoria", "c.id_categoria")
      .select(
        "p.id_producto",
        "p.nombre_producto",
        "p.descripcion_producto",
        "p.precio_costo",
        "p.precio_venta",
        // Calcular ganancia unitaria
        db.raw("(p.precio_venta - p.precio_costo) as ganancia_unitaria"),
        // Calcular margen de ganancia (%)
        db.raw(
          "CASE WHEN p.precio_venta > 0 THEN ROUND(((p.precio_venta - p.precio_costo) / p.precio_venta * 100)::numeric, 2) ELSE 0 END as margen_ganancia",
        ),
        "p.stock_actual",
        "p.stock_minimo",
        "p.stock_maximo",
        "p.id_unidad_medida",
        "um.nombre_unidad_medida",
        "um.abreviatura_unidad_medida",
        "p.id_categoria",
        "c.nombre_categoria",
        "p.activo",
        "p.creado_en",
        "p.actualizado_en",
      )
      .where("p.activo", true) // Solo productos activos
      .orderBy("p.nombre_producto");

    // Mapear activo a estado y precio_venta a precio_unitario para compatibilidad con frontend
    const productosMapeados = productos.map(p => ({
      ...p,
      precio_unitario: p.precio_venta, // Mapear para compatibilidad con frontend
      estado: p.activo ? 'A' : 'I'
    }));

    res.json(productosMapeados);
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
    const existe = await existeNombreCanonico(base, excludeId ?? null);
    res.json({ exists: !!existe });
  } catch (e) {
    console.error("Error en existeProducto:", e);
    res.json({ exists: false });
  }
};

// CREAR producto
export const crearProducto = async (req, res) => {
  const payload = { ...req.body };
  const v = validarPayloadProducto(payload);
  if (!v.ok) return res.status(400).json({ message: v.message });

  try {
    // Validar nombre único canónico
    if (await existeNombreCanonico(payload.nombre_producto)) {
      return res
        .status(409)
        .json({ message: "Ya existe un producto con ese nombre." });
    }

    // Validar que la categoría existe y está activa
    const categoriaExiste = await fkExiste(
      "categorias",
      "id_categoria",
      payload.id_categoria,
      "activa",
    );
    if (!categoriaExiste) {
      return res
        .status(400)
        .json({
          message: "La categoría seleccionada no existe o está inactiva.",
        });
    }

    // Validar que la unidad de medida existe y está activa
    const unidadExiste = await fkExiste(
      "unidades_medida",
      "id_unidad_medida",
      payload.id_unidad_medida,
    );
    if (!unidadExiste) {
      return res
        .status(400)
        .json({
          message:
            "La unidad de medida seleccionada no existe o está inactiva.",
        });
    }

    // Insertar producto
    const [nuevoProducto] = await db("productos")
      .insert({
        nombre_producto: payload.nombre_producto,
        descripcion_producto: payload.descripcion_producto || null,
        precio_costo: payload.precio_costo,
        precio_venta: payload.precio_venta,
        stock_actual: payload.stock_actual,
        stock_minimo: payload.stock_minimo,
        stock_maximo: payload.stock_maximo,
        id_unidad_medida: payload.id_unidad_medida,
        id_categoria: payload.id_categoria,
        activo: true,
      })
      .returning("*");

    console.log(
      `✅ Producto creado: ${nuevoProducto.nombre_producto} (ID: ${nuevoProducto.id_producto})`,
    );
    console.log(
      `   Precio costo: $${nuevoProducto.precio_costo} | Precio venta: $${nuevoProducto.precio_venta}`,
    );
    console.log(
      `   Ganancia: $${nuevoProducto.precio_venta - nuevoProducto.precio_costo}`,
    );

    res.status(201).json({
      message: "Producto creado correctamente.",
      producto: nuevoProducto,
    });
  } catch (error) {
    console.error("Error al crear producto:", error);
    res.status(500).json({ message: "Error al crear producto." });
  }
};

// ACTUALIZAR producto
export const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const payload = { ...req.body };
  const v = validarPayloadProducto(payload);
  if (!v.ok) return res.status(400).json({ message: v.message });

  try {
    // Verificar que el producto existe
    const productoExiste = await db("productos")
      .where("id_producto", id)
      .where("activo", true)
      .first();

    if (!productoExiste) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    // Validar nombre único canónico (excluyendo el propio producto)
    if (await existeNombreCanonico(payload.nombre_producto, id)) {
      return res
        .status(409)
        .json({ message: "Ya existe un producto con ese nombre." });
    }

    // Validar FKs
    const categoriaExiste = await fkExiste(
      "categorias",
      "id_categoria",
      payload.id_categoria,
      "activa",
    );
    if (!categoriaExiste) {
      return res
        .status(400)
        .json({
          message: "La categoría seleccionada no existe o está inactiva.",
        });
    }

    const unidadExiste = await fkExiste(
      "unidades_medida",
      "id_unidad_medida",
      payload.id_unidad_medida,
    );
    if (!unidadExiste) {
      return res
        .status(400)
        .json({
          message:
            "La unidad de medida seleccionada no existe o está inactiva.",
        });
    }

    // Actualizar producto
    const [productoActualizado] = await db("productos")
      .where("id_producto", id)
      .update({
        nombre_producto: payload.nombre_producto,
        descripcion_producto: payload.descripcion_producto || null,
        precio_costo: payload.precio_costo,
        precio_venta: payload.precio_venta,
        stock_actual: payload.stock_actual,
        stock_minimo: payload.stock_minimo,
        stock_maximo: payload.stock_maximo,
        id_unidad_medida: payload.id_unidad_medida,
        id_categoria: payload.id_categoria,
        // actualizado_en se actualiza automáticamente por trigger
      })
      .returning("*");

    console.log(
      `✅ Producto actualizado: ${productoActualizado.nombre_producto}`,
    );

    res.json({
      message: "Producto actualizado correctamente.",
      producto: productoActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ message: "Error al actualizar producto." });
  }
};

// ELIMINAR producto (solo si stock <= stock_minimo)
export const eliminarProducto = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que el producto existe
    const producto = await db("productos")
      .where("id_producto", id)
      .where("activo", true)
      .first();

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    // Validar regla de stock: solo permitir si stock_actual <= stock_minimo
    if (producto.stock_actual > producto.stock_minimo) {
      const stockActual = Math.floor(producto.stock_actual);
      const stockMinimo = Math.floor(producto.stock_minimo);
      return res.status(409).json({
        message: `No se puede eliminar el producto porque el stock actual (${stockActual}) es mayor que el mínimo (${stockMinimo}). Primero bájalo hasta su stock mínimo.`,
      });
    }

    // Verificar si tiene referencias en ventas
    const ventasConProducto = await db("detalle_venta")
      .where("id_producto", id)
      .count("* as total")
      .first();

    const totalVentas = parseInt(ventasConProducto.total) || 0;

    // Verificar si tiene referencias en compras
    const comprasConProducto = await db("detalle_compra")
      .where("id_producto", id)
      .count("* as total")
      .first();

    const totalCompras = parseInt(comprasConProducto.total) || 0;

    // Si tiene referencias, informar (pero el schema tiene RESTRICT, así que no debería llegar aquí)
    if (totalVentas > 0 || totalCompras > 0) {
      return res.status(409).json({
        message: `No se puede eliminar el producto porque tiene ${totalVentas} venta(s) y ${totalCompras} compra(s) asociadas.`,
      });
    }

    // Eliminar (DELETE físico por ahora)
    await db("productos").where("id_producto", id).del();

    // Alternativa: Soft Delete (comentado para implementar después)
    // await db('productos')
    //   .where('id_producto', id)
    //   .update({ activo: false });

    console.log(
      `✅ Producto eliminado: ${producto.nombre_producto} (ID: ${id})`,
    );

    res.json({ message: "Producto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar producto:", error);

    // Error de constraint de FK (aunque ya validamos arriba)
    if (error.code === "23503") {
      return res.status(409).json({
        message:
          "No se puede eliminar el producto porque tiene ventas o compras asociadas.",
      });
    }

    res.status(500).json({ message: "Error al eliminar producto." });
  }
};
