import { Router } from "express";
import {
  listarTiposIdentificacion,
  crearTipoIdentificacion,
  actualizarTipoIdentificacion,
  eliminarTipoIdentificacion,
  existeTipoIdentificacion,
  activarTipoIdentificacion,
  desactivarTipoIdentificacion,
} from "../controllers/tipoIdentificacion.controller.js";

const router = Router();

router.get("/tipos-identificacion", listarTiposIdentificacion);
router.get("/tipos-identificacion/exists", existeTipoIdentificacion);
router.post("/tipos-identificacion", crearTipoIdentificacion);
router.put("/tipos-identificacion/:id", actualizarTipoIdentificacion);
router.delete("/tipos-identificacion/:id", eliminarTipoIdentificacion);

// Admin: activar / desactivar
router.patch("/tipos-identificacion/:id/activar", activarTipoIdentificacion);
router.patch("/tipos-identificacion/:id/desactivar", desactivarTipoIdentificacion);

export default router;
