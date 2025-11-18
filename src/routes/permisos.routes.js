import { Router } from "express";
import {
  listarTodosLosPermisos,
  obtenerPermisosPorRol,
  asignarPermiso,
  asignarPermisosBulk,
  quitarPermiso,
  eliminarTodosLosPermisosDeRol,
} from "../controllers/permisos.controller.js";

const router = Router();

// Listar todos los permisos
router.get("/permisos", listarTodosLosPermisos);

// Obtener permisos de un rol específico
router.get("/permisos/rol/:idRol", obtenerPermisosPorRol);

// Asignar un formulario a un rol
router.post("/permisos", asignarPermiso);

// Asignar múltiples formularios a un rol
router.post("/permisos/bulk", asignarPermisosBulk);

// Quitar un formulario de un rol
router.delete("/permisos/rol/:idRol/formulario/:idFormulario", quitarPermiso);

// Eliminar TODOS los permisos de un rol
router.delete("/permisos/rol/:idRol", eliminarTodosLosPermisosDeRol);

export default router;
