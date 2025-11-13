import { getConnection } from '../config/db.js';

/* ===========================
   Helpers y constantes
   =========================== */

const collapseSpaces = (s) =>
  typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';

const MAX_LEN_NOMBRE = 50;
const MAX_LEN_DESC = 200;
// Letras (con acentos), espacios, guiones y puntos
const PATRON_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

/** Unicidad canónica por nombre (sin acentos, lower y sin espacios).
 *  excludeId (opcional) para ediciones.
 */
async function existeNombreCanonico(connection, nombre, excludeId = null) {
  const sql = `
    SELECT 1
      FROM ROLES
     WHERE NLSSORT(REPLACE(NOMBRE_ROL, ' ', ''), 'NLS_SORT=BINARY_AI')
           = NLSSORT(REPLACE(:p_nombre, ' ', ''), 'NLS_SORT=BINARY_AI')
       AND (:p_exclude_id IS NULL OR ID_ROL <> :p_exclude_id)
     FETCH FIRST 1 ROWS ONLY
  `;
  const r = await connection.execute(sql, {
    p_nombre: nombre,
    p_exclude_id: excludeId
  });
  return r.rows.length > 0;
}

/** Nombre canónico del rol por ID (para proteger "Administrador"). */
async function obtenerNombreCanonicoPorId(connection, id) {
  const sql = `
    SELECT REGEXP_REPLACE(
             LOWER(NLSSORT(NOMBRE_ROL,'NLS_SORT=BINARY_AI')),
             '[[:space:]]+',' '
           ) AS nombre_canon
      FROM ROLES
     WHERE ID_ROL = :p_id
  `;
  const r = await connection.execute(sql, { p_id: id });
  if (!r.rows || r.rows.length === 0) return null;
  return r.rows[0][0]; // nombre_canon
}

/** Perfiles que usan un rol (para mensaje amigable en 409).
 *  Si existe NOMBRE_PERFIL, devuelve nombres; si no, IDs.
 */
async function perfilesQueUsan(connection, rolId, limit = 25) {
  // ¿Existe la columna NOMBRE_PERFIL?
  const chk = await connection.execute(
    `SELECT COUNT(*)
       FROM USER_TAB_COLS
      WHERE TABLE_NAME = 'PERFILES'
        AND COLUMN_NAME = 'NOMBRE_PERFIL'`
  );
  const tieneNombre = (chk.rows?.[0]?.[0] || 0) > 0;

  let sql = `SELECT ID_PERFIL FROM PERFILES WHERE PERFIL_ROL = :p_id ORDER BY ID_PERFIL`;
  if (tieneNombre) {
    sql = `SELECT ID_PERFIL, NOMBRE_PERFIL
             FROM PERFILES
            WHERE PERFIL_ROL = :p_id
            ORDER BY NOMBRE_PERFIL`;
  }

  const r = await connection.execute(sql, { p_id: rolId });

  const total = r.rows.length;
  const lista = r.rows.slice(0, limit);

  if (tieneNombre) {
    const perfiles = lista.map(row => ({
      id: row[0],
      nombre: row[1]
    }));
    return { total, perfiles, truncated: total > limit, hasNames: true };
  } else {
    const perfilesIds = lista.map(row => row[0]);
    return { total, perfilesIds, truncated: total > limit, hasNames: false };
  }
}

/* ===========================
   Endpoints
   =========================== */

// GET /api/roles
export const listarRoles = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT ID_ROL, NOMBRE_ROL, DESCRIPCION_ROL
         FROM ROLES
         ORDER BY NOMBRE_ROL ASC`
    );

    const roles = result.rows.map(row => ({
      id_rol: row[0],
      nombre_rol: row[1],
      descripcion_rol: row[2],
    }));

    res.json(roles);
  } catch (error) {
    console.error('Error al listar roles:', error);
    res.status(500).json({ message: 'Error al listar roles.' });
  } finally {
    if (connection) await connection.close();
  }
};

// POST /api/roles
export const crearRol = async (req, res) => {
  let { nombre_rol, descripcion_rol } = req.body;

  nombre_rol = collapseSpaces(nombre_rol ?? '');
  descripcion_rol = collapseSpaces(descripcion_rol ?? '');

  // Validaciones
  if (!nombre_rol) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' });
  }
  if (!PATRON_PERMITIDO.test(nombre_rol)) {
    return res.status(400).json({
      message: 'El nombre solo puede contener letras, espacios, guiones y puntos.',
    });
  }
  if (nombre_rol.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
    });
  }
  if (descripcion_rol && descripcion_rol.length > MAX_LEN_DESC) {
    return res.status(400).json({
      message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
    });
  }

  let connection;
  try {
    connection = await getConnection();

    // Unicidad canónica
    if (await existeNombreCanonico(connection, nombre_rol)) {
      return res.status(409).json({
        code: 'DUPLICATE_NAME',
        field: 'nombre_rol',
        message: 'Ya existe un rol con ese nombre.',
      });
    }

    await connection.execute(
      `INSERT INTO ROLES (ID_ROL, NOMBRE_ROL, DESCRIPCION_ROL)
       VALUES (SEQ_ID_ROL.NEXTVAL, :p_nombre, :p_desc)`,
      { p_nombre: nombre_rol, p_desc: descripcion_rol },
      { autoCommit: true }
    );

    res.status(201).json({ message: 'Rol creado correctamente.' });
  } catch (error) {
    console.error('Error al crear rol:', error);
    res.status(500).json({ message: 'Error al crear rol.' });
  } finally {
    if (connection) await connection.close();
  }
};

// PUT /api/roles/:id
export const actualizarRol = async (req, res) => {
  const { id } = req.params;
  let { nombre_rol, descripcion_rol } = req.body;

  nombre_rol = collapseSpaces(nombre_rol ?? '');
  descripcion_rol = collapseSpaces(descripcion_rol ?? '');

  // Validaciones
  if (!nombre_rol) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' });
  }
  if (!PATRON_PERMITIDO.test(nombre_rol)) {
    return res.status(400).json({
      message: 'El nombre solo puede contener letras, espacios, guiones y puntos.',
    });
  }
  if (nombre_rol.length > MAX_LEN_NOMBRE) {
    return res.status(400).json({
      message: `El nombre admite máximo ${MAX_LEN_NOMBRE} caracteres.`,
    });
  }
  if (descripcion_rol && descripcion_rol.length > MAX_LEN_DESC) {
    return res.status(400).json({
      message: `La descripción admite máximo ${MAX_LEN_DESC} caracteres.`,
    });
  }

  let connection;
  try {
    connection = await getConnection();

    // Unicidad canónica excluyendo este ID
    if (await existeNombreCanonico(connection, nombre_rol, id)) {
      return res.status(409).json({
        code: 'DUPLICATE_NAME',
        field: 'nombre_rol',
        message: 'Ya existe un rol con ese nombre.',
      });
    }

    const result = await connection.execute(
      `UPDATE ROLES
          SET NOMBRE_ROL = :p_nombre,
              DESCRIPCION_ROL = :p_desc
        WHERE ID_ROL = :p_id`,
      { p_nombre: nombre_rol, p_desc: descripcion_rol, p_id: id },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: 'El rol no existe.' });
    }

    res.json({ message: 'Rol actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({ message: 'Error al actualizar rol.' });
  } finally {
    if (connection) await connection.close();
  }
};

// DELETE /api/roles/:id
export const eliminarRol = async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    connection = await getConnection();

    // ¿Existe? y ¿es "Administrador"?
    const nombreCanon = await obtenerNombreCanonicoPorId(connection, id);
    if (nombreCanon === null) {
      return res.status(404).json({ message: 'El rol no existe.' });
    }
    if (nombreCanon === 'administrador') {
      return res.status(409).json({
        code: 'ROLE_PROTECTED',
        message: "El rol 'Administrador' no se puede eliminar.",
      });
    }

    // ¿Está en uso por PERFILES?
    const { total, perfiles, perfilesIds, truncated, hasNames } =
      await perfilesQueUsan(connection, id);

    if (total > 0) {
      const payload = {
        code: 'ROLE_IN_USE',
        message:
          `No se puede eliminar: hay ${total} perfil(es) usando este rol. ` +
          `Debes cambiar el rol de esos perfiles antes de eliminarlo.`,
        requiresUpdateRelations: true,
        totalPerfiles: total,
        truncated
      };
      if (hasNames) {
        payload.perfiles = (perfiles || []).map(p => p.nombre);
      } else {
        payload.perfilesIds = perfilesIds || [];
      }
      return res.status(409).json(payload);
    }

    // Eliminar
    const result = await connection.execute(
      `DELETE FROM ROLES WHERE ID_ROL = :p_id`,
      { p_id: id },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: 'El rol no existe.' });
    }

    res.json({ message: 'Rol eliminado correctamente.' });
  } catch (error) {
    // Seguridad por si una FK explota por carrera: ORA-02292
    if (error && error.errorNum === 2292) {
      return res.status(409).json({
        code: 'ROLE_IN_USE',
        message:
          'No se puede eliminar este rol porque está en uso por perfiles. ' +
          'Debes reasignar esos perfiles antes de eliminarlo.',
        requiresUpdateRelations: true,
      });
    }
    console.error('Error al eliminar rol:', error);
    res.status(500).json({ message: 'Error al eliminar rol.' });
  } finally {
    if (connection) await connection.close();
  }
};
