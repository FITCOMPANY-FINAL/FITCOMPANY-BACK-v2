import { getConnection } from '../config/db.js';
import oracledb from 'oracledb';

// Obtener todos los permisos
export const listarPermisos = async (req, res) => {
  try {
    const connection = await getConnection();

    const result = await connection.execute(
      `SELECT 
        p.ID_PERFIL,
        p.PERFIL_ROL,
        f.CODIGO_FORMULARIO,
        f.TITULO_FORMULARIO,
        pr.NOMBRE_PERFIL,
        p.PUEDE_CREAR,
        p.PUEDE_LEER,
        p.PUEDE_ACTUALIZAR,
        p.PUEDE_ELIMINAR
      FROM PERMISOS p
      JOIN FORMULARIOS f ON p.CODIGO_FORMULARIO = f.CODIGO_FORMULARIO
      JOIN PERFILES pr ON pr.ID_PERFIL = p.ID_PERFIL AND pr.PERFIL_ROL = p.PERFIL_ROL
      ORDER BY p.ID_PERFIL, p.PERFIL_ROL, f.ORDEN`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Error al listar permisos:', error);
    res.status(500).json({ mensaje: 'Error al obtener los permisos' });
  }
};


// Crear un permiso
export const crearPermisos = async (req, res) => {
  const { idPerfil, perfilRol, permisos } = req.body;

  try {
    const connection = await getConnection();

    for (const permiso of permisos) {
      const {
        codigoFormulario,
        puedeCrear,
        puedeLeer,
        puedeActualizar,
        puedeEliminar
      } = permiso;

      await connection.execute(
        `INSERT INTO PERMISOS (
          ID_PERFIL, CODIGO_FORMULARIO, PERFIL_ROL,
          PUEDE_CREAR, PUEDE_LEER, PUEDE_ACTUALIZAR, PUEDE_ELIMINAR
        ) VALUES (:1, :2, :3, :4, :5, :6, :7)`,
        [
          idPerfil,
          codigoFormulario,
          perfilRol,
          puedeCrear,
          puedeLeer,
          puedeActualizar,
          puedeEliminar
        ],
        { autoCommit: true }
      );
    }

    res.status(201).json({ mensaje: '✅ Permisos asignados correctamente' });
  } catch (error) {
    console.error('❌ Error al asignar permisos:', error);
    res.status(500).json({ mensaje: 'Error al asignar los permisos' });
  }
};


// Actualizar un permiso
export const actualizarPermiso = async (req, res) => {
  const { ID_PERFIL, CODIGO_FORMULARIO, PERFIL_ROL } = req.params;
  const {
    PUEDE_CREAR,
    PUEDE_LEER,
    PUEDE_ACTUALIZAR,
    PUEDE_ELIMINAR
  } = req.body;

  try {
    const connection = await getConnection();
    const result = await connection.execute(
      `UPDATE PERMISOS
       SET PUEDE_CREAR = :1,
           PUEDE_LEER = :2,
           PUEDE_ACTUALIZAR = :3,
           PUEDE_ELIMINAR = :4
       WHERE ID_PERFIL = :5
         AND CODIGO_FORMULARIO = :6
         AND PERFIL_ROL = :7`,
      [
        PUEDE_CREAR,
        PUEDE_LEER,
        PUEDE_ACTUALIZAR,
        PUEDE_ELIMINAR,
        ID_PERFIL,
        CODIGO_FORMULARIO,
        PERFIL_ROL
      ],
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ mensaje: 'Permiso no encontrado' });
    }

    res.status(200).json({ mensaje: '✅ Permiso actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar permiso:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el permiso' });
  }
};

// Eliminar un permiso
export const eliminarPermiso = async (req, res) => {
  const { ID_PERFIL, CODIGO_FORMULARIO, PERFIL_ROL } = req.params;

  try {
    const connection = await getConnection();
    const result = await connection.execute(
      `DELETE FROM PERMISOS
       WHERE ID_PERFIL = :1
         AND CODIGO_FORMULARIO = :2
         AND PERFIL_ROL = :3`,
      [ID_PERFIL, CODIGO_FORMULARIO, PERFIL_ROL],
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ mensaje: 'Permiso no encontrado para eliminar' });
    }

    res.status(200).json({ mensaje: '🗑️ Permiso eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar permiso:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el permiso' });
  }
};



export const obtenerPermisosPorPerfil = async (req, res) => {
  const { idPerfil, perfilRol } = req.params;

  try {
    const connection = await getConnection();

    const result = await connection.execute(
      `SELECT 
        p.CODIGO_FORMULARIO,
        f.TITULO_FORMULARIO,
        f.URL_FORMULARIO,
        p.PUEDE_CREAR,
        p.PUEDE_LEER,
        p.PUEDE_ACTUALIZAR,
        p.PUEDE_ELIMINAR
      FROM PERMISOS p
      JOIN FORMULARIOS f ON p.CODIGO_FORMULARIO = f.CODIGO_FORMULARIO
      WHERE p.ID_PERFIL = :1 AND p.PERFIL_ROL = :2
      ORDER BY f.ORDEN`,
      [idPerfil, perfilRol],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener permisos por perfil:', error);
    res.status(500).json({ mensaje: 'Error al obtener permisos' });
  }
};
