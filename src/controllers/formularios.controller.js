import { getConnection } from "../config/db.js";
import oracledb from "oracledb";

export const listarFormularios = async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.execute(
      `SELECT CODIGO_FORMULARIO, TITULO_FORMULARIO FROM FORMULARIOS ORDER BY ORDEN`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error al listar formularios:", error);
    res.status(500).json({ mensaje: "Error al obtener los formularios" });
  }
};
