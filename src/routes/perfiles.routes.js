import { Router } from 'express';
import {
  listarPerfiles,
  crearPerfil,
  actualizarPerfil,
  eliminarPerfil
} from '../controllers/perfiles.controller.js';

const router = Router();

router.get("/perfiles", listarPerfiles);
router.post("/perfiles", crearPerfil);
router.put("/perfiles/:id/:rol", actualizarPerfil);
router.delete("/perfiles/:id/:rol", eliminarPerfil);

export default router;
