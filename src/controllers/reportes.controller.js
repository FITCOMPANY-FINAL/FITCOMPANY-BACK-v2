import { getConnection } from "../config/db.js";
import oracledb from "oracledb";

export const obtenerReporteVentasSemanal = async (req, res) => {
  try {
    const connection = await getConnection();

    const result = await connection.execute(
    `SELECT
        V.ID_VENTA,
        V.FECHA_VENTA,
        P.NOMBRE_PRODUCTO,
        D.CANTIDAD_DETALLE_VENTA,
        (D.CANTIDAD_DETALLE_VENTA * D.PRECIO_UNITARIO_DETALLE_VENTA) AS TOTAL_POR_PRODUCTO,
        V.TOTAL_VENTA,
        V.VENTA_USUARIO
    FROM VENTAS V
    JOIN DETALLES_VENTAS_PRODUCTOS D ON D.VENTA_ID = V.ID_VENTA
    JOIN PRODUCTOS P ON P.ID_PRODUCTO = D.PRODUCTO_VENDIDO
    WHERE V.FECHA_VENTA >= SYSDATE - 7
    ORDER BY V.FECHA_VENTA DESC`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error al obtener el reporte semanal:", error);
    res.status(500).json({ mensaje: "Error al generar el reporte semanal" });
  }
};

export const obtenerReporteComprasSemanal = async (req, res) => {
  try {
    const connection = await getConnection();

    const result = await connection.execute(
      `SELECT
        C.ID_COMPRA,
        C.FECHA_COMPRA,
        P.NOMBRE_PRODUCTO || ' (Compra #' || C.ID_COMPRA || ')' AS NOMBRE_PRODUCTO,
        C.CANTIDAD_COMPRA_INVENTARIO AS CANTIDAD_COMPRADA,
        C.COSTO_UNIDAD_COMPRA AS PRECIO_UNITARIO,
        (C.CANTIDAD_COMPRA_INVENTARIO * C.COSTO_UNIDAD_COMPRA) AS TOTAL_POR_PRODUCTO,
        C.COMPRA_PRODUCTO_USUARIO AS USUARIO_REGISTRO
      FROM COMPRAS C
      JOIN PRODUCTOS P ON P.ID_PRODUCTO = C.COMPRA_PRODUCTO_INVENTARIO
      WHERE C.FECHA_COMPRA >= SYSDATE - 7
      ORDER BY C.FECHA_COMPRA DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error al obtener el reporte de compras:", error);
    res.status(500).json({ mensaje: "Error al generar el reporte de compras" });
  }
};

