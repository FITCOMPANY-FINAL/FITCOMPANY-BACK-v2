import express from 'express';
import {
  listarPermisos,
  obtenerPermisosPorPerfil,
  crearPermisos,
  actualizarPermiso,
  eliminarPermiso
} from '../controllers/permisos.controller.js';

const router = express.Router();

router.get('/permisos', listarPermisos);
router.get('/permisos/:idPerfil/:perfilRol', obtenerPermisosPorPerfil);
router.post('/permisos', crearPermisos);
router.put('/permisos/:idPerfil/:perfilRol/:codigoFormulario', actualizarPermiso);
router.delete('/permisos/:idPerfil/:perfilRol/:codigoFormulario', eliminarPermiso);

export default router;
