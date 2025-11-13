import { getConnection } from '../config/db.js';

/* ===========================
   Helpers y constantes
   =========================== */

const collapseSpaces = (s) =>
  typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';

const MAX_LEN_NOMBRE = 100; // según tu BD
const MAX_LEN_DESC = 50;    // según tu BD
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Unicidad canónica por nombre (sin acentos y sin espacios). */
async function existeNombreCanonico(connection, nombre, exclude = null) {
  const sql = `
    SELECT 1
      FROM PERFILES p
     WHERE NLSSORT(REPLACE(p.NOMBRE_PERFIL,' ',''), 'NLS_SORT=BINARY_AI')
           = NLSSORT(REPLACE(:p_nombre,' ',''), 'NLS_SORT=BINARY_AI')
       AND (:p_ex_id IS NULL OR NOT (p.ID_PERFIL = :p_ex_id AND p.PERFIL_ROL = :p_ex_rol))
     FETCH FIRST 1 ROWS ONLY
  `;
  const r = await connection.execute(sql, {
    p_nombre: nombre,
    p_ex_id: exclude?.id ?? null,
    p_ex_rol: exclude?.rol ?? null,
  });
  return r.rows.length > 0;
}

/** Chequea existencia del rol. */
async function existeRol(connection, idRol) {
  const r = await connection.execute(
    `SELECT 1 FROM ROLES WHERE ID_ROL = :id`,
    { id: idRol }
  );
  return r.rows.length > 0;
}

/** Nombre canónico del perfil por PK (ID_PERFIL, PERFIL_ROL). */
async function obtenerNombreCanonicoPerfil(connection, idPerfil, perfilRol) {
  const r = await connection.execute(
    `SELECT REGEXP_REPLACE(
             LOWER(NLSSORT(NOMBRE_PERFIL,'NLS_SORT=BINARY_AI')),
             '[[:space:]]+',' '
           )
       FROM PERFILES
      WHERE ID_PERFIL = :id AND PERFIL_ROL = :rol`,
    { id: idPerfil, rol: perfilRol }
  );
  if (!r.rows || r.rows.length === 0) return null;
  return r.rows[0][0]; // p.ej. "administrador supremo"
}

/** Conteo de uso en PERMISOS y (si aplica) USUARIOS. */
async function contarUso(connection, idPerfil, perfilRol) {
  const rPerm = await connection.execute(
    `SELECT COUNT(*) FROM PERMISOS WHERE ID_PERFIL = :id AND PERFIL_ROL = :rol`,
    { id: idPerfil, rol: perfilRol }
  );
  const totalPermisos = rPerm.rows?.[0]?.[0] ?? 0;

  const chk = await connection.execute(`
    SELECT COUNT(*)
      FROM USER_TAB_COLS
     WHERE TABLE_NAME = 'USUARIOS'
       AND COLUMN_NAME IN ('ID_PERFIL','PERFIL_ROL')
  `);
  let totalUsuarios = 0;
  if ((chk.rows?.[0]?.[0] ?? 0) >= 2) {
    const rUsu = await connection.execute(
      `SELECT COUNT(*) FROM USUARIOS WHERE ID_PERFIL = :id AND PERFIL_ROL = :rol`,
      { id: idPerfil, rol: perfilRol }
    );
    totalUsuarios = rUsu.rows?.[0]?.[0] ?? 0;
  }

  return { totalPermisos, totalUsuarios };
}

/* ===========================
   LISTAR
   =========================== */
export const listarPerfiles = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(`
      SELECT 
        P.ID_PERFIL, 
        P.PERFIL_ROL, 
        P.NOMBRE_PERFIL, 
        P.DESCRIPCION_PERFIL,
        R.NOMBRE_ROL
      FROM PERFILES P
      JOIN ROLES R ON P.PERFIL_ROL = R.ID_ROL
      ORDER BY P.NOMBRE_PERFIL ASC
    `);

    const perfiles = result.rows.map(row => ({
      id: row[0],
      rol: row[1],
      nombre: row[2],
      descripcion: row[3],
      nombre_rol: row[4]
    }));

    res.json(perfiles);
  } catch (error) {
    console.error('Error al listar perfiles:', error);
    res.status(500).json({ message: 'Error en el servidor al obtener perfiles.' });
  } finally {
    if (connection) await connection.close();
  }
};

/* ===========================
   CREAR
   =========================== */
export const crearPerfil = async (req, res) => {
  const {
    nombre,
    descripcion,
    perfil_rol,
    rol,
    rol_asociado
  } = req.body;

  const nombre_perfil = collapseSpaces(nombre ?? '');
  const descripcion_perfil = collapseSpaces(descripcion ?? '');
  const perfilRol = Number(perfil_rol ?? rol ?? rol_asociado);

  if (!nombre_perfil) {
    return res.status(400).json({ message: 'El nombre del perfil es obligatorio.' });
  }
  if (!PATRON_PERMITIDO.test(nombre_perfil)) {
    return res.status(400).json({
      message: 'El nombre solo puede contener letras, espacios, guiones y puntos.',
    });
  }
  if (nombre_perfil.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({ message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.` });
  }
  if (descripcion_perfil && descripcion_perfil.length > MAX_LEN_DESC) {
    return res.status(400).json({ message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.` });
  }
  if (!perfilRol || Number.isNaN(perfilRol)) {
    return res.status(400).json({ message: 'Debes seleccionar un rol asociado.' });
  }

  let connection;
  try {
    connection = await getConnection();

    if (!(await existeRol(connection, perfilRol))) {
      return res.status(400).json({ message: 'El rol seleccionado no existe.' });
    }

    if (await existeNombreCanonico(connection, nombre_perfil)) {
      return res.status(409).json({
        code: 'DUPLICATE_NAME',
        field: 'nombre',
        message: 'Ya existe un perfil con ese nombre.',
      });
    }

    await connection.execute(
      `INSERT INTO PERFILES (ID_PERFIL, PERFIL_ROL, NOMBRE_PERFIL, DESCRIPCION_PERFIL)
       VALUES (SEQ_ID_PERFIL.NEXTVAL, :p_rol, :p_nombre, :p_desc)`,
      { p_rol: perfilRol, p_nombre: nombre_perfil, p_desc: descripcion_perfil },
      { autoCommit: true }
    );

    res.status(201).json({ message: 'Perfil creado correctamente.' });
  } catch (error) {
    console.error('Error al crear perfil:', error);
    res.status(500).json({ message: 'Error al crear perfil.' });
  } finally {
    if (connection) await connection.close();
  }
};

/* ===========================
   ACTUALIZAR
   =========================== */
export const actualizarPerfil = async (req, res) => {
  const { id, rol } = req.params;
  const { nombre, descripcion } = req.body;

  const nombre_perfil = collapseSpaces(nombre ?? '');
  const descripcion_perfil = collapseSpaces(descripcion ?? '');

  if (!nombre_perfil) {
    return res.status(400).json({ message: 'El nombre del perfil es obligatorio.' });
  }
  if (!PATRON_PERMITIDO.test(nombre_perfil)) {
    return res.status(400).json({
      message: 'El nombre solo puede contener letras, espacios, guiones y puntos.',
    });
  }
  if (nombre_perfil.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({ message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.` });
  }
  if (descripcion_perfil && descripcion_perfil.length > MAX_LEN_DESC) {
    return res.status(400).json({ message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.` });
  }

  let connection;
  try {
    connection = await getConnection();

    if (await existeNombreCanonico(connection, nombre_perfil, { id, rol })) {
      return res.status(409).json({
        code: 'DUPLICATE_NAME',
        field: 'nombre',
        message: 'Ya existe un perfil con ese nombre.',
      });
    }

    const result = await connection.execute(
      `UPDATE PERFILES
          SET NOMBRE_PERFIL = :p_nombre,
              DESCRIPCION_PERFIL = :p_desc
        WHERE ID_PERFIL = :p_id AND PERFIL_ROL = :p_rol`,
      { p_nombre: nombre_perfil, p_desc: descripcion_perfil, p_id: id, p_rol: rol },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: 'El perfil no existe.' });
    }

    res.json({ message: 'Perfil actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil.' });
  } finally {
    if (connection) await connection.close();
  }
};

/* ===========================
   ELIMINAR (con protegido)
   =========================== */
export const eliminarPerfil = async (req, res) => {
  const { id, rol } = req.params;

  let connection;
  try {
    connection = await getConnection();

    // Protección "Administrador Supremo" (igual que en Roles con "Administrador")
    const nombreCanon = await obtenerNombreCanonicoPerfil(connection, id, rol);
    if (nombreCanon === null) {
      return res.status(404).json({ message: 'El perfil no existe.' });
    }
    if (nombreCanon === 'administrador supremo') {
      return res.status(409).json({
        code: 'PROFILE_PROTECTED',
        message: "El perfil 'Administrador Supremo' no se puede eliminar.",
      });
    }

    // (Opcional) info de uso; si falla, seguimos confiando en la FK:
    try { await contarUso(connection, id, rol); } catch (_) {}

    const result = await connection.execute(
      `DELETE FROM PERFILES WHERE ID_PERFIL = :p_id AND PERFIL_ROL = :p_rol`,
      { p_id: id, p_rol: rol },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: 'El perfil no existe.' });
    }

    res.json({ message: 'Perfil eliminado correctamente.' });
  } catch (error) {
    if (error && error.errorNum === 2292) {
      return res.status(409).json({
        code: 'PROFILE_IN_USE',
        message:
          'No se puede eliminar: el perfil está en uso por usuarios y/o permisos. ' +
          'Debes reasignar/eliminar esas relaciones antes de eliminarlo.',
        requiresUpdateRelations: true
      });
    }
    console.error('Error al eliminar perfil:', error);
    res.status(500).json({ message: 'Error al eliminar perfil.' });
  } finally {
    if (connection) await connection.close();
  }
};
