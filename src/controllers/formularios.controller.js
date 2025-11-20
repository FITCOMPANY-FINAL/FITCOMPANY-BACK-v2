import db from "../config/db.js";

/* ===========================
   LISTAR FORMULARIOS
   =========================== */
// GET /api/formularios
// Retorna todos los formularios ordenados jerárquicamente
// para construir el menú dinámico en el frontend
export const listarFormularios = async (req, res) => {
  try {
    const formularios = await db("formularios")
      .select(
        "id_formulario",
        "titulo_formulario",
        "url_formulario",
        "padre_id",
        "is_padre",
        "orden_formulario",
      )
      .orderBy([
        { column: db.raw("COALESCE(padre_id, id_formulario)") }, // Agrupa padres con sus hijos
        { column: "orden_formulario", order: "asc" },
      ]);

    res.json(formularios);
  } catch (error) {
    console.error("Error al listar formularios:", error);
    res.status(500).json({ message: "Error al listar formularios." });
  }
};
