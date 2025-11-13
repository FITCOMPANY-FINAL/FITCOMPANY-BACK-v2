import { getConnection } from '../config/db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    const connection = await getConnection();

    // Limpiar y normalizar el correo para evitar errores de espacios o mayúsculas
    const correoLimpio = correo.trim().toLowerCase();

    // 🔍 Logs para depuración
    console.log("🔐 Intento de login:");
    console.log("Correo recibido:", correo);
    console.log("Correo limpio:", correoLimpio);
    console.log("Password recibido:", password);

    // Buscar el usuario en la base de datos
const result = await connection.execute(
  `SELECT 
    TREAT(U.DATOS_PERSONALES AS PersonaBase).TIPO_IDENTIFICACION_USUARIO AS tipo_id,
    TREAT(U.DATOS_PERSONALES AS PersonaBase).IDENTIFICACION_USUARIO AS identificacion,
    U.CONTRASENNIA_USUARIO,
    TREAT(U.DATOS_PERSONALES AS PersonaBase).NOMBRE_USUARIO AS nombre,
    TREAT(U.DATOS_PERSONALES AS PersonaBase).APELLIDO1_USUARIO AS apellido1,
    TREAT(U.DATOS_PERSONALES AS PersonaBase).APELLIDO2_USUARIO AS apellido2,
    TREAT(U.DATOS_PERSONALES AS PersonaBase).EMAIL_USUARIO AS correo,
    R.NOMBRE_ROL,
    U.PERFIL_USUARIO,
    U.PERFIL_ROL_USUARIO
  FROM USUARIOS U
  JOIN ROLES R ON U.PERFIL_ROL_USUARIO = R.ID_ROL
  WHERE LOWER(TREAT(U.DATOS_PERSONALES AS PersonaBase).EMAIL_USUARIO) = :correo`,
  [correoLimpio]
);

    // 🔍 Log de resultados
    console.log("Resultado consulta:", result.rows);

    // Si no se encuentra el usuario
    if (result.rows.length === 0) {
      console.log("❌ No se encontró ningún usuario con ese correo");
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }

    // Extraer datos del usuario
    const [
      tipo,
      identificacion,
      password_db,
      nombre,
      apellido1,
      apellido2,
      correoDB,
      rol,
      perfil_id,
      perfil_rol
    ] = result.rows[0];

    // 🔍 Validar la contraseña
    console.log("Contraseña esperada:", password_db);

    if (password !== password_db) {
      console.log("❌ Contraseña incorrecta");
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }

    // ✅ Confirmación
    console.log("✅ Login exitoso para:", correoDB);

    // Obtener formularios con sus permisos
    const permisosResult = await connection.execute(
      `SELECT 
         F.CODIGO_FORMULARIO,
         F.TITULO_FORMULARIO,
         F.URL_FORMULARIO,
         F.ES_PADRE,
         F.ORDEN,
         F.PADRE_FORMULARIO,
         P.PUEDE_CREAR,
         P.PUEDE_LEER,
         P.PUEDE_ACTUALIZAR,
         P.PUEDE_ELIMINAR
       FROM FORMULARIOS F
       JOIN PERMISOS P ON F.CODIGO_FORMULARIO = P.CODIGO_FORMULARIO
       WHERE P.ID_PERFIL = :perfil_id AND P.PERFIL_ROL = :perfil_rol
       ORDER BY F.ES_PADRE DESC, F.ORDEN ASC`,
      [perfil_id, perfil_rol]
    );

    // Convertir a arreglo de objetos JS
    const formularios = permisosResult.rows.map(row => ({
      codigo: row[0],
      titulo: row[1],
      url: row[2],
      es_padre: row[3],
      orden: row[4],
      padre: row[5],
      permisos: {
        crear: row[6],
        leer: row[7],
        actualizar: row[8],
        eliminar: row[9]
      }
    }));

    // Crear el token JWT con toda la info útil
    const token = jwt.sign(
      {
        tipo,
        identificacion,
        nombre,
        apellido1,
        apellido2: apellido2 ?? '',
        correo: correoDB,
        rol,
        perfil_id,
        perfil_rol,
        formularios // menú dinámico desde acá
      },
      process.env.jwt_secret,
      { expiresIn: '8h' }
    );

    // Cerrar conexión
    await connection.close();

    // Devolver token
    res.json({ token });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor al intentar iniciar sesión.' });
  }
};
