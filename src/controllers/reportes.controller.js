import db from "../config/db.js";

// ========== HELPERS ==========

/**
 * Calcular rango de fechas según período
 */
function calcularRangoFechas(periodo, fecha_inicio = null, fecha_fin = null) {
  const ahora = new Date();
  let inicio, fin;

  if (fecha_inicio && fecha_fin) {
    // Rango personalizado
    inicio = new Date(fecha_inicio);
    fin = new Date(fecha_fin);
    fin.setHours(23, 59, 59, 999); // Incluir todo el último día
  } else {
    switch (periodo) {
      case "hoy":
        inicio = new Date(ahora.setHours(0, 0, 0, 0));
        fin = new Date(ahora.setHours(23, 59, 59, 999));
        break;

      case "semanal":
        inicio = new Date(ahora);
        inicio.setDate(ahora.getDate() - 6); // Últimos 7 días
        inicio.setHours(0, 0, 0, 0);
        fin = new Date();
        fin.setHours(23, 59, 59, 999);
        break;

      case "mensual":
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
        fin = new Date(
          ahora.getFullYear(),
          ahora.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        break;

      case "anual":
        inicio = new Date(ahora.getFullYear(), 0, 1, 0, 0, 0, 0);
        fin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;

      default:
        // Por defecto: mensual
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
        fin = new Date(
          ahora.getFullYear(),
          ahora.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
    }
  }

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    inicio_format: inicio.toISOString().split("T")[0],
    fin_format: fin.toISOString().split("T")[0],
  };
}

/**
 * Generar array de fechas entre dos fechas
 */
function generarArrayFechas(fechaInicio, fechaFin) {
  const fechas = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    fechas.push(new Date(d).toISOString().split("T")[0]);
  }

  return fechas;
}

// ========== ENDPOINTS ==========

/**
 * GET /api/reportes/ventas
 * Reporte de ventas por período
 */
export const reporteVentas = async (req, res) => {
  const { periodo, fecha_inicio, fecha_fin } = req.query;

  try {
    // Calcular rango de fechas
    const rango = calcularRangoFechas(periodo, fecha_inicio, fecha_fin);

    // RESUMEN GENERAL
    const resumen = await db("ventas")
      .whereBetween("fecha_venta", [rango.inicio, rango.fin])
      .select(
        db.raw("COUNT(*) as cantidad_ventas"),
        db.raw("COALESCE(SUM(total), 0) as total_ventas"),
        db.raw("COALESCE(ROUND(AVG(total)::numeric, 2), 0) as venta_promedio"),
        db.raw(
          "SUM(CASE WHEN es_fiado = false THEN 1 ELSE 0 END) as ventas_contado",
        ),
        db.raw(
          "SUM(CASE WHEN es_fiado = true THEN 1 ELSE 0 END) as ventas_fiadas",
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN es_fiado = false THEN total ELSE 0 END), 0) as total_contado",
        ),
        db.raw(
          "COALESCE(SUM(CASE WHEN es_fiado = true THEN total ELSE 0 END), 0) as total_fiado",
        ),
      )
      .first();

    // VENTAS POR DÍA
    const ventasPorDia = await db("ventas")
      .whereBetween("fecha_venta", [rango.inicio, rango.fin])
      .select(
        db.raw("DATE(fecha_venta)::text as fecha"),
        db.raw("COUNT(*) as cantidad"),
        db.raw("COALESCE(SUM(total), 0) as total"),
      )
      .groupBy(db.raw("DATE(fecha_venta)"))
      .orderBy("fecha", "asc");

    // Rellenar días sin ventas con 0
    const todasLasFechas = generarArrayFechas(
      rango.inicio_format,
      rango.fin_format,
    );
    const ventasPorDiaCompleto = todasLasFechas.map((fecha) => {
      // Normalizar formato de fecha para comparación
      const fechaNormalizada = fecha.split('T')[0];
      const ventaDelDia = ventasPorDia.find((v) => {
        const fechaVenta = v.fecha ? v.fecha.split('T')[0] : null;
        return fechaVenta === fechaNormalizada;
      });
      return {
        fecha: fechaNormalizada,
        cantidad: ventaDelDia ? Number(ventaDelDia.cantidad) : 0,
        total: ventaDelDia ? Number(ventaDelDia.total) : 0,
      };
    });

    // PRODUCTOS MÁS VENDIDOS
    const productosMasVendidos = await db("detalle_venta as dv")
      .join("productos as p", "dv.id_producto", "p.id_producto")
      .join("ventas as v", "dv.id_venta", "v.id_venta")
      .whereBetween("v.fecha_venta", [rango.inicio, rango.fin])
      .select(
        "p.id_producto",
        "p.nombre_producto",
        db.raw("SUM(dv.cantidad_detalle_venta) as unidades_vendidas"),
        db.raw("COALESCE(SUM(dv.subtotal_venta), 0) as total_generado"),
      )
      .groupBy("p.id_producto", "p.nombre_producto")
      .orderBy("unidades_vendidas", "desc")
      .limit(5);

    // VENTAS POR USUARIO (VENDEDOR)
    const ventasPorUsuario = await db("ventas as v")
      .join("usuarios as u", function () {
        this.on(
          "v.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("v.identificacion_usuario", "u.identificacion_usuario");
      })
      .whereBetween("v.fecha_venta", [rango.inicio, rango.fin])
      .select(
        db.raw(
          "CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario) as nombre_usuario",
        ),
        db.raw("COUNT(v.id_venta) as cantidad_ventas"),
        db.raw("COALESCE(SUM(v.total), 0) as total_vendido"),
      )
      .groupBy("u.nombres_usuario", "u.apellido1_usuario")
      .orderBy("total_vendido", "desc");

    // RESPUESTA
    res.json({
      ok: true,
      periodo: {
        tipo: periodo || "personalizado",
        fecha_inicio: rango.inicio_format,
        fecha_fin: rango.fin_format,
        dias: todasLasFechas.length,
      },
      resumen: {
        total_ventas: Number(resumen.total_ventas),
        cantidad_ventas: Number(resumen.cantidad_ventas),
        venta_promedio: Number(resumen.venta_promedio),
        ventas_contado: Number(resumen.ventas_contado),
        ventas_fiadas: Number(resumen.ventas_fiadas),
        total_contado: Number(resumen.total_contado),
        total_fiado: Number(resumen.total_fiado),
      },
      por_dia: ventasPorDiaCompleto,
      productos_mas_vendidos: productosMasVendidos.map((p) => ({
        id_producto: p.id_producto,
        nombre: p.nombre_producto,
        unidades: Number(p.unidades_vendidas),
        total: Number(p.total_generado),
      })),
      vendedores: ventasPorUsuario.map((v) => ({
        nombre: v.nombre_usuario,
        ventas: Number(v.cantidad_ventas),
        total: Number(v.total_vendido),
      })),
    });
  } catch (error) {
    console.error("Error al generar reporte de ventas:", error);
    res.status(500).json({ message: "Error al generar reporte de ventas." });
  }
};

/**
 * GET /api/reportes/compras
 * Reporte de compras por período
 */
export const reporteCompras = async (req, res) => {
  const { periodo, fecha_inicio, fecha_fin } = req.query;

  try {
    // Calcular rango de fechas
    const rango = calcularRangoFechas(periodo, fecha_inicio, fecha_fin);

    // RESUMEN GENERAL
    const resumen = await db("compras")
      .whereBetween("fecha_compra", [rango.inicio, rango.fin])
      .select(
        db.raw("COUNT(*) as cantidad_compras"),
        db.raw("COALESCE(SUM(total), 0) as total_compras"),
        db.raw("COALESCE(ROUND(AVG(total)::numeric, 2), 0) as compra_promedio"),
      )
      .first();

    // COMPRAS POR DÍA
    const comprasPorDia = await db("compras")
      .whereBetween("fecha_compra", [rango.inicio, rango.fin])
      .select(
        db.raw("DATE(fecha_compra)::text as fecha"),
        db.raw("COUNT(*) as cantidad"),
        db.raw("COALESCE(SUM(total), 0) as total"),
      )
      .groupBy(db.raw("DATE(fecha_compra)"))
      .orderBy("fecha", "asc");

    // Rellenar días sin compras con 0
    const todasLasFechas = generarArrayFechas(
      rango.inicio_format,
      rango.fin_format,
    );
    const comprasPorDiaCompleto = todasLasFechas.map((fecha) => {
      // Normalizar formato de fecha para comparación
      const fechaNormalizada = fecha.split('T')[0];
      const compraDelDia = comprasPorDia.find((c) => {
        const fechaCompra = c.fecha ? c.fecha.split('T')[0] : null;
        return fechaCompra === fechaNormalizada;
      });
      return {
        fecha: fechaNormalizada,
        cantidad: compraDelDia ? Number(compraDelDia.cantidad) : 0,
        total: compraDelDia ? Number(compraDelDia.total) : 0,
      };
    });

    // PRODUCTOS MÁS COMPRADOS
    const productosMasComprados = await db("detalle_compra as dc")
      .join("productos as p", "dc.id_producto", "p.id_producto")
      .join("compras as c", "dc.id_compra", "c.id_compra")
      .whereBetween("c.fecha_compra", [rango.inicio, rango.fin])
      .select(
        "p.id_producto",
        "p.nombre_producto",
        db.raw("SUM(dc.cantidad_detalle_compra) as unidades_compradas"),
        db.raw("COALESCE(SUM(dc.subtotal_compra), 0) as total_gastado"),
      )
      .groupBy("p.id_producto", "p.nombre_producto")
      .orderBy("unidades_compradas", "desc")
      .limit(5);

    // COMPRAS POR USUARIO
    const comprasPorUsuario = await db("compras as c")
      .join("usuarios as u", function () {
        this.on(
          "c.id_tipo_identificacion_usuario",
          "u.id_tipo_identificacion",
        ).andOn("c.identificacion_usuario", "u.identificacion_usuario");
      })
      .whereBetween("c.fecha_compra", [rango.inicio, rango.fin])
      .select(
        db.raw(
          "CONCAT(u.nombres_usuario, ' ', u.apellido1_usuario) as nombre_usuario",
        ),
        db.raw("COUNT(c.id_compra) as cantidad_compras"),
        db.raw("COALESCE(SUM(c.total), 0) as total_comprado"),
      )
      .groupBy("u.nombres_usuario", "u.apellido1_usuario")
      .orderBy("total_comprado", "desc");

    // RESPUESTA
    res.json({
      ok: true,
      periodo: {
        tipo: periodo || "personalizado",
        fecha_inicio: rango.inicio_format,
        fecha_fin: rango.fin_format,
        dias: todasLasFechas.length,
      },
      resumen: {
        total_compras: Number(resumen.total_compras),
        cantidad_compras: Number(resumen.cantidad_compras),
        compra_promedio: Number(resumen.compra_promedio),
      },
      por_dia: comprasPorDiaCompleto,
      productos_mas_comprados: productosMasComprados.map((p) => ({
        id_producto: p.id_producto,
        nombre: p.nombre_producto,
        unidades: Number(p.unidades_compradas),
        total: Number(p.total_gastado),
      })),
      usuarios: comprasPorUsuario.map((c) => ({
        nombre: c.nombre_usuario,
        compras: Number(c.cantidad_compras),
        total: Number(c.total_comprado),
      })),
    });
  } catch (error) {
    console.error("Error al generar reporte de compras:", error);
    res.status(500).json({ message: "Error al generar reporte de compras." });
  }
};

/**
 * GET /api/reportes/dashboard
 * Dashboard con estadísticas generales
 */
export const dashboard = async (req, res) => {
  try {
    const ahora = new Date();

    // Rango de hoy (corregido para evitar mutación)
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0).toISOString();
    const hoyFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999).toISOString();

    // Rango del mes actual
    const mesInicio = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      1,
      0,
      0,
      0,
      0,
    ).toISOString();
    const mesFin = new Date(
      ahora.getFullYear(),
      ahora.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).toISOString();

    // ========== VENTAS DE HOY ==========
    // Usar DATE() para comparar solo la fecha, sin importar la hora
    const ventasHoy = await db("ventas")
      .whereRaw("DATE(fecha_venta) = CURRENT_DATE")
      .select(
        db.raw("COUNT(*) as cantidad"),
        db.raw("COALESCE(SUM(total), 0) as total"),
      )
      .first();

    // ========== COMPRAS DE HOY ==========
    // Usar DATE() para comparar solo la fecha, sin importar la hora
    const comprasHoy = await db("compras")
      .whereRaw("DATE(fecha_compra) = CURRENT_DATE")
      .select(
        db.raw("COUNT(*) as cantidad"),
        db.raw("COALESCE(SUM(total), 0) as total"),
      )
      .first();

    // ========== VENTAS DEL MES ==========
    const ventasMes = await db("ventas")
      .whereBetween("fecha_venta", [mesInicio, mesFin])
      .select(
        db.raw("COUNT(*) as cantidad"),
        db.raw("COALESCE(SUM(total), 0) as total"),
      )
      .first();

    // ========== COMPRAS DEL MES ==========
    const comprasMes = await db("compras")
      .whereBetween("fecha_compra", [mesInicio, mesFin])
      .select(
        db.raw("COUNT(*) as cantidad"),
        db.raw("COALESCE(SUM(total), 0) as total"),
      )
      .first();

    // ========== GANANCIA DEL MES ==========
    const gananciaMes = Number(ventasMes.total) - Number(comprasMes.total);

    // ========== INVENTARIO ==========
    const inventario = await db("productos")
      .where("activo", true)
      .select(
        db.raw("COUNT(*) as total_productos"),
        db.raw(
          "SUM(CASE WHEN stock_actual > stock_maximo THEN 1 ELSE 0 END) as productos_sobre_maximo",
        ),
        db.raw(
          "SUM(CASE WHEN stock_actual < stock_minimo THEN 1 ELSE 0 END) as productos_bajo_minimo",
        ),
        db.raw(
          "COALESCE(SUM(stock_actual * precio_costo), 0) as valor_inventario",
        ),
      )
      .first();

    // ========== PRODUCTOS POR ENCIMA DEL STOCK MÁXIMO ==========
    const productosSobreMaximo = await db("productos")
      .where("activo", true)
      .where("stock_actual", ">", db.raw("stock_maximo"))
      .select(
        "id_producto",
        "nombre_producto",
        "stock_actual",
        "stock_maximo",
        db.raw("(stock_actual - stock_maximo) as exceso"),
      )
      .orderBy("exceso", "desc")
      .limit(5);

    // ========== PRODUCTOS BAJO DEL STOCK MÍNIMO ==========
    const productosBajoMinimo = await db("productos")
      .where("activo", true)
      .where("stock_actual", "<", db.raw("stock_minimo"))
      .select(
        "id_producto",
        "nombre_producto",
        "stock_actual",
        "stock_minimo",
        db.raw("(stock_minimo - stock_actual) as faltante"),
      )
      .orderBy("faltante", "desc")
      .limit(5);

    // ========== CARTERA (VENTAS FIADAS) ==========
    const cartera = await db("ventas")
      .where("es_fiado", true)
      .where("estado", "PENDIENTE")
      .select(
        db.raw("COUNT(*) as ventas_pendientes"),
        db.raw("COALESCE(SUM(saldo_pendiente), 0) as total_por_cobrar"),
      )
      .first();

    // ========== TOP 5 PRODUCTOS MÁS VENDIDOS DEL MES ==========
    const topProductos = await db("detalle_venta as dv")
      .join("productos as p", "dv.id_producto", "p.id_producto")
      .join("ventas as v", "dv.id_venta", "v.id_venta")
      .whereBetween("v.fecha_venta", [mesInicio, mesFin])
      .select(
        "p.nombre_producto",
        db.raw("SUM(dv.cantidad_detalle_venta) as unidades"),
        db.raw("COALESCE(SUM(dv.subtotal_venta), 0) as total"),
      )
      .groupBy("p.id_producto", "p.nombre_producto")
      .orderBy("unidades", "desc")
      .limit(5);

    // ========== PRODUCTO MÁS RENTABLE DEL MES ==========
    const productoMasRentable = await db("productos as p")
      .leftJoin("detalle_venta as dv", "p.id_producto", "dv.id_producto")
      .leftJoin("ventas as v", "dv.id_venta", "v.id_venta")
      .whereBetween("v.fecha_venta", [mesInicio, mesFin])
      .where("p.activo", true)
      .select(
        "p.nombre_producto",
        db.raw(
          "COALESCE(SUM(dv.cantidad_detalle_venta * (p.precio_venta - p.precio_costo)), 0) as ganancia_total",
        ),
      )
      .groupBy("p.id_producto", "p.nombre_producto")
      .orderBy("ganancia_total", "desc")
      .limit(1)
      .first();

    // ========== RESPUESTA ==========
    res.json({
      ok: true,
      fecha_generacion: new Date().toISOString(),
      resumen_hoy: {
        ventas: {
          cantidad: Number(ventasHoy.cantidad),
          total: Number(ventasHoy.total),
        },
        compras: {
          cantidad: Number(comprasHoy.cantidad),
          total: Number(comprasHoy.total),
        },
      },
      resumen_mes: {
        ventas: {
          cantidad: Number(ventasMes.cantidad),
          total: Number(ventasMes.total),
        },
        compras: {
          cantidad: Number(comprasMes.cantidad),
          total: Number(comprasMes.total),
        },
        ganancia_neta: gananciaMes,
      },
      inventario: {
        total_productos: Number(inventario.total_productos),
        productos_sobre_maximo: Number(inventario.productos_sobre_maximo),
        productos_bajo_minimo: Number(inventario.productos_bajo_minimo),
        valor_total: Number(inventario.valor_inventario),
        productos_sobre_maximo_lista: productosSobreMaximo.map((p) => ({
          id_producto: p.id_producto,
          nombre: p.nombre_producto,
          stock_actual: Number(p.stock_actual),
          stock_maximo: Number(p.stock_maximo),
          exceso: Number(p.exceso),
        })),
        productos_bajo_minimo_lista: productosBajoMinimo.map((p) => ({
          id_producto: p.id_producto,
          nombre: p.nombre_producto,
          stock_actual: Number(p.stock_actual),
          stock_minimo: Number(p.stock_minimo),
          faltante: Number(p.faltante),
        })),
      },
      cartera: {
        ventas_pendientes: Number(cartera.ventas_pendientes),
        total_por_cobrar: Number(cartera.total_por_cobrar),
      },
      top_5_productos: topProductos.map((p) => ({
        nombre: p.nombre_producto,
        unidades: Number(p.unidades),
        total: Number(p.total),
      })),
      producto_mas_rentable: productoMasRentable
        ? {
            nombre: productoMasRentable.nombre_producto,
            ganancia: Number(productoMasRentable.ganancia_total),
          }
        : null,
    });
  } catch (error) {
    console.error("Error al generar dashboard:", error);
    res.status(500).json({ message: "Error al generar dashboard." });
  }
};
