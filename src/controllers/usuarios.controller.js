import { getConnection } from '../config/db.js';

/* ===========================
   Helpers y constantes
   =========================== */
const collapseSpaces = (s) =>
  typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';

const MAX_LEN_STR = 100;
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;
const PATRON_IDENT = /^[A-Za-z0-9.\-]+$/; // sin espacios
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

async function existeUsuarioPorIdent(connection, ident) {
  const r = await connection.execute(
    `SELECT 1
       FROM USUARIOS u
      WHERE TREAT(u.DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO = :id
      FETCH FIRST 1 ROWS ONLY`,
    { id: ident }
  );
  return r.rows.length > 0;
}

async function existeUsuarioPorEmail(connection, email, excludeIdent = null) {
  const r = await connection.execute(
    `SELECT 1
       FROM USUARIOS u
      WHERE LOWER(TREAT(u.DATOS_PERSONALES AS PersonaBase).EMAIL_USUARIO) = LOWER(:e)
        AND (:ex IS NULL OR TREAT(u.DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO <> :ex)
      FETCH FIRST 1 ROWS ONLY`,
    { e: email, ex: excludeIdent }
  );
  return r.rows.length > 0;
}

/** Verifica si existe el perfil por ID (no impone rol). */
async function existePerfilPorId(connection, idPerfil) {
  const r = await connection.execute(
    `SELECT 1 FROM PERFILES WHERE ID_PERFIL = :p FETCH FIRST 1 ROWS ONLY`,
    { p: idPerfil }
  );
  return r.rows.length > 0;
}

/** Verifica si existe el rol por ID. */
async function existeRolPorId(connection, idRol) {
  const r = await connection.execute(
    `SELECT 1 FROM ROLES WHERE ID_ROL = :r FETCH FIRST 1 ROWS ONLY`,
    { r: idRol }
  );
  return r.rows.length > 0;
}

/* ===========================
   LISTAR
   =========================== */
export const listarUsuarios = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(`
      SELECT 
        U.DATOS_PERSONALES.TIPO_IDENTIFICACION_USUARIO,
        U.DATOS_PERSONALES.IDENTIFICACION_USUARIO,
        U.DATOS_PERSONALES.NOMBRE_USUARIO,
        U.DATOS_PERSONALES.APELLIDO1_USUARIO,
        U.DATOS_PERSONALES.APELLIDO2_USUARIO,
        U.DATOS_PERSONALES.EMAIL_USUARIO,
        U.PERFIL_USUARIO,
        U.PERFIL_ROL_USUARIO,

        /* PERFIL (si no hay match, devuelve el id como texto) */
        TRIM( NVL(
          (SELECT P.NOMBRE_PERFIL
             FROM PERFILES P
            WHERE P.ID_PERFIL = U.PERFIL_USUARIO
              AND ROWNUM = 1),
          TO_CHAR(U.PERFIL_USUARIO)
        )) AS PERFIL_NOMBRE,

        /* ROL (si no hay match, devuelve el id como texto) */
        TRIM( NVL(
          (SELECT R.NOMBRE_ROL
             FROM ROLES R
            WHERE R.ID_ROL = U.PERFIL_ROL_USUARIO
              AND ROWNUM = 1),
          TO_CHAR(U.PERFIL_ROL_USUARIO)
        )) AS ROL_NOMBRE

      FROM USUARIOS U
      ORDER BY U.DATOS_PERSONALES.NOMBRE_USUARIO
    `);

    const usuarios = result.rows.map(row => ({
      tipo_identificacion: row[0],
      identificacion:      row[1],
      nombre:              row[2],
      apellido1:           row[3],
      apellido2:           row[4],
      correo:              row[5],
      perfil_id:           row[6],
      perfil_rol:          row[7],
      perfil_nombre:       row[8],  // texto final
      rol_nombre:          row[9],  // texto final
    }));

    res.json(usuarios);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ message: 'Error al listar usuarios.' });
  } finally {
    if (connection) await connection.close();
  }
};


/* ===========================
   CREAR
   =========================== */
export const crearUsuario = async (req, res) => {
  let {
    tipo_identificacion,
    identificacion,
    nombre,
    apellido1,
    apellido2,
    correo,
    contrasennia,
    perfil_id,
    perfil_rol, // <-- ahora viene del front y NO se cruza con el perfil
  } = req.body;

  // Normalización
  identificacion = (identificacion ?? '').trim();
  nombre = collapseSpaces(nombre ?? '');
  apellido1 = collapseSpaces(apellido1 ?? '');
  apellido2 = collapseSpaces(apellido2 ?? '');
  correo = (correo ?? '').trim().toLowerCase();

  // Validaciones
  if (!tipo_identificacion) return res.status(400).json({ message: 'El tipo de identificación es obligatorio.' });
  if (!identificacion) return res.status(400).json({ message: 'La identificación es obligatoria.' });
  if (!PATRON_IDENT.test(identificacion))
    return res.status(400).json({ message: 'La identificación solo admite letras, números, puntos o guiones.' });
  if (identificacion.length > MAX_LEN_STR)
    return res.status(400).json({ message: `La identificación admite máximo ${MAX_LEN_STR} caracteres.` });

  if (!nombre || !PATRON_NOMBRE.test(nombre))
    return res.status(400).json({ message: 'El nombre solo puede contener letras, espacios, guiones y puntos.' });
  if (nombre.length > MAX_LEN_STR)
    return res.status(400).json({ message: `El nombre admite máximo ${MAX_LEN_STR} caracteres.` });

  if (!apellido1 || !PATRON_NOMBRE.test(apellido1))
    return res.status(400).json({ message: 'El apellido 1 solo puede contener letras, espacios, guiones y puntos.' });
  if (apellido1.length > MAX_LEN_STR || (apellido2 && apellido2.length > MAX_LEN_STR))
    return res.status(400).json({ message: `Los apellidos admiten máximo ${MAX_LEN_STR} caracteres.` });
  if (apellido2 && !PATRON_NOMBRE.test(apellido2))
    return res.status(400).json({ message: 'El apellido 2 solo puede contener letras, espacios, guiones y puntos.' });

  if (!correo || !PATRON_EMAIL.test(correo))
    return res.status(400).json({ message: 'Formato de correo inválido.' });

  if (!contrasennia || String(contrasennia).length < 3)
    return res.status(400).json({ message: 'La contraseña debe tener al menos 3 caracteres.' });

  if (!perfil_id) return res.status(400).json({ message: 'Debes seleccionar un perfil.' });
  if (!perfil_rol) return res.status(400).json({ message: 'Debes seleccionar un rol.' });

  let connection;
  try {
    connection = await getConnection();

    // Unicidades
    if (await existeUsuarioPorIdent(connection, identificacion)) {
      return res.status(409).json({
        code: 'DUP_IDENT',
        field: 'identificacion',
        message: 'Ya existe un usuario con esa identificación.',
      });
    }
    if (await existeUsuarioPorEmail(connection, correo)) {
      return res.status(409).json({
        code: 'DUP_EMAIL',
        field: 'correo',
        message: 'Ya existe un usuario con ese correo.',
      });
    }

    // Existencias (sin cruzar)
    if (!(await existePerfilPorId(connection, perfil_id))) {
      return res.status(400).json({ message: 'El perfil seleccionado no existe.' });
    }
    if (!(await existeRolPorId(connection, perfil_rol))) {
      return res.status(400).json({ message: 'El rol seleccionado no existe.' });
    }

    await connection.execute(
      `INSERT INTO USUARIOS (
         DATOS_PERSONALES,
         CONTRASENNIA_USUARIO,
         PERFIL_USUARIO,
         PERFIL_ROL_USUARIO
       ) VALUES (
         PersonaBase(:tipo, :ident, :nombre, :ap1, :ap2, :email),
         :pwd,
         :pid,
         :prol
       )`,
      {
        tipo: tipo_identificacion,
        ident: identificacion,
        nombre,
        ap1: apellido1,
        ap2: apellido2,
        email: correo,
        pwd: contrasennia, // sin hash, como pediste
        pid: perfil_id,
        prol: perfil_rol,
      },
      { autoCommit: true }
    );

    res.status(201).json({ message: 'Usuario creado correctamente.' });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ message: 'Error al crear usuario.' });
  } finally {
    if (connection) await connection.close();
  }
};

/* ===========================
   ACTUALIZAR
   =========================== */
/* ===========================
   ACTUALIZAR (permite cambiar tipo/ident)
   =========================== */
export const actualizarUsuario = async (req, res) => {
  // Valores ACTUALES (antes de editar) que llegan por la URL
  const { tipo: tipoActual, id: idActual } = req.params;

  // Valores NUEVOS (lo que escribió la persona en el formulario)
  let {
    tipo_identificacion,      // nuevo tipo
    identificacion,           // nueva identificación
    nombre,
    apellido1,
    apellido2,
    correo,
    contrasennia,             // opcional: si viene y tiene >=3, se actualiza
    perfil_id,
    perfil_rol,
  } = req.body;

  // -------- Normalización / validaciones espejo (igual que en crear) --------
  const collapseSpaces = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');
  const MAX_LEN_STR = 100;
  const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;
  const PATRON_IDENT = /^[A-Za-z0-9.\-]+$/;  // sin espacios
  const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  nombre = collapseSpaces(nombre ?? '');
  apellido1 = collapseSpaces(apellido1 ?? '');
  apellido2 = collapseSpaces(apellido2 ?? '');
  correo = (correo ?? '').trim().toLowerCase();

  if (!tipo_identificacion) return res.status(400).json({ message: 'El tipo de identificación es obligatorio.' });
  if (!identificacion) return res.status(400).json({ message: 'La identificación es obligatoria.' });
  if (!PATRON_IDENT.test(identificacion))
    return res.status(400).json({ message: 'La identificación solo admite letras, números, puntos o guiones.' });
  if (identificacion.length > MAX_LEN_STR)
    return res.status(400).json({ message: `La identificación admite máximo ${MAX_LEN_STR} caracteres.` });

  if (!nombre || !PATRON_NOMBRE.test(nombre))
    return res.status(400).json({ message: 'El nombre solo puede contener letras, espacios, guiones y puntos.' });
  if (nombre.length > MAX_LEN_STR)
    return res.status(400).json({ message: `El nombre admite máximo ${MAX_LEN_STR} caracteres.` });

  if (!apellido1 || !PATRON_NOMBRE.test(apellido1))
    return res.status(400).json({ message: 'El apellido 1 solo puede contener letras, espacios, guiones y puntos.' });
  if (apellido1.length > MAX_LEN_STR || (apellido2 && apellido2.length > MAX_LEN_STR))
    return res.status(400).json({ message: `Los apellidos admiten máximo ${MAX_LEN_STR} caracteres.` });
  if (apellido2 && !PATRON_NOMBRE.test(apellido2))
    return res.status(400).json({ message: 'El apellido 2 solo puede contener letras, espacios, guiones y puntos.' });

  if (!correo || !PATRON_EMAIL.test(correo))
    return res.status(400).json({ message: 'Formato de correo inválido.' });
  if (contrasennia && String(contrasennia).length > 0 && String(contrasennia).length < 3)
    return res.status(400).json({ message: 'La contraseña debe tener al menos 3 caracteres.' });

  if (!perfil_id) return res.status(400).json({ message: 'Debes seleccionar un perfil.' });
  if (!perfil_rol) return res.status(400).json({ message: 'Debes seleccionar un rol.' });

  let connection;
  try {
    connection = await getConnection();

    // 1) Verifica que el usuario ACTUAL exista (por los valores de la URL)
    const existe = await connection.execute(
      `SELECT 1
         FROM USUARIOS
        WHERE TREAT(DATOS_PERSONALES AS PersonaBase).TIPO_IDENTIFICACION_USUARIO = :t
          AND TREAT(DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO      = :i
        FETCH FIRST 1 ROWS ONLY`,
      { t: tipoActual, i: idActual }
    );
    if (existe.rows.length === 0) {
      return res.status(404).json({ message: 'El usuario no existe.' });
    }

    // 2) Si cambió la identificación, valida que la NUEVA no exista (PK es la identificación)
    if (identificacion !== idActual) {
      const dupId = await connection.execute(
        `SELECT 1
           FROM USUARIOS u
          WHERE TREAT(u.DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO = :id
          FETCH FIRST 1 ROWS ONLY`,
        { id: identificacion }
      );
      if (dupId.rows.length > 0) {
        return res.status(409).json({
          code: 'DUP_IDENT',
          field: 'identificacion',
          message: 'Ya existe un usuario con esa identificación.',
        });
      }
    }

    // 3) Unicidad de correo (excluyendo al usuario ACTUAL por su identificación actual)
    const dupMail = await connection.execute(
      `SELECT 1
         FROM USUARIOS u
        WHERE LOWER(TREAT(u.DATOS_PERSONALES AS PersonaBase).EMAIL_USUARIO) = LOWER(:e)
          AND TREAT(u.DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO <> :ex
        FETCH FIRST 1 ROWS ONLY`,
      { e: correo, ex: idActual }
    );
    if (dupMail.rows.length > 0) {
      return res.status(409).json({
        code: 'DUP_EMAIL',
        field: 'correo',
        message: 'Ya existe un usuario con ese correo.',
      });
    }

    // 4) Existencia de perfil y de rol
    const [okPerfil, okRol] = await Promise.all([
      connection.execute(`SELECT 1 FROM PERFILES WHERE ID_PERFIL = :p FETCH FIRST 1 ROWS ONLY`, { p: perfil_id }),
      connection.execute(`SELECT 1 FROM ROLES    WHERE ID_ROL    = :r FETCH FIRST 1 ROWS ONLY`, { r: perfil_rol }),
    ]);
    if (okPerfil.rows.length === 0) return res.status(400).json({ message: 'El perfil seleccionado no existe.' });
    if (okRol.rows.length === 0) return res.status(400).json({ message: 'El rol seleccionado no existe.' });

    // 5) SET dinámico para contraseña opcional
    let setPwdSql = '';
    const binds = {
      // NUEVOS valores (se grabarán en la fila)
      tipoNuevo: tipo_identificacion,
      idNuevo: identificacion,
      nombre,
      ap1: apellido1,
      ap2: apellido2,
      email: correo,
      pid: perfil_id,
      prol: perfil_rol,
      // Valores ACTUALES para ubicar la fila
      tipoActual,
      idActual,
    };
    if (contrasennia && String(contrasennia).trim().length >= 3) {
      setPwdSql = `, CONTRASENNIA_USUARIO = :pwd`;
      binds.pwd = contrasennia; // (sin hash por ahora)
    }

    const sql = `
      UPDATE USUARIOS
         SET DATOS_PERSONALES = PersonaBase(:tipoNuevo, :idNuevo, :nombre, :ap1, :ap2, :email)
             ${setPwdSql},
             PERFIL_USUARIO     = :pid,
             PERFIL_ROL_USUARIO = :prol
       WHERE TREAT(DATOS_PERSONALES AS PersonaBase).TIPO_IDENTIFICACION_USUARIO = :tipoActual
         AND TREAT(DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO      = :idActual
    `;

    const result = await connection.execute(sql, binds, { autoCommit: true });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: 'El usuario no existe.' });
    }

    res.json({ message: 'Usuario actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error al actualizar usuario.' });
  } finally {
    if (connection) await connection.close();
  }
};


/* ===========================
   ELIMINAR
   =========================== */
export const eliminarUsuario = async (req, res) => {
  const { tipo, id } = req.params;
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `DELETE FROM USUARIOS
        WHERE TREAT(DATOS_PERSONALES AS PersonaBase).TIPO_IDENTIFICACION_USUARIO = :t
          AND TREAT(DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO = :i`,
      { t: tipo, i: id },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: 'El usuario no existe.' });
    }

    res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario.' });
  } finally {
    if (connection) await connection.close();
  }
};

