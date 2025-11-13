// src/controllers/tipoIdentificacion.controller.js
import { getConnection } from "../config/db.js";

const collapseSpaces = (s) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "");
const MAX_LEN = 100;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Busca coincidencia canónica (ignora acentos, mayúsculas y TODOS los espacios).
 *  Retorna { id, estado } o null. Permite excluir un ID (para edición).
 */
async function encontrarCanonica(connection, descripcion, excludeId = null) {
  const sql = `
    SELECT TIPO_IDENTIFICACION_USUARIO, ESTADO
      FROM TIPOS_IDENTIFICACIONES
     WHERE NLSSORT(REPLACE(DESCRIPCION_TIPO_IDENTIFICACION, ' ', ''), 'NLS_SORT=BINARY_AI')
           = NLSSORT(REPLACE(:p_desc, ' ', ''), 'NLS_SORT=BINARY_AI')
       AND (:p_exclude_id IS NULL OR TIPO_IDENTIFICACION_USUARIO <> :p_exclude_id)
     FETCH FIRST 1 ROWS ONLY
  `;
  const r = await connection.execute(sql, { p_desc: descripcion, p_exclude_id: excludeId });
  if (!r.rows || r.rows.length === 0) return null;
  return { id: r.rows[0][0], estado: r.rows[0][1] };
}

/** Conteo de uso en USUARIOS (objeto PERSONABASE) y en VENTAS */
async function obtenerUso(connection, tipoId) {
  const u = await connection.execute(
    `SELECT COUNT(*)
       FROM USUARIOS u
      WHERE u.DATOS_PERSONALES.TIPO_IDENTIFICACION_USUARIO = :p_id`,
    { p_id: tipoId }
  );
  const usuarios = u.rows?.[0]?.[0] ?? 0;

  const v = await connection.execute(
    `SELECT COUNT(*) FROM VENTAS WHERE VENTA_USUARIO_TIPO_ID = :p_id`,
    { p_id: tipoId }
  );
  const ventas = v.rows?.[0]?.[0] ?? 0;

  return { usuarios, ventas, total: usuarios + ventas };
}

// ---------- Endpoints ----------
export const listarTiposIdentificacion = async (req, res) => {
  const incluirInactivos = String(req.query.incluirInactivos || "").toLowerCase() === "true";
  try {
    const connection = await getConnection();
    const sql = `
      SELECT TIPO_IDENTIFICACION_USUARIO, DESCRIPCION_TIPO_IDENTIFICACION, ESTADO
        FROM TIPOS_IDENTIFICACIONES
       ${incluirInactivos ? "" : "WHERE ESTADO = 'A'"}
       ORDER BY DESCRIPCION_TIPO_IDENTIFICACION
    `;
    const result = await connection.execute(sql);
    const tipos = result.rows.map((row) => ({
      id: row[0],
      descripcion: row[1],
      estado: row[2],
    }));
    await connection.close();
    res.json(tipos);
  } catch (error) {
    console.error("Error al listar tipos:", error);
    res.status(500).json({ message: "Error al listar tipos." });
  }
};

// Pre-chequeo para el front (existe canónicamente)
export const existeTipoIdentificacion = async (req, res) => {
  const { descripcion, excludeId } = req.query;
  const base = collapseSpaces(descripcion);
  if (!base) return res.json({ exists: false });

  try {
    const connection = await getConnection();
    const found = await encontrarCanonica(connection, base, excludeId ?? null);
    await connection.close();
    res.json({ exists: !!found, estado: found?.estado ?? null, id: found?.id ?? null });
  } catch (error) {
    console.error("Error en exists tipos:", error);
    res.json({ exists: false });
  }
};

export const crearTipoIdentificacion = async (req, res) => {
  let { descripcion } = req.body;
  descripcion = collapseSpaces(descripcion);

  if (!descripcion) return res.status(400).json({ message: "La descripción es obligatoria." });
  if (descripcion.length > MAX_LEN) return res.status(400).json({ message: `Máximo ${MAX_LEN} caracteres.` });
  if (!PATRON_PERMITIDO.test(descripcion))
    return res.status(400).json({ message: "Solo se permiten letras, espacios, guiones y puntos." });

  try {
    const connection = await getConnection();

    const found = await encontrarCanonica(connection, descripcion);
    if (found) {
      if (found.estado === "I") {
        // Reactivar el existente inactivo (misma descripción canónica)
        await connection.execute(
          `UPDATE TIPOS_IDENTIFICACIONES
              SET ESTADO='A', DESCRIPCION_TIPO_IDENTIFICACION=:p_desc
            WHERE TIPO_IDENTIFICACION_USUARIO=:p_id`,
          { p_desc: descripcion, p_id: found.id },
          { autoCommit: true }
        );
        await connection.close();
        return res.status(200).json({ message: "Tipo de identificación reactivado correctamente" });
      }
      await connection.close();
      return res.status(409).json({ message: "Ya existe un tipo de identificación con esa descripción." });
    }

    await connection.execute(
      `INSERT INTO TIPOS_IDENTIFICACIONES (
         TIPO_IDENTIFICACION_USUARIO, DESCRIPCION_TIPO_IDENTIFICACION, ESTADO
       ) VALUES ( SEQ_TIPO_IDENTIFICACION.NEXTVAL, :p_desc, 'A')`,
      { p_desc: descripcion },
      { autoCommit: true }
    );

    await connection.close();
    res.status(201).json({ message: "Tipo de identificación creado correctamente" });
  } catch (error) {
    console.error("Error al crear tipo:", error);
    res.status(500).json({ message: "Error al crear tipo." });
  }
};

export const actualizarTipoIdentificacion = async (req, res) => {
  const { id } = req.params;
  let { descripcion } = req.body;
  descripcion = collapseSpaces(descripcion);

  if (!descripcion) return res.status(400).json({ message: "La descripción es obligatoria." });
  if (descripcion.length > MAX_LEN) return res.status(400).json({ message: `Máximo ${MAX_LEN} caracteres.` });
  if (!PATRON_PERMITIDO.test(descripcion))
    return res.status(400).json({ message: "Solo se permiten letras, espacios, guiones y puntos." });

  try {
    const connection = await getConnection();

    const found = await encontrarCanonica(connection, descripcion, id);
    if (found) {
      await connection.close();
      return res.status(409).json({ message: "Ya existe un tipo de identificación con esa descripción." });
    }

    await connection.execute(
      `UPDATE TIPOS_IDENTIFICACIONES
          SET DESCRIPCION_TIPO_IDENTIFICACION = :p_desc
        WHERE TIPO_IDENTIFICACION_USUARIO = :p_id`,
      { p_desc: descripcion, p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Tipo de identificación actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar tipo:", error);
    res.status(500).json({ message: "Error al actualizar tipo." });
  }
};

/** ELIMINAR:
 *  - Si NO está en uso -> borra y 200
 *  - Si SÍ está en uso -> 409 con detalle (front ofrece desactivar) */
export const eliminarTipoIdentificacion = async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();

    const { usuarios, ventas, total } = await obtenerUso(connection, id);

    if (total > 0) {
      await connection.close();
      const partes = [];
      if (usuarios > 0) partes.push(`${usuarios} usuario(s)`);
      if (ventas > 0) partes.push(`${ventas} venta(s)`);
      return res.status(409).json({
        message: `Este tipo de identificación está en uso por ${partes.join(" y ")}. No se puede eliminar. Puedes desactivarlo para que no se use en nuevos registros.`,
        requiresDeactivation: true,
        usuarios,
        ventas
      });
    }

    await connection.execute(
      `DELETE FROM TIPOS_IDENTIFICACIONES WHERE TIPO_IDENTIFICACION_USUARIO = :p_id`,
      { p_id: id },
      { autoCommit: true }
    );

    await connection.close();
    res.json({ message: "Tipo de identificación eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar tipo:", error);
    res.status(500).json({ message: "Error al eliminar tipo." });
  }
};

// Acciones explícitas (admin): activar / desactivar
export const activarTipoIdentificacion = async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();
    await connection.execute(
      `UPDATE TIPOS_IDENTIFICACIONES SET ESTADO='A' WHERE TIPO_IDENTIFICACION_USUARIO=:p_id`,
      { p_id: id },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: "Tipo de identificación activado" });
  } catch (error) {
    console.error("Error al activar tipo:", error);
    res.status(500).json({ message: "Error al activar tipo." });
  }
};

export const desactivarTipoIdentificacion = async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();
    await connection.execute(
      `UPDATE TIPOS_IDENTIFICACIONES SET ESTADO='I' WHERE TIPO_IDENTIFICACION_USUARIO=:p_id`,
      { p_id: id },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: "Tipo de identificación desactivado" });
  } catch (error) {
    console.error("Error al desactivar tipo:", error);
    res.status(500).json({ message: "Error al desactivar tipo." });
  }
};
