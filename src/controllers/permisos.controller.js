import db from "../config/db.js";

/* ===========================
   SISTEMA DE PERMISOS SIMPLIFICADO
   =========================== */
// Tabla: roles_formularios (id_rol, id_formulario)
// Si existe el registro = el rol tiene acceso completo al formulario

/* ===========================
   Helpers
   =========================== */

/** Verifica si un rol existe */
async function existeRol(idRol) {
  const rol = await db("roles").where("id_rol", idRol).first();
  return !!rol;
}

/** Verifica si un formulario existe */
async function existeFormulario(idFormulario) {
  const formulario = await db("formularios")
    .where("id_formulario", idFormulario)
    .first();
  return !!formulario;
}

/** Obtiene el padre de un formulario hijo */
async function obtenerPadre(idFormulario) {
  const formulario = await db("formularios")
    .select("padre_id", "is_padre")
    .where("id_formulario", idFormulario)
    .first();

  if (!formulario) return null;

  // Si es padre, retorna null (no tiene padre)
  if (formulario.is_padre || !formulario.padre_id) return null;

  return formulario.padre_id;
}

/** Obtiene todos los hijos de un formulario padre */
async function obtenerHijos(idFormularioPadre) {
  const hijos = await db("formularios")
    .select("id_formulario")
    .where("padre_id", idFormularioPadre)
    .where("is_padre", false);

  return hijos.map((h) => h.id_formulario);
}

/** Verifica si ya existe el permiso */
async function existePermiso(idRol, idFormulario) {
  const permiso = await db("roles_formularios")
    .where({ id_rol: idRol, id_formulario: idFormulario })
    .first();
  return !!permiso;
}

/* ===========================
   Endpoints
   =========================== */

// GET /api/permisos
// Lista todos los roles con sus formularios asignados
export const listarTodosLosPermisos = async (req, res) => {
  try {
    const permisos = await db("roles_formularios as rf")
      .join("roles as r", "rf.id_rol", "r.id_rol")
      .join("formularios as f", "rf.id_formulario", "f.id_formulario")
      .select(
        "r.id_rol",
        "r.nombre_rol",
        "f.id_formulario",
        "f.titulo_formulario",
        "f.is_padre",
        "f.padre_id",
      )
      .orderBy(["r.nombre_rol", "f.orden_formulario"]);

    res.json(permisos);
  } catch (error) {
    console.error("Error al listar permisos:", error);
    res.status(500).json({ message: "Error al listar permisos." });
  }
};

// GET /api/permisos/rol/:idRol
// Obtiene todos los formularios asignados a un rol específico
export const obtenerPermisosPorRol = async (req, res) => {
  const { idRol } = req.params;

  try {
    // Verificar que el rol existe
    if (!(await existeRol(idRol))) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    const formularios = await db("roles_formularios as rf")
      .join("formularios as f", "rf.id_formulario", "f.id_formulario")
      .select(
        "f.id_formulario",
        "f.titulo_formulario",
        "f.url_formulario",
        "f.padre_id",
        "f.is_padre",
        "f.orden_formulario",
      )
      .where("rf.id_rol", idRol)
      .orderBy([
        { column: db.raw("COALESCE(f.padre_id, f.id_formulario)") },
        { column: "f.orden_formulario", order: "asc" },
      ]);

    res.json(formularios);
  } catch (error) {
    console.error("Error al obtener permisos por rol:", error);
    res.status(500).json({ message: "Error al obtener permisos del rol." });
  }
};

// POST /api/permisos
// Asigna un formulario a un rol (con validación de jerarquía)
export const asignarPermiso = async (req, res) => {
  const { id_rol, id_formulario } = req.body;

  // Validaciones
  if (!id_rol || !id_formulario) {
    return res.status(400).json({
      message: "Se requieren id_rol e id_formulario.",
    });
  }

  try {
    // Verificar existencia
    if (!(await existeRol(id_rol))) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    if (!(await existeFormulario(id_formulario))) {
      return res.status(404).json({ message: "El formulario no existe." });
    }

    // Verificar duplicado
    if (await existePermiso(id_rol, id_formulario)) {
      return res.status(409).json({
        message: "Este permiso ya está asignado.",
      });
    }

    // Asignar el permiso solicitado
    await db("roles_formularios").insert({
      id_rol,
      id_formulario,
    });

    // VALIDACIÓN JERARQUÍA: Si es un hijo, asignar también el padre
    const idPadre = await obtenerPadre(id_formulario);
    if (idPadre && !(await existePermiso(id_rol, idPadre))) {
      await db("roles_formularios").insert({
        id_rol,
        id_formulario: idPadre,
      });
    }

    res.status(201).json({
      message: "Permiso asignado correctamente.",
      asignadoTambien: idPadre ? "Padre asignado automáticamente" : null,
    });
  } catch (error) {
    console.error("Error al asignar permiso:", error);
    res.status(500).json({ message: "Error al asignar permiso." });
  }
};

// POST /api/permisos/bulk
// Asigna múltiples formularios a un rol de una vez
export const asignarPermisosBulk = async (req, res) => {
  const { id_rol, formularios } = req.body;

  // Validaciones
  if (!id_rol || !Array.isArray(formularios) || formularios.length === 0) {
    return res.status(400).json({
      message: "Se requieren id_rol y un array de formularios.",
    });
  }

  try {
    // Verificar que el rol existe
    if (!(await existeRol(id_rol))) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    const permisosAsignados = [];
    const permisosExistentes = [];
    const padresAsignados = new Set();

    for (const id_formulario of formularios) {
      // Verificar que el formulario existe
      if (!(await existeFormulario(id_formulario))) {
        continue; // Saltar formularios inexistentes
      }

      // Verificar si ya existe
      if (await existePermiso(id_rol, id_formulario)) {
        permisosExistentes.push(id_formulario);
        continue;
      }

      // Asignar permiso
      await db("roles_formularios").insert({
        id_rol,
        id_formulario,
      });
      permisosAsignados.push(id_formulario);

      // Asignar padre si es necesario
      const idPadre = await obtenerPadre(id_formulario);
      if (idPadre && !(await existePermiso(id_rol, idPadre))) {
        if (!padresAsignados.has(idPadre)) {
          await db("roles_formularios").insert({
            id_rol,
            id_formulario: idPadre,
          });
          padresAsignados.add(idPadre);
        }
      }
    }

    res.status(201).json({
      message: "Permisos asignados correctamente.",
      asignados: permisosAsignados.length,
      yaExistian: permisosExistentes.length,
      padresAsignados: padresAsignados.size,
    });
  } catch (error) {
    console.error("Error al asignar permisos bulk:", error);
    res.status(500).json({ message: "Error al asignar permisos." });
  }
};

// DELETE /api/permisos/rol/:idRol/formulario/:idFormulario
// Quita un formulario de un rol (con eliminación de hijos si es padre)
export const quitarPermiso = async (req, res) => {
  const { idRol, idFormulario } = req.params;

  try {
    // Verificar existencia
    if (!(await existeRol(idRol))) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    if (!(await existeFormulario(idFormulario))) {
      return res.status(404).json({ message: "El formulario no existe." });
    }

    // Verificar que existe el permiso
    if (!(await existePermiso(idRol, idFormulario))) {
      return res.status(404).json({
        message: "Este rol no tiene asignado ese formulario.",
      });
    }

    // VALIDACIÓN JERARQUÍA: Si es padre, eliminar también los hijos
    const idsHijos = await obtenerHijos(idFormulario);
    let hijosEliminados = 0;

    if (idsHijos.length > 0) {
      hijosEliminados = await db("roles_formularios")
        .where("id_rol", idRol)
        .whereIn("id_formulario", idsHijos)
        .delete();
    }

    // Eliminar el permiso solicitado
    await db("roles_formularios")
      .where({ id_rol: idRol, id_formulario: idFormulario })
      .delete();

    res.json({
      message: "Permiso eliminado correctamente.",
      hijosEliminados: hijosEliminados > 0 ? hijosEliminados : null,
    });
  } catch (error) {
    console.error("Error al quitar permiso:", error);
    res.status(500).json({ message: "Error al quitar permiso." });
  }
};

// DELETE /api/permisos/rol/:idRol
// Elimina TODOS los permisos de un rol
export const eliminarTodosLosPermisosDeRol = async (req, res) => {
  const { idRol } = req.params;

  try {
    // Verificar que el rol existe
    if (!(await existeRol(idRol))) {
      return res.status(404).json({ message: "El rol no existe." });
    }

    const eliminados = await db("roles_formularios")
      .where("id_rol", idRol)
      .delete();

    res.json({
      message: `Todos los permisos del rol eliminados correctamente.`,
      total: eliminados,
    });
  } catch (error) {
    console.error("Error al eliminar permisos del rol:", error);
    res.status(500).json({ message: "Error al eliminar permisos." });
  }
};
